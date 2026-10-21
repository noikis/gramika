import { MODELS } from '@gramota/contracts'
import { OPENROUTER_REQUEST_DEFAULTS } from '../correction'

export const GEMINI_EXPLANATION_MODEL_ID = MODELS[1].id

export function explanationRequestParameters(modelId: string) {
  return {
    ...structuredClone(OPENROUTER_REQUEST_DEFAULTS),
    model: modelId,
    reasoning:
      modelId === GEMINI_EXPLANATION_MODEL_ID
        ? { effort: 'minimal' as const }
        : { ...OPENROUTER_REQUEST_DEFAULTS.reasoning },
  }
}
