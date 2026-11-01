import {
  DictionaryInput,
  DictionaryResponse,
  DictionaryFailure,
  DictionaryDetailsInput,
  DictionaryDetailsResponse,
  type DictionaryErrorCode,
} from '@gramota/contracts'

export class DictionaryApiError extends Error {
  readonly code: DictionaryErrorCode

  constructor(code: DictionaryErrorCode) {
    super(code)
    this.code = code
  }
}

export async function requestDictionary(word: string, signal?: AbortSignal) {
  return DictionaryResponse.parse(
    await request('/api/dictionary/lookup', DictionaryInput.parse({ word }), signal),
  )
}

export async function requestDictionaryDetails(word: string, signal?: AbortSignal) {
  return DictionaryDetailsResponse.parse(
    await request('/api/dictionary/details', DictionaryDetailsInput.parse({ word }), signal),
  )
}

async function request(path: string, input: { word: string }, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    throw new DictionaryApiError(DictionaryFailure.parse(payload).error.code)
  }
  return payload
}
