import { useEffect, useState } from 'react'
import { HistoryList, type HistorySearchQuery } from '@gramota/contracts'
import { searchHistory } from '../api/history'

type HistoryResponse = {
  key: string
  data: ReturnType<typeof HistoryList.parse> | null
  error: string
}

export function useHistory(query: HistorySearchQuery) {
  const [response, setResponse] = useState<HistoryResponse | null>(null)
  const [attempt, setAttempt] = useState(0)
  const body = JSON.stringify(query)
  const key = `${attempt}:${body}`

  useEffect(() => {
    const controller = new AbortController()
    function fail(error: string) {
      if (!controller.signal.aborted) {
        setResponse((previous) => ({ key, data: previous?.data ?? null, error }))
      }
    }
    async function load() {
      try {
        const data = await searchHistory(JSON.parse(body) as HistorySearchQuery, controller.signal)
        if (!controller.signal.aborted) setResponse({ key, data, error: '' })
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : 'Could not load history. Please try again.')
      }
    }
    void load()
    return () => controller.abort()
  }, [body, key])

  const current = response?.key === key ? response : null
  return {
    data: current?.error ? null : (current?.data ?? null),
    loading: current === null,
    error: current?.error ?? '',
    retry: () => setAttempt((value) => value + 1),
  }
}
