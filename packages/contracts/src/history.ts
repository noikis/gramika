import { RequestMetrics } from './request-metrics.js'
import { z } from 'zod'
import { CorrectionMode, MAX_INPUT_CHARACTERS } from './correction.js'

const NullableText = z.string().nullable()

const Timestamp = z.iso.datetime({ precision: 3 })

export const HistorySummary = z.strictObject({
  lastUsedAt: Timestamp,
  id: z.uuid(),
  createdAt: Timestamp,
  preview: z.string(),
  models: z.array(z.string()),
})
export type HistorySummary = z.infer<typeof HistorySummary>

export const HistoryRequest = z
  .strictObject({
    id: z.uuid(),
    ...RequestMetrics.shape,
    mode: CorrectionMode,
    correctedText: NullableText,
    status: z.enum(['pending', 'succeeded', 'failed']),
    errorCode: NullableText,
    errorMessage: NullableText,
  })
  .superRefine((value, ctx) => {
    const valid =
      value.status === 'succeeded'
        ? value.correctedText !== null &&
          value.correctedText.trim().length > 0 &&
          value.endedAt !== null &&
          value.appRequestTimeMs !== null &&
          value.errorCode === null &&
          value.errorMessage === null
        : value.correctedText === null &&
          (value.status === 'pending'
            ? value.endedAt === null &&
              value.appRequestTimeMs === null &&
              value.errorCode === null &&
              value.errorMessage === null
            : value.endedAt !== null && value.errorCode !== null && value.errorMessage !== null)

    if (!valid)
      ctx.addIssue({
        code: 'custom',
        message: 'Inconsistent recorded request outcome.',
      })
  })
export type HistoryRequest = z.infer<typeof HistoryRequest>

export const HISTORY_PAGE_SIZE = 10

export const HistorySearchQuery = z
  .strictObject({
    search: z.string().trim().max(MAX_INPUT_CHARACTERS).default(''),
    model: z.string().max(500).default(''),
    result: z.enum(['all', 'corrected', 'unchanged', 'failed', 'pending']).default('all'),
    from: Timestamp.nullable().default(null),
    to: Timestamp.nullable().default(null),
    sort: z.enum(['newest', 'oldest']).default('newest'),
    page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  })
  .refine((value) => value.from === null || value.to === null || value.from < value.to, {
    message: 'The start must precede the end of the date range.',
  })
export type HistorySearchQuery = z.infer<typeof HistorySearchQuery>

export const HistoryList = z.strictObject({
  items: z.array(HistorySummary).max(HISTORY_PAGE_SIZE),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  page: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  models: z.array(z.string()),
})

export const HistoryDetail = z.strictObject({
  lastUsedAt: Timestamp,
  id: z.uuid(),
  createdAt: Timestamp,
  originalText: z.string(),
  language: z.literal('ru'),
  requests: z.array(HistoryRequest),
})
export type HistoryDetail = z.infer<typeof HistoryDetail>

export const HistoryErrorCode = z.enum([
  'INVALID_HISTORY_ID',
  'INVALID_HISTORY_QUERY',
  'HISTORY_NOT_FOUND',
  'HISTORY_UNAVAILABLE',
])
export type HistoryErrorCode = z.infer<typeof HistoryErrorCode>

export const HistoryFailure = z.strictObject({
  error: z.strictObject({
    code: HistoryErrorCode,
    message: z.string(),
  }),
})
