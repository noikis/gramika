import { randomUUID } from 'node:crypto'
import {
  CorrectionMode,
  ErrorCode,
  ExplanationRequest,
  expressionExplanationSelectionKey,
  explanationSelectionKey,
  ExplanationAttempt,
  ExplanationMetricsInput,
  ModelId,
  TIMEOUT_MS,
} from '@gramota/contracts'
import { explanationSelection } from '@gramota/contracts/text-diff'
import { diffText } from '@gramota/text-diff'
import { CorrectionError, type CorrectionTransport } from '../correction'
import {
  EXPRESSION_EXPLANATION_PROMPT,
  EXPRESSION_EXPLANATION_PROMPT_VERSION,
  REWRITE_CHANGE_EXPLANATION_PROMPT,
  REWRITE_CHANGE_EXPLANATION_PROMPT_VERSION,
  STRICT_CHANGE_EXPLANATION_PROMPT,
  STRICT_CHANGE_EXPLANATION_PROMPT_VERSION,
} from './prompts'
import type { ExplanationRepository } from './types'

import { explanationRequestParameters, GEMINI_EXPLANATION_MODEL_ID } from './constants'

type Dependencies = {
  repository: ExplanationRepository | null
  transport: CorrectionTransport | null
  isAvailable: boolean
  timeoutMs?: number
  isRejectReasoning?: boolean
}

function isValidRange(text: string, range: { start: number; end: number }) {
  const isBoundary = (at: number) =>
    !(
      at > 0 &&
      at < text.length &&
      /[\uD800-\uDBFF]/u.test(text[at - 1]!) &&
      /[\uDC00-\uDFFF]/u.test(text[at]!)
    )
  return range.end <= text.length && isBoundary(range.start) && isBoundary(range.end)
}

function readStorage<T>(action: () => T): T {
  try {
    return action()
  } catch {
    throw new CorrectionError(ErrorCode.enum.STORAGE_ERROR)
  }
}

export function createExplanationService(deps: Dependencies) {
  const pending = new Map<string, Promise<string>>()

  function read(input: unknown) {
    const parsed = ExplanationRequest.safeParse(input)
    if (!parsed.success) throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    if (!deps.repository) throw new CorrectionError(ErrorCode.enum.STORAGE_ERROR)
    const selection = parsed.data
    const source = readStorage(() => deps.repository!.getSource(selection.requestId))
    const expression = 'kind' in selection && selection.kind === 'expression'
    const sourceText =
      expression && selection.source === 'original' ? source?.originalText : source?.correctedText
    const validSource =
      source &&
      CorrectionMode.safeParse(source.mode).success &&
      (expression
        ? sourceText !== undefined &&
          isValidRange(
            sourceText,
            'correctedRange' in selection ? selection.correctedRange : selection.originalRange,
          ) &&
          selection.mode === source.mode &&
          selection.value.length > 0
        : isValidRange(source.correctedText, selection.correctedRange) &&
          isValidRange(source.originalText, selection.originalRange))
    if (!validSource) throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    const original =
      'originalRange' in selection
        ? source.originalText.slice(selection.originalRange.start, selection.originalRange.end)
        : ''
    const corrected =
      'correctedRange' in selection
        ? source.correctedText.slice(selection.correctedRange.start, selection.correctedRange.end)
        : ''
    if (expression) {
      const selected = selection.source === 'original' ? original : corrected
      if (selection.mode !== source.mode || selection.value !== selected)
        throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    } else {
      const key = explanationSelectionKey(selection)
      if (
        !diffText(source.originalText, source.correctedText).groups.some(
          (group) =>
            explanationSelectionKey(explanationSelection(selection.requestId, group)) === key,
        )
      )
        throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    }
    return { selection, source, original, corrected }
  }

  function lookup(input: unknown) {
    const { selection } = read(input)
    const explanation = readStorage(() => deps.repository!.get(selection))
    return { result: explanation === null ? null : { selection, explanation } }
  }

  function metrics(input: unknown) {
    const parsed = ExplanationMetricsInput.safeParse(input)
    if (!parsed.success) throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    if (!deps.repository) throw new CorrectionError(ErrorCode.enum.STORAGE_ERROR)
    if (!readStorage(() => deps.repository!.getSource(parsed.data.requestId)))
      throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    return readStorage(() => deps.repository!.metrics(parsed.data.requestId))
  }

  async function generate(value: ReturnType<typeof read>) {
    const { selection, source, original, corrected } = value
    const expression = 'kind' in selection && selection.kind === 'expression'
    if (!deps.isAvailable || !deps.transport)
      throw new CorrectionError(ErrorCode.enum.NOT_CONFIGURED)
    if (!ModelId.safeParse(source.modelId).success)
      throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    const started = performance.now()
    let attempt = ExplanationAttempt.parse({
      id: randomUUID(),
      selection,
      requestedModel: source.modelId,
      promptVersion: expression
        ? EXPRESSION_EXPLANATION_PROMPT_VERSION
        : source.mode === CorrectionMode.enum.strict
          ? STRICT_CHANGE_EXPLANATION_PROMPT_VERSION
          : REWRITE_CHANGE_EXPLANATION_PROMPT_VERSION,
      parameters: explanationRequestParameters(source.modelId),
      status: 'pending',
      errorCode: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      appRequestTimeMs: null,
      returnedModel: null,
      provider: null,
      openrouterGenerationId: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reasoningTokens: null,
      cachedInputTokens: null,
      cacheWriteTokens: null,
      costUsd: null,
      generationTimeMs: null,
      upstreamInferenceCostUsd: null,
      upstreamPromptCostUsd: null,
      upstreamCompletionCostUsd: null,
      routingStrategy: null,
      routingRegion: null,
      routingAttempt: null,
      isByok: null,
      finishReason: null,
    })
    readStorage(() => deps.repository!.recordAttempt(attempt))
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new CorrectionError(ErrorCode.enum.TIMEOUT))
        }, deps.timeoutMs ?? TIMEOUT_MS)
      })
      const response = await Promise.race([
        deps.transport.send(
          {
            ...explanationRequestParameters(source.modelId),
            messages: [
              {
                role: 'system',
                content: expression
                  ? EXPRESSION_EXPLANATION_PROMPT
                  : source.mode === CorrectionMode.enum.strict
                    ? STRICT_CHANGE_EXPLANATION_PROMPT
                    : REWRITE_CHANGE_EXPLANATION_PROMPT,
              },
              {
                role: 'user',
                content: JSON.stringify(
                  expression
                    ? selection.source === 'original'
                      ? {
                          mode: source.mode,
                          originalText: source.originalText,
                          selectedExpression: {
                            source: selection.source,
                            range: selection.originalRange,
                            value: selection.value,
                            positionEncoding: 'UTF-16, zero-based, end-exclusive',
                          },
                          positionEncoding: 'UTF-16, zero-based, end-exclusive',
                        }
                      : {
                          mode: source.mode,
                          editedText: source.correctedText,
                          selectedExpression: {
                            source: selection.source,
                            range: selection.correctedRange,
                            value: selection.value,
                            positionEncoding: 'UTF-16, zero-based, end-exclusive',
                          },
                          positionEncoding: 'UTF-16, zero-based, end-exclusive',
                        }
                    : {
                        mode: source.mode,
                        originalText: source.originalText,
                        editedText: source.correctedText,
                        selectedChange: {
                          kind: selection.kind,
                          originalFragments: selection.originalSpans.map((range) => ({
                            range,
                            text: source.originalText.slice(range.start, range.end),
                          })),
                          editedFragments: selection.correctedSpans.map((range) => ({
                            range,
                            text: source.correctedText.slice(range.start, range.end),
                          })),
                          positionEncoding: 'UTF-16, zero-based, end-exclusive',
                        },
                        comparisonContext: {
                          originalFragment: original,
                          editedFragment: corrected,
                          originalRange: selection.originalRange,
                          editedRange: selection.correctedRange,
                        },
                      },
                ),
              },
            ],
          },
          controller.signal,
          deps.isRejectReasoning ?? source.modelId !== GEMINI_EXPLANATION_MODEL_ID,
        ),
        timeout,
      ])
      // Only schema-listed metrics are retained; response text and reasoning never enter this record.
      const details = Object.fromEntries(
        Object.entries(response.details).filter(
          ([key, value]) =>
            key in attempt && value !== undefined && !['status', 'errorCode'].includes(key),
        ),
      )
      attempt = ExplanationAttempt.parse({
        ...attempt,
        ...details,
        selection,
        id: attempt.id,
        requestedModel: source.modelId,
        parameters: attempt.parameters,
        promptVersion: attempt.promptVersion,
        startedAt: attempt.startedAt,
        status: 'pending',
        errorCode: null,
      })
      if (response.errorCode) throw new CorrectionError(response.errorCode)
      if (!response.correctedText?.trim())
        throw new CorrectionError(ErrorCode.enum.INVALID_RESPONSE)
      // The user may delete the parent history entry while the model is running.
      read(selection)
      const explanation = readStorage(() =>
        deps.repository!.save(selection, response.correctedText!),
      )
      attempt = { ...attempt, status: 'succeeded' }
      return explanation
    } catch (error) {
      const failure =
        error instanceof CorrectionError
          ? error
          : new CorrectionError(ErrorCode.enum.UPSTREAM_ERROR)
      attempt = { ...attempt, status: 'failed', errorCode: failure.code }
      throw failure
    } finally {
      clearTimeout(timer)
      readStorage(() =>
        deps.repository!.recordAttempt({
          ...attempt,
          endedAt: new Date().toISOString(),
          appRequestTimeMs: performance.now() - started,
        }),
      )
    }
  }

  async function explain(input: unknown) {
    const value = read(input)
    const saved = readStorage(() => deps.repository!.get(value.selection))
    if (saved !== null) return { selection: value.selection, explanation: saved }
    const key = JSON.stringify([
      value.selection.requestId,
      'kind' in value.selection && value.selection.kind === 'expression'
        ? expressionExplanationSelectionKey(value.selection)
        : explanationSelectionKey(value.selection),
    ])
    let task = pending.get(key)
    if (!task) {
      task = generate(value)
      pending.set(key, task)
    }
    try {
      const explanation = await task
      read(value.selection)
      return { selection: value.selection, explanation }
    } finally {
      if (pending.get(key) === task) pending.delete(key)
    }
  }

  return { lookup, explain, metrics }
}
