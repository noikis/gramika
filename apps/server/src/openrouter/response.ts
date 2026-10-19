import { ErrorCode } from '@gramota/contracts'
import { z } from 'zod'
import { CorrectionError, MessageRole, type Outcome, type CorrectionReply } from '../correction'
import { HTTP_STATUS } from '../http-status'

const TokenCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

const OptionalString = z.string().nullish().catch(null)
const OptionalCount = TokenCount.nullish().catch(null)
const OptionalAmount = z.number().finite().nonnegative().nullish().catch(null)
const OptionalBoolean = z.boolean().nullish().catch(null)

const Usage = z.object({
  prompt_tokens: OptionalCount,
  completion_tokens: OptionalCount,
  total_tokens: OptionalCount,
  cost: OptionalAmount,
  is_byok: OptionalBoolean,
  cost_details: z
    .object({
      upstream_inference_cost: OptionalAmount,
      upstream_inference_prompt_cost: OptionalAmount,
      upstream_inference_completions_cost: OptionalAmount,
    })
    .nullish()
    .catch(null),
  prompt_tokens_details: z
    .object({ cached_tokens: OptionalCount, cache_write_tokens: OptionalCount })
    .nullish()
    .catch(null),
  completion_tokens_details: z.object({ reasoning_tokens: OptionalCount }).nullish().catch(null),
})

const Metadata = z.object({
  id: OptionalString,
  model: OptionalString,
  provider: OptionalString,
  usage: Usage.nullish().catch(null),
  openrouter_metadata: z
    .object({
      generation_time: OptionalAmount,
      strategy: OptionalString,
      region: OptionalString,
      attempt: OptionalCount,
      is_byok: OptionalBoolean,
      endpoints: z
        .object({
          available: z
            .array(z.object({ provider: z.string(), selected: z.boolean() }).nullable().catch(null))
            .nullish()
            .catch(null),
        })
        .nullish()
        .catch(null),
    })
    .nullish()
    .catch(null),
  choices: z
    .array(z.object({ finish_reason: OptionalString }))
    .optional()
    .catch(undefined),
})

const Success = z.object({
  error: z.null().optional(),
  choices: z.tuple([
    z.object({
      finish_reason: z.literal('stop'),
      message: z.object({
        role: z.literal(MessageRole.enum.assistant),
        content: z.string().refine((text) => text.trim().length > 0),
        refusal: z.null().optional(),
        reasoning: z.string().nullish(),
        reasoning_content: z.string().nullish(),
        reasoning_details: z.array(z.unknown()).nullish(),
      }),
    }),
  ]),
})

function readResponseMetadata(data: unknown): Partial<Outcome> {
  const parsed = Metadata.safeParse(data)
  if (!parsed.success) return {}

  const { usage, openrouter_metadata: routing, ...value } = parsed.data
  const selected = routing?.endpoints?.available?.filter((endpoint) => endpoint?.selected) ?? []

  return {
    returnedModel: value.model,
    provider: selected.length === 1 ? selected[0]!.provider : value.provider,
    openrouterGenerationId: value.id,
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
    cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens,
    costUsd: usage?.cost,
    finishReason: value.choices?.[0]?.finish_reason,
    totalTokens: usage?.total_tokens,
    cacheWriteTokens: usage?.prompt_tokens_details?.cache_write_tokens,
    generationTimeMs: routing?.generation_time,
    routingStrategy: routing?.strategy,
    routingRegion: routing?.region,
    routingAttempt: routing?.attempt,
    isByok: usage?.is_byok ?? routing?.is_byok,
    upstreamInferenceCostUsd: usage?.cost_details?.upstream_inference_cost,
    upstreamPromptCostUsd: usage?.cost_details?.upstream_inference_prompt_cost,
    upstreamCompletionCostUsd: usage?.cost_details?.upstream_inference_completions_cost,
  }
}

function readCorrectionText(
  data: unknown,
  reasoningTokens: number | null | undefined,
  isRejectReasoning = true,
): string {
  const parsed = Success.safeParse(data)
  if (!parsed.success) throw new CorrectionError(ErrorCode.enum.INVALID_RESPONSE)

  const message = parsed.data.choices[0].message
  if (
    isRejectReasoning &&
    (message.reasoning ||
      message.reasoning_content ||
      message.reasoning_details?.length ||
      (reasoningTokens ?? 0) > 0)
  ) {
    throw new CorrectionError(ErrorCode.enum.REASONING_NOT_DISABLED)
  }

  return message.content
}

export type OpenRouterReply = { status: number; data: unknown }

export function parseOpenRouterReply(
  reply: OpenRouterReply,
  isRejectReasoning = true,
): CorrectionReply {
  const details = readResponseMetadata(reply.data)

  try {
    if (reply.status !== HTTP_STATUS.OK) throw new CorrectionError(ErrorCode.enum.UPSTREAM_ERROR)

    return {
      correctedText: readCorrectionText(reply.data, details.reasoningTokens, isRejectReasoning),
      details,
      errorCode: null,
    }
  } catch (error) {
    if (!(error instanceof CorrectionError)) throw error

    return { correctedText: null, details, errorCode: error.code }
  }
}
