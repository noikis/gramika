import { z } from 'zod'
import { ModelId } from './models.js'

export const MAX_INPUT_CHARACTERS = 5000

export const TIMEOUT_MS = 60000

export const OriginalText = z
  .string()
  .refine((text) => text.trim().length > 0, 'Enter some text.')
  .refine(
    (text) => Array.from(text).length <= MAX_INPUT_CHARACTERS,
    'Use 5,000 characters or fewer.',
  )
  .refine(
    (text) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text),
    'Invalid Unicode text.',
  )

export const CorrectionMode = z.enum(['strict', 'gentle-rewrite'])
export type CorrectionMode = z.infer<typeof CorrectionMode>

export const CorrectionInput = z.strictObject({
  text: OriginalText,
  mode: CorrectionMode.default(CorrectionMode.enum.strict),
  modelId: ModelId,
  correctionId: z.uuid().optional(),
})

export const CorrectionConfig = z.strictObject({
  modelId: ModelId.nullable(),
  models: z.array(z.strictObject({ id: ModelId, name: z.string() })),
  maxInputCharacters: z.literal(MAX_INPUT_CHARACTERS),
  timeoutMs: z.literal(TIMEOUT_MS),
  available: z.boolean(),
})
export type PublicConfig = z.infer<typeof CorrectionConfig>

export const CorrectionSuccess = z.strictObject({
  correctionId: z.uuid(),
  requestId: z.uuid(),
  originalText: OriginalText,
  mode: CorrectionMode,
  correctedText: z.string().refine((text) => text.trim().length > 0),
  modelId: ModelId,
})
export type CorrectionResult = z.infer<typeof CorrectionSuccess>

export const ErrorCode = z.enum([
  'INVALID_INPUT',
  'PAYLOAD_TOO_LARGE',
  'NOT_CONFIGURED',
  'STORAGE_ERROR',
  'UPSTREAM_ERROR',
  'INVALID_RESPONSE',
  'REASONING_NOT_DISABLED',
  'TIMEOUT',
])
export type ErrorCode = z.infer<typeof ErrorCode>

export const CorrectionFailure = z.strictObject({
  error: z.strictObject({ code: ErrorCode, message: z.string() }),
  correctionId: z.uuid().nullable(),
  requestId: z.uuid().nullable(),
})

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.enum.INVALID_INPUT]: 'Enter valid text of up to 5,000 characters.',
  [ErrorCode.enum.PAYLOAD_TOO_LARGE]: 'The request is too large.',
  [ErrorCode.enum.NOT_CONFIGURED]: 'Correction is not configured.',
  [ErrorCode.enum.STORAGE_ERROR]: 'Could not save the correction. Please try again later.',
  [ErrorCode.enum.UPSTREAM_ERROR]: 'The correction service is unavailable. Please try again later.',
  [ErrorCode.enum.INVALID_RESPONSE]: 'The model did not return a complete correction.',
  [ErrorCode.enum.REASONING_NOT_DISABLED]: 'The model did not respect the reasoning setting.',
  [ErrorCode.enum.TIMEOUT]: 'Correction timed out. You can try again.',
}
