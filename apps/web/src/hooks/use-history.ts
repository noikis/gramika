import { useEffect, useState } from 'react'
import { HistoryFailure, HistoryList, type HistorySearchQuery } from '@gramota/contracts'

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
        const result = await fetch('/api/history/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })
        const value: unknown = await result.json()
        if (!result.ok) {
          const failure = HistoryFailure.safeParse(value)
          fail(
            failure.success && failure.data.error.code === 'INVALID_HISTORY_QUERY'
              ? 'Check your date range and search criteria.'
              : 'Could not load history. Please try again.',
          )
          return
        }
        const data = HistoryList.parse(value)
        if (!controller.signal.aborted) setResponse({ key, data, error: '' })
      } catch {
        fail('Could not load history. Please try again.')
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
