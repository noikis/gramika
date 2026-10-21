import { z } from 'zod'
import { ErrorCode } from './correction.js'

// Half-open UTF-16 offsets match JavaScript strings and the local diff.
export const ExplanationRange = z
  .strictObject({
    start: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    end: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .refine((range) => range.end >= range.start)

export const ExplanationInput = z.strictObject({
  requestId: z.uuid(),
  originalRange: ExplanationRange,
  correctedRange: ExplanationRange,
})
export type ExplanationInput = z.infer<typeof ExplanationInput>

export const ExplanationSuccess = z.strictObject({
  selection: ExplanationInput,
  explanation: z.string().refine((text) => text.trim().length > 0),
})
export type ExplanationResult = z.infer<typeof ExplanationSuccess>
export const ExplanationLookup = z.strictObject({
  result: ExplanationSuccess.nullable(),
})
export const ExplanationFailure = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string() }),
})
export const EXPLANATION_ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'This correction is unavailable for explanation.',
  PAYLOAD_TOO_LARGE: 'The explanation request is too large.',
  NOT_CONFIGURED: 'Explanation generation is not configured.',
  STORAGE_ERROR: 'Could not load or save the explanation. Please try again.',
  UPSTREAM_ERROR: 'Could not generate an explanation. Please try again.',
  INVALID_RESPONSE: 'The model did not return a complete explanation.',
  REASONING_NOT_DISABLED: 'The model did not respect the reasoning setting.',
  TIMEOUT: 'Explanation timed out. You can try again.',
}
