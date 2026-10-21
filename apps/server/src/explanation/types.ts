import type { ExplanationInput } from '@gramota/contracts'

export type ExplanationSource = {
  originalText: string
  correctedText: string
  modelId: string
  mode: string
}

export interface ExplanationRepository {
  getSource(requestId: string): ExplanationSource | null
  get(selection: ExplanationInput): string | null
  save(selection: ExplanationInput, explanation: string): string
}
