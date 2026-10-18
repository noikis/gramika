import { z } from 'zod'

export const MODEL_ID = 'qwen/qwen3.5-flash-02-23'
export const MODEL_NAME = 'Qwen3.5 Flash'
export const MODELS = [
  { id: 'qwen/qwen3.7-flash', name: 'Qwen 3.7 Flash' },
  { id: 'google/gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B' },
  { id: MODEL_ID, name: MODEL_NAME },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
] as const
export const ModelId = z.enum(MODELS.map(model => model.id))
export type ModelId = z.infer<typeof ModelId>
export const ModelPreference = z.strictObject({ modelId: ModelId })
export const MAX_INPUT_CHARACTERS = 5000
export const TIMEOUT_MS = 60000

export const OriginalText = z.string().refine(text => text.trim().length > 0, 'Enter some text.')
  .refine(text => Array.from(text).length <= MAX_INPUT_CHARACTERS, 'Use 5,000 characters or fewer.')
  .refine(text => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text), 'Invalid Unicode text.')
export const CorrectionInput = z.strictObject({ text: OriginalText, modelId: ModelId, correctionId: z.uuid().optional() })
export const CorrectionConfig = z.strictObject({
  modelId: ModelId.nullable(), models: z.array(z.strictObject({ id: ModelId, name: z.string() })),
  maxInputCharacters: z.literal(MAX_INPUT_CHARACTERS), timeoutMs: z.literal(TIMEOUT_MS), available: z.boolean(),
})
export const CorrectionSuccess = z.strictObject({
  correctionId: z.uuid(), requestId: z.uuid(), originalText: OriginalText,
  correctedText: z.string().refine(text => text.trim().length > 0), modelId: ModelId,
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

const NullableCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable()
const NullableAmount = z.number().finite().nonnegative().nullable()
const NullableText = z.string().nullable()
const Timestamp = z.iso.datetime({ precision: 3 })

export const HistorySummary = z.strictObject({
  id: z.uuid(), createdAt: Timestamp, preview: z.string(), models: z.array(z.string()),
})
export const HistoryRequest = z.strictObject({
  id: z.uuid(), requestedModel: z.string(), returnedModel: NullableText,
  provider: NullableText, openrouterGenerationId: NullableText,
  promptVersion: z.string(), parameters: z.record(z.string(), z.json()),
  correctedText: NullableText, startedAt: Timestamp, endedAt: Timestamp.nullable(),
  appRequestTimeMs: NullableAmount, inputTokens: NullableCount, outputTokens: NullableCount,
  totalTokens: NullableCount, reasoningTokens: NullableCount, cachedInputTokens: NullableCount,
  cacheWriteTokens: NullableCount, costUsd: NullableAmount, generationTimeMs: NullableAmount,
  upstreamInferenceCostUsd: NullableAmount, upstreamPromptCostUsd: NullableAmount,
  upstreamCompletionCostUsd: NullableAmount, routingStrategy: NullableText, routingRegion: NullableText,
  routingAttempt: NullableCount, isByok: z.boolean().nullable(), finishReason: NullableText,
  status: z.enum(['pending', 'succeeded', 'failed']), errorCode: NullableText, errorMessage: NullableText,
}).superRefine((value, ctx) => {
  const valid = value.status === 'succeeded'
    ? value.correctedText !== null && value.correctedText.trim().length > 0 && value.endedAt !== null
      && value.appRequestTimeMs !== null && value.errorCode === null && value.errorMessage === null
    : value.correctedText === null && (value.status === 'pending'
      ? value.endedAt === null && value.appRequestTimeMs === null && value.errorCode === null && value.errorMessage === null
      : value.endedAt !== null && value.errorCode !== null && value.errorMessage !== null)
  if (!valid) ctx.addIssue({ code: 'custom', message: 'Inconsistent recorded request outcome.' })
})
export const HISTORY_PAGE_SIZE = 10
export const HistorySearchQuery = z.strictObject({
  search: z.string().trim().max(MAX_INPUT_CHARACTERS).default(''),
  model: z.string().max(500).default(''),
  result: z.enum(['all', 'corrected', 'unchanged', 'failed', 'pending']).default('all'),
  from: Timestamp.nullable().default(null),
  to: Timestamp.nullable().default(null),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
}).refine(value => value.from === null || value.to === null || value.from < value.to,
  { message: 'The start must precede the end of the date range.' })
export type HistorySearchQuery = z.infer<typeof HistorySearchQuery>
export const HistoryList = z.strictObject({
  items: z.array(HistorySummary).max(HISTORY_PAGE_SIZE),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  models: z.array(z.string()),
})
export const HistoryDetail = z.strictObject({
  id: z.uuid(), createdAt: Timestamp, originalText: z.string(), language: z.literal('ru'),
  mode: z.literal('strict'), requests: z.array(HistoryRequest),
})
export const HistoryFailure = z.strictObject({ error: z.strictObject({
  code: z.enum(['INVALID_HISTORY_ID', 'INVALID_HISTORY_QUERY', 'HISTORY_NOT_FOUND', 'HISTORY_UNAVAILABLE']), message: z.string(),
}) })
export type HistorySummary = z.infer<typeof HistorySummary>
export type HistoryRequest = z.infer<typeof HistoryRequest>
export type HistoryDetail = z.infer<typeof HistoryDetail>
