import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import type { CorrectionResult } from '@gramota/contracts'

export const CORRECTION_ID = '00000000-0000-4000-8000-000000000001'
export const REQUEST_ID = '00000000-0000-4000-8000-000000000002'

export function correctionResult(overrides: Partial<CorrectionResult> = {}): CorrectionResult {
  return {
    isCached: false,
    correctionId: CORRECTION_ID,
    requestId: REQUEST_ID,
    originalText: 'Привет мир',
    mode: 'strict',
    correctedText: 'Привет, мир',
    modelId: DEFAULT_MODEL_ID,
    ...overrides,
  }
}
