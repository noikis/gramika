import type { ExplanationAttempt, ExplanationMetrics, ExplanationRequest } from '@gramota/contracts'

export type ExplanationSource = {
  originalText: string
  correctedText: string
  modelId: string
  mode: string
}

export interface ExplanationRepository {
  getSource(requestId: string): ExplanationSource | null
  get(selection: ExplanationRequest): string | null
  save(selection: ExplanationRequest, explanation: string): string
  recordAttempt(attempt: ExplanationAttempt): void
  metrics(requestId: string): ExplanationMetrics
}
