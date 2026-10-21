import { ErrorCode, ExplanationInput, ModelId, TIMEOUT_MS } from '@gramota/contracts'
import { CorrectionError, type CorrectionTransport } from '../correction'
import { STRICT_EXPLAIN_PROMPT } from './prompt'
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
    const parsed = ExplanationInput.safeParse(input)
    if (!parsed.success) throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    if (!deps.repository) throw new CorrectionError(ErrorCode.enum.STORAGE_ERROR)
    const selection = parsed.data
    const source = readStorage(() => deps.repository!.getSource(selection.requestId))
    if (
      !source ||
      source.mode !== 'strict' ||
      !isValidRange(source.originalText, selection.originalRange) ||
      !isValidRange(source.correctedText, selection.correctedRange)
    )
      throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    const original = source.originalText.slice(
      selection.originalRange.start,
      selection.originalRange.end,
    )
    const corrected = source.correctedText.slice(
      selection.correctedRange.start,
      selection.correctedRange.end,
    )
    if (original === corrected) throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
    return { selection, source, original, corrected }
  }

  function lookup(input: unknown) {
    const { selection } = read(input)
    const explanation = readStorage(() => deps.repository!.get(selection))
    return { result: explanation === null ? null : { selection, explanation } }
  }

  async function generate(value: ReturnType<typeof read>) {
    const { selection, source, original, corrected } = value
    if (!deps.isAvailable || !deps.transport)
      throw new CorrectionError(ErrorCode.enum.NOT_CONFIGURED)
    if (!ModelId.safeParse(source.modelId).success)
      throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
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
              { role: 'system', content: STRICT_EXPLAIN_PROMPT },
              {
                role: 'user',
                content: JSON.stringify({
                  mode: source.mode,
                  originalText: source.originalText,
                  editedText: source.correctedText,
                  selectedChange: {
                    originalFragment: original,
                    editedFragment: corrected,
                    originalRange: selection.originalRange,
                    editedRange: selection.correctedRange,
                    positionEncoding: 'UTF-16, zero-based, end-exclusive',
                  },
                }),
              },
            ],
          },
          controller.signal,
          deps.isRejectReasoning ?? source.modelId !== GEMINI_EXPLANATION_MODEL_ID,
        ),
        timeout,
      ])
      if (response.errorCode) throw new CorrectionError(response.errorCode)
      if (!response.correctedText?.trim())
        throw new CorrectionError(ErrorCode.enum.INVALID_RESPONSE)
      // The user may delete the parent history entry while the model is running.
      read(selection)
      return readStorage(() => deps.repository!.save(selection, response.correctedText!))
    } catch (error) {
      if (error instanceof CorrectionError) throw error
      throw new CorrectionError(ErrorCode.enum.UPSTREAM_ERROR)
    } finally {
      clearTimeout(timer)
    }
  }

  async function explain(input: unknown) {
    const value = read(input)
    const saved = readStorage(() => deps.repository!.get(value.selection))
    if (saved !== null) return { selection: value.selection, explanation: saved }
    const key = JSON.stringify(value.selection)
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

  return { lookup, explain }
}
