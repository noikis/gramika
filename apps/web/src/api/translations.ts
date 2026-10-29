import {
  TranslationFailure,
  TranslationInput,
  TranslationSuccess,
  type TranslationErrorCode,
  type TranslationRequest,
} from '@gramota/contracts'

export class TranslationApiError extends Error {
  readonly code: TranslationErrorCode

  constructor(code: TranslationErrorCode) {
    super(code)
    this.code = code
  }
}

export async function requestTranslation(input: TranslationRequest, signal?: AbortSignal) {
  const submitted = TranslationInput.parse(input)
  const response = await fetch('/api/translations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submitted),
    signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const failure = TranslationFailure.parse(payload)
    throw new TranslationApiError(failure.error.code)
  }
  return TranslationSuccess.parse(payload)
}
