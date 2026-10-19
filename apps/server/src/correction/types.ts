import type { ErrorCode } from '@gramota/contracts'
import { z } from 'zod'

export const MessageRole = z.enum(['system', 'user', 'assistant'])
export type MessageRole = z.infer<typeof MessageRole>

export type Attempt = { correctionId: string; requestId: string }

export type Outcome = {
  status: 'succeeded' | 'failed'
  correctedText: string | null
  endedAt: string
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
  returnedModel?: string | null
  provider?: string | null
  openrouterGenerationId?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  reasoningTokens?: number | null
  cachedInputTokens?: number | null
  costUsd?: number | null
  finishReason?: string | null
  totalTokens?: number | null
  cacheWriteTokens?: number | null
  generationTimeMs?: number | null
  upstreamInferenceCostUsd?: number | null
  upstreamPromptCostUsd?: number | null
  upstreamCompletionCostUsd?: number | null
  routingStrategy?: string | null
  routingRegion?: string | null
  routingAttempt?: number | null
  isByok?: boolean | null
}

export type StartAttempt = {
  ids: Attempt
  originalText: string
  modelId: string
  promptVersion: string
  parameters: object
  startedAt: string
  isRepeat?: boolean
}

export interface CorrectionStore {
  beginAttempt(input: StartAttempt): void
  finishAttempt(requestId: string, outcome: Outcome): void
}

export class InvalidCorrectionReference extends Error {}

export class CorrectionError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
  }
}

export type CorrectionReply = {
  details: Partial<Outcome>
} & ({ correctedText: string; errorCode: null } | { correctedText: null; errorCode: ErrorCode })

export interface CorrectionTransport {
  send(body: object, signal: AbortSignal, isRejectReasoning?: boolean): Promise<CorrectionReply>
  close(): Promise<void>
}
