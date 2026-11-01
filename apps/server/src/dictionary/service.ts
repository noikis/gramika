import {
  DictionaryErrorCode,
  DictionaryInput,
  DictionaryResponse,
  DictionaryDetailsInput,
  type DictionaryResult,
} from '@gramota/contracts'
import { HTTP_STATUS } from '../http-status'
import { request as undiciRequest } from 'undici'
import {
  adaptDefinitions,
  DefinitionsResponse,
  groupMatches,
  ResolveResponse,
  adaptDetails,
} from './adapter'

const DICTIONARY_TIMEOUT_MS = 3000

export class DictionaryError extends Error {
  constructor(readonly code: DictionaryErrorCode) {
    super(code)
  }
}

export type DictionaryServiceOptions = {
  url?: string
  timeoutMs?: number
}

export function createDictionaryService(
  deps: DictionaryServiceOptions,
): (word: string) => Promise<DictionaryResponse> {
  return async function lookup(word: string): Promise<DictionaryResponse> {
    const input = DictionaryInput.safeParse({ word })
    if (!input.success) throw new DictionaryError(DictionaryErrorCode.enum.INVALID_INPUT)
    if (!deps.url) throw new DictionaryError(DictionaryErrorCode.enum.DICTIONARY_FAILED)

    return withDeadline(deps, (signal) => resolveDefinitions(input.data.word, deps, signal))
  }
}

export function createDictionaryDetailsService(deps: DictionaryServiceOptions) {
  return async (word: string) => {
    const input = DictionaryDetailsInput.safeParse({ word })
    if (!input.success) throw new DictionaryError(DictionaryErrorCode.enum.INVALID_INPUT)
    if (!deps.url) throw new DictionaryError(DictionaryErrorCode.enum.DICTIONARY_FAILED)
    return withDeadline(deps, async (signal) => {
      const payload = await requestDictionaryJson(
        deps,
        `/v1/ru/word/${encodeURIComponent(input.data.word)}`,
        signal,
      )
      return payload === undefined ? { word: input.data.word, entries: [] } : adaptDetails(payload)
    })
  }
}

async function withDeadline<T>(
  deps: DictionaryServiceOptions,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new DictionaryError(DictionaryErrorCode.enum.DICTIONARY_TIMEOUT))
        controller.abort()
      }, deps.timeoutMs ?? DICTIONARY_TIMEOUT_MS)
    })
    return await Promise.race([operation(controller.signal), timeout])
  } catch (error) {
    if (error instanceof DictionaryError) throw error
    throw new DictionaryError(DictionaryErrorCode.enum.DICTIONARY_FAILED)
  } finally {
    clearTimeout(timer)
  }
}

async function requestDictionaryJson(
  deps: DictionaryServiceOptions,
  path: string,
  signal: AbortSignal,
  isResolve = false,
) {
  signal.throwIfAborted()
  const response = await undiciRequest(`${deps.url}${path}?lang=ru`, { signal })
  if (response.statusCode !== HTTP_STATUS.OK) {
    await response.body.dump()
    if (!isResolve && response.statusCode === HTTP_STATUS.NOT_FOUND) return undefined
    const code =
      isResolve && response.statusCode === HTTP_STATUS.SERVICE_UNAVAILABLE
        ? DictionaryErrorCode.enum.DICTIONARY_UNAVAILABLE
        : DictionaryErrorCode.enum.DICTIONARY_FAILED
    throw new DictionaryError(code)
  }
  return response.body.json()
}

async function resolveDefinitions(
  query: string,
  deps: DictionaryServiceOptions,
  signal: AbortSignal,
): Promise<DictionaryResponse> {
  const resolved = ResolveResponse.parse(
    await requestDictionaryJson(deps, `/v1/ru/resolve/${encodeURIComponent(query)}`, signal, true),
  )
  const results: DictionaryResult[] = []
  for (const [lemma, matches] of groupMatches(resolved)) {
    const payload = await requestDictionaryJson(
      deps,
      `/v1/ru/word/${encodeURIComponent(lemma)}/definitions`,
      signal,
    )
    if (payload === undefined) continue
    const entry = DefinitionsResponse.parse(payload)
    if (entry.definitions.length) results.push(adaptDefinitions(entry, matches))
  }
  return DictionaryResponse.parse({ query, results })
}
