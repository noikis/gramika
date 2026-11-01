import { useEffect, useRef, useState } from 'react'
import {
  DictionaryErrorCode,
  RussianWord,
  type DictionaryResponse,
  type DictionaryDetailsResponse,
} from '@gramota/contracts'
import { DictionaryApiError, requestDictionary, requestDictionaryDetails } from '../api/dictionary'

export type DictionaryDetailsState = {
  status: 'loading' | 'ready' | 'error'
  data: DictionaryDetailsResponse | null
  error: LookupState['error']
}

type LookupState = {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: DictionaryResponse | null
  error:
    'dictionaryInvalid' | 'dictionaryTimeout' | 'dictionaryUnavailable' | 'dictionaryFailed' | null
}
const INITIAL: LookupState = { query: '', status: 'idle', data: null, error: null }
const ERROR_MESSAGES = {
  [DictionaryErrorCode.enum.INVALID_INPUT]: 'dictionaryInvalid',
  [DictionaryErrorCode.enum.DICTIONARY_TIMEOUT]: 'dictionaryTimeout',
  [DictionaryErrorCode.enum.DICTIONARY_UNAVAILABLE]: 'dictionaryUnavailable',
  [DictionaryErrorCode.enum.DICTIONARY_FAILED]: 'dictionaryFailed',
} as const

export function useDictionary(onOpen: () => void) {
  const [state, setState] = useState<LookupState>(INITIAL)
  const controller = useRef<AbortController | null>(null)
  const identity = useRef(0)
  const [details, setDetails] = useState<Record<string, DictionaryDetailsState>>({})
  const detailsControllers = useRef(new Map<string, AbortController>())
  useEffect(
    () => () => {
      identity.current++
      controller.current?.abort()
      detailsControllers.current.forEach((active) => active.abort())
    },
    [],
  )

  async function lookup(word: string) {
    const parsed = RussianWord.safeParse(word)
    if (!parsed.success) return
    controller.current?.abort()
    detailsControllers.current.forEach((active) => active.abort())
    detailsControllers.current.clear()
    setDetails({})
    const current = ++identity.current
    const active = new AbortController()
    controller.current = active
    setState({ query: parsed.data, status: 'loading', data: null, error: null })
    onOpen()
    try {
      const data = await requestDictionary(parsed.data, active.signal)
      if (current === identity.current) {
        setState({ query: parsed.data, status: 'ready', data, error: null })
      }
    } catch (error) {
      if (current !== identity.current) return
      const code = error instanceof DictionaryApiError ? error.code : null
      setState({
        query: parsed.data,
        status: 'error',
        data: null,
        error: code ? ERROR_MESSAGES[code] : 'dictionaryFailed',
      })
    }
  }

  function clear() {
    identity.current++
    controller.current?.abort()
    controller.current = null
    detailsControllers.current.forEach((active) => active.abort())
    detailsControllers.current.clear()
    setDetails({})
    setState(INITIAL)
  }

  async function loadDetails(word: string, isRetry = false) {
    if (detailsControllers.current.has(word)) return
    if (!isRetry && details[word]) return details[word].data ?? undefined
    const current = identity.current
    const active = new AbortController()
    detailsControllers.current.set(word, active)
    setDetails((previous) => ({
      ...previous,
      [word]: { status: 'loading', data: null, error: null },
    }))
    try {
      const data = await requestDictionaryDetails(word, active.signal)
      if (current === identity.current) {
        setDetails((previous) => ({ ...previous, [word]: { status: 'ready', data, error: null } }))
        return data
      }
    } catch (error) {
      if (current !== identity.current) return
      const code = error instanceof DictionaryApiError ? error.code : null
      setDetails((previous) => ({
        ...previous,
        [word]: {
          status: 'error',
          data: null,
          error: code ? ERROR_MESSAGES[code] : 'dictionaryFailed',
        },
      }))
    } finally {
      if (detailsControllers.current.get(word) === active) detailsControllers.current.delete(word)
    }
  }

  return { ...state, details, loadDetails, lookup, retry: () => lookup(state.query), clear }
}

export type DictionaryState = ReturnType<typeof useDictionary>
