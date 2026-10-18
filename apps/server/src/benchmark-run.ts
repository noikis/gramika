import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { MODELS, OriginalText, TIMEOUT_MS, type HistoryRequest } from '@gramota/contracts'
import {
  AttemptError,
  createCorrectionService,
  PARAMETERS,
  PROMPT_VERSION,
  STRICT_PROMPT,
} from './correction-service'
import { CorrectionDatabase } from './database'
import type { CorrectionTransport } from './openrouter'
import { renderBenchmarkReport } from './benchmark-report'

export class BenchmarkInputError extends Error {}

export const BENCHMARK_MODELS = MODELS
const BenchmarkModelId = z.enum(BENCHMARK_MODELS.map((model) => model.id))

export function assertBenchmarkPrompt(version: string) {
  if (version !== 'strict-v3')
    throw new BenchmarkInputError('This benchmark requires the active strict-v3 prompt.')
}

export function prepareBenchmark(cases: unknown, models: unknown) {
  assertBenchmarkPrompt(PROMPT_VERSION)
  const parsedCases = z
    .array(z.strictObject({ id: z.string().trim().min(1).max(200), text: OriginalText }))
    .min(1)
    .safeParse(cases)
  if (
    !parsedCases.success ||
    new Set(parsedCases.data.map((item) => item.id)).size !== parsedCases.data.length
  ) {
    throw new BenchmarkInputError(
      'Provide a nonempty cases array with unique IDs and valid correction texts.',
    )
  }
  const parsedModels = z.array(BenchmarkModelId).min(1).safeParse(models)
  if (!parsedModels.success || new Set(parsedModels.data).size !== parsedModels.data.length) {
    throw new BenchmarkInputError(
      'Select one or more unique model IDs from the configured model list.',
    )
  }
  return {
    cases: parsedCases.data,
    models: parsedModels.data.map((id) => ({
      id,
      name: BENCHMARK_MODELS.find((model) => model.id === id)!.name,
    })),
    maxRequests: parsedCases.data.length * parsedModels.data.length,
  }
}

export type BenchmarkPlan = ReturnType<typeof prepareBenchmark>
export type BenchmarkRun = BenchmarkPlan & {
  schemaVersion: 1
  promptVersion: string
  prompt: string
  parameters: Record<string, typeof PARAMETERS>
  timeoutMs: number
  startedAt: string
  endedAt: string | null
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  errorCode: string | null
  attempts: {
    caseId: string
    modelId: string
    status: 'not-run' | 'succeeded' | 'failed'
    correctionId: string | null
    requestId: string | null
    errorCode: string | null
  }[]
}

type Options = {
  cases: unknown
  models: unknown
  outputRoot: string
  transport: CorrectionTransport
  shouldStop?: () => boolean
  onCreated?: (folder: string) => void
  onProgress?: (completed: number, maximum: number) => void
  timeoutMs?: number
}

// The CLI is user-only. Automated checks may call this helper with mocked transport.
export async function runBenchmark(options: Options) {
  let database: CorrectionDatabase | undefined
  try {
    const plan = prepareBenchmark(options.cases, options.models)
    mkdirSync(options.outputRoot, { recursive: true })
    const folder = mkdtempSync(
      join(options.outputRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-'),
    )
    options.onCreated?.(folder)
    const run: BenchmarkRun = {
      ...plan,
      schemaVersion: 1,
      promptVersion: PROMPT_VERSION,
      prompt: STRICT_PROMPT,
      parameters: Object.fromEntries(
        plan.models.map((model) => [model.id, { ...structuredClone(PARAMETERS), model: model.id }]),
      ),
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'running',
      errorCode: null,
      attempts: plan.cases.flatMap((item) =>
        plan.models.map((model) => ({
          caseId: item.id,
          modelId: model.id,
          status: 'not-run' as const,
          correctionId: null,
          requestId: null,
          errorCode: null,
        })),
      ),
    }
    const requests: Record<string, HistoryRequest> = {}
    function save() {
      writeFileSync(join(folder, 'run.json'), JSON.stringify(run, null, 2) + '\n', 'utf8')
      writeFileSync(join(folder, 'report.html'), renderBenchmarkReport(run, requests), 'utf8')
    }
    save()
    try {
      database = new CorrectionDatabase(join(folder, 'records.sqlite'))
    } catch {
      run.status = 'failed'
      run.errorCode = 'STORAGE_ERROR'
      run.endedAt = new Date().toISOString()
      save()
      return { folder, run }
    }
    const correct = createCorrectionService({
      database,
      transport: options.transport,
      available: true,
      timeoutMs: options.timeoutMs,
      allowedModelIds: plan.models.map((model) => model.id),
      rejectReasoning: false,
    })
    let completed = 0
    for (const item of plan.cases) {
      let correctionId: string | undefined
      for (const model of plan.models) {
        if (options.shouldStop?.()) {
          run.status = 'interrupted'
          break
        }
        const attempt = run.attempts[completed]!
        try {
          const result = await correct(item.text, model.id, correctionId)
          attempt.correctionId = result.correctionId
          attempt.requestId = result.requestId
          attempt.status = 'succeeded'
        } catch (error) {
          attempt.status = 'failed'
          attempt.errorCode = error instanceof AttemptError ? error.code : 'BENCHMARK_ERROR'
          attempt.correctionId =
            error instanceof AttemptError ? (error.ids?.correctionId ?? null) : null
          attempt.requestId = error instanceof AttemptError ? (error.ids?.requestId ?? null) : null
          run.status = 'failed'
          run.errorCode = attempt.errorCode
        }
        correctionId = attempt.correctionId ?? correctionId
        if (attempt.correctionId && attempt.requestId) {
          try {
            const request = database
              .getHistory(attempt.correctionId)
              ?.requests.find((value) => value.id === attempt.requestId)
            if (!request) throw new Error('Missing recorded attempt')
            requests[request.id] = request
          } catch {
            attempt.status = 'failed'
            attempt.errorCode = 'STORAGE_ERROR'
            run.status = 'failed'
            run.errorCode = 'STORAGE_ERROR'
          }
        }
        completed++
        save()
        options.onProgress?.(completed, plan.maxRequests)
        if (run.status === 'failed') break
      }
      if (run.status !== 'running') break
    }
    if (run.status === 'running') run.status = options.shouldStop?.() ? 'interrupted' : 'completed'
    run.endedAt = new Date().toISOString()
    save()
    return { folder, run }
  } finally {
    try {
      database?.close()
    } finally {
      await options.transport.close()
    }
  }
}
