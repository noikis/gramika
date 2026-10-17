import { z } from 'zod'

export const MODEL_ID = 'qwen/qwen3.5-flash-02-23'
export const MODEL_NAME = 'Qwen3.5 Flash'
export const MAX_INPUT_CHARACTERS = 5000
export const TIMEOUT_MS = 30000

export const OriginalText = z.string().refine(text => text.trim().length > 0, 'Enter some text.')
  .refine(text => Array.from(text).length <= MAX_INPUT_CHARACTERS, 'Use 5,000 characters or fewer.')
  .refine(text => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text), 'Invalid Unicode text.')
export const CorrectionInput = z.strictObject({ text: OriginalText })
export const CorrectionConfig = z.strictObject({
  modelId: z.literal(MODEL_ID), modelName: z.literal(MODEL_NAME),
  maxInputCharacters: z.literal(MAX_INPUT_CHARACTERS), timeoutMs: z.literal(TIMEOUT_MS), available: z.boolean(),
})
export const CorrectionSuccess = z.strictObject({
  correctionId: z.uuid(), requestId: z.uuid(), originalText: OriginalText,
  correctedText: z.string().refine(text => text.trim().length > 0), modelId: z.literal(MODEL_ID),
})
export const ErrorCode = z.enum(['INVALID_INPUT', 'PAYLOAD_TOO_LARGE', 'NOT_CONFIGURED',
  'STORAGE_ERROR', 'UPSTREAM_ERROR', 'INVALID_RESPONSE', 'REASONING_NOT_DISABLED', 'TIMEOUT'])
export type ErrorCode = z.infer<typeof ErrorCode>
export const CorrectionFailure = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string() }),
  correctionId: z.uuid().nullable(), requestId: z.uuid().nullable(),
})
export type CorrectionResult = z.infer<typeof CorrectionSuccess>
export type PublicConfig = z.infer<typeof CorrectionConfig>
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Enter valid text of up to 5,000 characters.',
  PAYLOAD_TOO_LARGE: 'The request is too large.', NOT_CONFIGURED: 'Correction is not configured.',
  STORAGE_ERROR: 'Could not save the correction. Please try again later.',
  UPSTREAM_ERROR: 'The correction service is unavailable. Please try again later.',
  INVALID_RESPONSE: 'The model did not return a complete correction.',
  REASONING_NOT_DISABLED: 'The model did not respect the reasoning setting.',
  TIMEOUT: 'Correction timed out. You can try again.',
}
