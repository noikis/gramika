import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  CorrectionMode,
  ErrorCode,
  ModelId,
  MODELS,
  OriginalText,
  TIMEOUT_MS,
  type HistoryRequest,
} from '@gramota/contracts'
import {
  AttemptError,
  createCorrectionService,
  PARAMETERS,
  PROMPT_VERSION,
  STRICT_PROMPT,
  REWRITE_PROMPT,
  REWRITE_PROMPT_VERSION,
  type CorrectionTransport,
} from '../correction'

import { SqliteDatabase } from '../database'

import { renderBenchmarkReport } from './report'

export class BenchmarkInputError extends Error {}

export const BENCHMARK_MODELS = MODELS

export function assertBenchmarkPrompt(
  version: string,
  mode: CorrectionMode = CorrectionMode.enum.strict,
) {
  const expected = mode === CorrectionMode.enum.strict ? 'strict-v3' : 'rewrite-v1'
  if (version !== expected)
    throw new BenchmarkInputError('Unexpected benchmark prompt version for ' + mode + '.')
}

export function parseBenchmarkVariants(value: string) {
  return value.split(',').map((entry) => {
    const separator = entry.lastIndexOf(':')
    return { modelId: entry.slice(0, separator).trim(), mode: entry.slice(separator + 1).trim() }
  })
}

export function prepareBenchmark(cases: unknown, models?: unknown, variants?: unknown) {
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
  if (models !== undefined && variants !== undefined)
    throw new BenchmarkInputError('Select either models or model/mode variants, not both.')
  const parsedModels = z.array(ModelId).min(1).safeParse(models)
  if (
    variants === undefined &&
    (!parsedModels.success || new Set(parsedModels.data).size !== parsedModels.data.length)
  )
    throw new BenchmarkInputError(
      'Select one or more unique model IDs from the configured model list.',
    )
  const selected = z
    .array(z.strictObject({ modelId: ModelId, mode: CorrectionMode }))
    .min(1)
    .safeParse(
      variants ??
        (parsedModels.success
          ? parsedModels.data.map((modelId) => ({ modelId, mode: CorrectionMode.enum.strict }))
          : undefined),
    )
  if (!selected.success) throw new BenchmarkInputError('Select valid model/mode variants.')
  const choices = selected.data.map(({ modelId, mode }) => ({
    id: modelId + ':' + mode,
    modelId,
    mode,
    name:
      BENCHMARK_MODELS.find((model) => model.id === modelId)!.name +
      ' · ' +
      (mode === CorrectionMode.enum.strict ? 'Strict' : 'Gentle rewrite'),
  }))
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length)
    throw new BenchmarkInputError('Duplicate model/mode variants are not allowed.')
  assertBenchmarkPrompt(REWRITE_PROMPT_VERSION, CorrectionMode.enum['gentle-rewrite'])
  return {
    cases: parsedCases.data,
    models: [...new Set(choices.map((choice) => choice.modelId))].map((id) =>
      BENCHMARK_MODELS.find((model) => model.id === id)!,
    ),
    variants: choices,
    maxRequests: parsedCases.data.length * choices.length,
  }
}

export type BenchmarkPlan = ReturnType<typeof prepareBenchmark>
export type BenchmarkRun = BenchmarkPlan & {
  schemaVersion: 2
  prompts: Partial<Record<CorrectionMode, { version: string; text: string }>>
  parameters: Record<string, typeof PARAMETERS>
  timeoutMs: number
  startedAt: string
  endedAt: string | null
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  errorCode: string | null
  attempts: {
    caseId: string
    modelId: string
    mode: CorrectionMode
    variantId: string
    status: 'not-run' | 'succeeded' | 'failed'
    correctionId: string | null
    requestId: string | null
    errorCode: string | null
  }[]
}

type Options = {
  cases: unknown
  models?: unknown
  variants?: unknown
  outputRoot: string
  transport: CorrectionTransport
  shouldStop?: () => boolean
  onCreated?: (folder: string) => void
  onProgress?: (completed: number, maximum: number) => void
  timeoutMs?: number
}

// The CLI is user-only. Automated checks may call this helper with mocked transport.
export async function runBenchmark(options: Options) {
  let database: SqliteDatabase | undefined
  try {
    const plan = prepareBenchmark(options.cases, options.models, options.variants)
    mkdirSync(options.outputRoot, { recursive: true })
    const folder = mkdtempSync(
      join(options.outputRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-'),
    )
    options.onCreated?.(folder)

    // Initialize the benchmark run state and report
    const run: BenchmarkRun = {
      ...plan,
      schemaVersion: 2,
      prompts: Object.fromEntries(
        plan.variants.map((variant) => [
          variant.mode,
          variant.mode === CorrectionMode.enum.strict
            ? { version: PROMPT_VERSION, text: STRICT_PROMPT }
            : { version: REWRITE_PROMPT_VERSION, text: REWRITE_PROMPT },
        ]),
      ),
      parameters: Object.fromEntries(
        plan.models.map((model) => [model.id, { ...structuredClone(PARAMETERS), model: model.id }]),
      ),
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'running',
      errorCode: null,
      attempts: plan.cases.flatMap((item) =>
        plan.variants.map((variant) => ({
          caseId: item.id,
          modelId: variant.modelId,
          mode: variant.mode,
          variantId: variant.id,
          status: 'not-run' as const,
          correctionId: null,
          requestId: null,
          errorCode: null,
        })),
      ),
    }
    const requests: Record<string, HistoryRequest> = {}
    // Save the initial run state and report
    function save() {
      writeFileSync(join(folder, 'run.json'), JSON.stringify(run, null, 2) + '\n', 'utf8')
      writeFileSync(join(folder, 'report.html'), renderBenchmarkReport(run, requests), 'utf8')
    }
    save()

    // Open the database for recording requests and corrections
    try {
      database = new SqliteDatabase(join(folder, 'records.sqlite'))
    } catch {
      run.status = 'failed'
      run.errorCode = ErrorCode.enum.STORAGE_ERROR
      run.endedAt = new Date().toISOString()
      save()
      return { folder, run }
    }

    const correct = createCorrectionService({
      repository: database.corrections,
      transport: options.transport,
      isAvailable: true,
      timeoutMs: options.timeoutMs,
      isRejectReasoning: false,
    })

    // Run the benchmark cases for each model
    let completed = 0
    for (const item of plan.cases) {
      let correctionId: string | undefined
      for (const variant of plan.variants) {
        if (options.shouldStop?.()) {
          run.status = 'interrupted'
          break
        }
        const attempt = run.attempts[completed]!
        try {
          const result = await correct(
            item.text,
            variant.modelId,
            correctionId,
            undefined,
            variant.mode,
          )
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
            const request = database.history
              .get(attempt.correctionId)
              ?.requests.find((value) => value.id === attempt.requestId)
            if (!request) throw new Error('Missing recorded attempt')
            requests[request.id] = request
          } catch {
            attempt.status = 'failed'
            attempt.errorCode = ErrorCode.enum.STORAGE_ERROR
            run.status = 'failed'
            run.errorCode = ErrorCode.enum.STORAGE_ERROR
          }
        }
        completed++
        save()
        options.onProgress?.(completed, plan.maxRequests)
        if (run.status === 'failed') break
      }
      if (run.status !== 'running') break
    }

    // Finalize the run status and save the report
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
