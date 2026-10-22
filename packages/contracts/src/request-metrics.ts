import { z } from 'zod'

const NullableCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable()
const NullableAmount = z.number().finite().nonnegative().nullable()
const NullableText = z.string().nullable()
const Timestamp = z.iso.datetime({ precision: 3 })

export const RequestMetrics = z.object({
  requestedModel: z.string(),
  returnedModel: NullableText,
  provider: NullableText,
  openrouterGenerationId: NullableText,
  promptVersion: z.string(),
  parameters: z.record(z.string(), z.json()),
  startedAt: Timestamp,
  endedAt: Timestamp.nullable(),
  appRequestTimeMs: NullableAmount,
  inputTokens: NullableCount,
  outputTokens: NullableCount,
  totalTokens: NullableCount,
  reasoningTokens: NullableCount,
  cachedInputTokens: NullableCount,
  cacheWriteTokens: NullableCount,
  costUsd: NullableAmount,
  generationTimeMs: NullableAmount,
  upstreamInferenceCostUsd: NullableAmount,
  upstreamPromptCostUsd: NullableAmount,
  upstreamCompletionCostUsd: NullableAmount,
  routingStrategy: NullableText,
  routingRegion: NullableText,
  routingAttempt: NullableCount,
  isByok: z.boolean().nullable(),
  finishReason: NullableText,
})
export type RequestMetrics = z.infer<typeof RequestMetrics>
