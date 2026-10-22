import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import {
  CorrectionMode,
  ModelId,
  OriginalText,
  TIMEOUT_MS,
  type ExplanationInput,
} from '@gramota/contracts'
import {
  diffText,
  isWhitespaceOnlyChange,
  whitespaceComparison,
} from '@gramota/contracts/text-diff'
import { openBenchmarkSource } from '../database'
import { CorrectionError, type CorrectionTransport, type Outcome } from '../correction'
import {
  createExplanationService,
  explanationRequestParameters,
  type ExplanationSource,
} from '../explanation'
import {
  EXPLAIN_PROMPT_VERSION,
  STRICT_EXPLAIN_PROMPT,
  REWRITE_EXPLAIN_PROMPT_VERSION,
  REWRITE_EXPLAIN_PROMPT,
} from '../explanation/prompt'
import { BenchmarkInputError } from './run'
import { renderExplanationReport } from './explain-report'

const SourceManifest = z.object({
  schemaVersion: z.literal(2),
  cases: z.array(z.object({ id: z.string().min(1), text: OriginalText })).min(1),
  attempts: z
    .array(
      z.object({
        caseId: z.string(),
        modelId: ModelId,
        mode: CorrectionMode,
        status: z.enum(['not-run', 'succeeded', 'failed']),
        requestId: z.uuid().nullable(),
        correctionId: z.uuid().nullable(),
      }),
    )
    .min(1),
})

export type ExplanationBenchmarkChange = {
  selection: ExplanationInput
  original: string
  corrected: string
  status: 'not-run' | 'succeeded' | 'failed'
  explanation: string | null
  errorCode: string | null
  details: Partial<Outcome>
  durationMs: number | null
}
export type ExplanationBenchmarkResult = {
  caseId: string
  modelId: string
  mode: CorrectionMode
  requestId: string | null
  originalText: string
  correctedText: string | null
  skipped: string | null
  changes: ExplanationBenchmarkChange[]
}
export type ExplanationBenchmarkPlan = {
  sourceFolder: string
  mode: CorrectionMode
  maxRequests: number
  results: ExplanationBenchmarkResult[]
}
export type ExplanationBenchmarkRun = ExplanationBenchmarkPlan & {
  schemaVersion: 1
  kind: 'explanation'
  isRejectReasoning: false
  prompt: { version: string; text: string }
  parameters: Record<string, ReturnType<typeof explanationRequestParameters>>
  timeoutMs: number
  startedAt: string
  endedAt: string | null
  status: 'running' | 'completed' | 'failed' | 'interrupted'
  errorCode: string | null
}

// Read-only preparation. No migrations, credentials, transport or output files.
export function prepareExplanationBenchmark(
  folder: string,
  mode: CorrectionMode = CorrectionMode.enum.strict,
): ExplanationBenchmarkPlan {
  let source: ReturnType<typeof openBenchmarkSource> | undefined
  try {
    CorrectionMode.parse(mode)
    const sourceFolder = resolve(folder)
    const manifest = SourceManifest.parse(
      JSON.parse(readFileSync(join(sourceFolder, 'run.json'), 'utf8')),
    )
    const cases = new Map(manifest.cases.map((item) => [item.id, item.text]))
    if (cases.size !== manifest.cases.length) throw new Error('Duplicate source case')
    source = openBenchmarkSource(join(sourceFolder, 'records.sqlite'))
    const seen = new Set<string>()
    const results = manifest.attempts.map((attempt): ExplanationBenchmarkResult => {
      const originalText = cases.get(attempt.caseId)
      if (originalText === undefined) throw new Error('Missing source case')
      const key = JSON.stringify([attempt.caseId, attempt.modelId, attempt.mode])
      if (seen.has(key)) throw new Error('Duplicate source attempt')
      seen.add(key)
      const result: ExplanationBenchmarkResult = {
        ...attempt,
        originalText,
        correctedText: null,
        skipped: null,
        changes: [],
      }
      if (attempt.mode !== mode) result.skipped = `Not selected for this ${mode} Explain run.`
      else if (attempt.status !== 'succeeded') result.skipped = 'No successful correction result.'
      else {
        if (!attempt.requestId || !attempt.correctionId) throw new Error('Missing source identity')
        const saved = source!.get(attempt.requestId, attempt.correctionId)
        if (
          !saved ||
          saved.originalText !== originalText ||
          saved.modelId !== attempt.modelId ||
          saved.mode !== attempt.mode
        )
          throw new Error('Source manifest and database disagree')
        result.correctedText = saved.correctedText
        const segments = diffText(originalText, saved.correctedText)
        result.changes = segments.flatMap((segment, index) => {
          if (segment.kind !== 'correction') return []
          const comparison = isWhitespaceOnlyChange(segment.original, segment.corrected)
            ? whitespaceComparison(segment, segments[index + 1])
            : segment
          return [
            {
              selection: {
                requestId: attempt.requestId!,
                originalRange: {
                  start: segment.originalRange.start,
                  end: segment.originalRange.start + comparison.original.length,
                },
                correctedRange: {
                  start: segment.correctedRange.start,
                  end: segment.correctedRange.start + comparison.corrected.length,
                },
              },
              original: comparison.original,
              corrected: comparison.corrected,
              status: 'not-run' as const,
              explanation: null,
              errorCode: null,
              details: {},
              durationMs: null,
            },
          ]
        })
      }
      return result
    })
    return {
      sourceFolder,
      mode,
      results,
      maxRequests: results.reduce((sum, result) => sum + result.changes.length, 0),
    }
  } catch {
    throw new BenchmarkInputError(
      'Could not read a consistent version-2 benchmark run (run.json and records.sqlite). Source files were not modified.',
    )
  } finally {
    source?.close()
  }
}

type Options = {
  plan: ExplanationBenchmarkPlan
  outputRoot: string
  transport: CorrectionTransport
  timeoutMs?: number
  shouldStop?: () => boolean
  onCreated?: (folder: string) => void
  onProgress?: (count: number, maximum: number) => void
}

// Only tests with injected mocked transport may invoke this helper automatically.
export async function runExplanationBenchmark(options: Options) {
  try {
    mkdirSync(options.outputRoot, { recursive: true })
    const folder = mkdtempSync(
      join(options.outputRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-'),
    )
    options.onCreated?.(folder)
    const run: ExplanationBenchmarkRun = {
      ...structuredClone(options.plan),
      schemaVersion: 1,
      kind: 'explanation',
      isRejectReasoning: false,
      prompt:
        options.plan.mode === CorrectionMode.enum.strict
          ? { version: EXPLAIN_PROMPT_VERSION, text: STRICT_EXPLAIN_PROMPT }
          : { version: REWRITE_EXPLAIN_PROMPT_VERSION, text: REWRITE_EXPLAIN_PROMPT },
      parameters: Object.fromEntries(
        options.plan.results
          .filter((result) => !result.skipped)
          .map((result) => [result.modelId, explanationRequestParameters(result.modelId)]),
      ),
      timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'running',
      errorCode: null,
    }
    const save = () => {
      writeFileSync(join(folder, 'run.json'), JSON.stringify(run, null, 2) + '\n', 'utf8')
      writeFileSync(join(folder, 'report.html'), renderExplanationReport(run), 'utf8')
    }
    save()
    let completed = 0
    for (const result of run.results) {
      if (!result.changes.length) continue
      const source: ExplanationSource = {
        originalText: result.originalText,
        correctedText: result.correctedText!,
        modelId: result.modelId,
        mode: result.mode,
      }
      // This repository is isolated to this new benchmark, never everyday history.
      const service = createExplanationService({
        repository: {
          recordAttempt() {},
          metrics: () => ({ attempts: [], legacySelections: [] }),
          getSource: () => source,
          get: () => null,
          save: (_selection, explanation) => explanation,
        },
        transport: {
          async send(body, signal, isRejectReasoning) {
            const response = await options.transport.send(body, signal, isRejectReasoning)
            current.details = response.details
            return response
          },
          close: async () => {},
        },
        isAvailable: true,
        isRejectReasoning: false,
        timeoutMs: options.timeoutMs,
      })
      let current: ExplanationBenchmarkChange
      for (current of result.changes) {
        if (options.shouldStop?.()) {
          run.status = 'interrupted'
          break
        }
        const started = performance.now()
        try {
          current.explanation = (await service.explain(current.selection)).explanation
          current.status = 'succeeded'
        } catch (error) {
          current.status = 'failed'
          current.errorCode = error instanceof CorrectionError ? error.code : 'BENCHMARK_ERROR'
          run.status = 'failed'
          run.errorCode = current.errorCode
        }
        current.durationMs = Math.max(0, Math.round(performance.now() - started))
        completed++
        save()
        options.onProgress?.(completed, run.maxRequests)
        if (run.status !== 'running') break
      }
      if (run.status !== 'running') break
    }
    if (run.status === 'running') run.status = options.shouldStop?.() ? 'interrupted' : 'completed'
    run.endedAt = new Date().toISOString()
    save()
    return { folder, run }
  } finally {
    await options.transport.close()
  }
}
