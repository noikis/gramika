import {
  HistoryDetail,
  HistoryFailure,
  HistoryList,
  type HistorySearchQuery,
} from '@gramota/contracts'

export async function searchHistory(query: HistorySearchQuery, signal: AbortSignal) {
  const response = await fetch('/api/history/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
    signal,
  })
  const value: unknown = await response.json()
  if (!response.ok) {
    const failure = HistoryFailure.safeParse(value)
    throw Error(
      failure.success && failure.data.error.code === 'INVALID_HISTORY_QUERY'
        ? 'Check your date range and search criteria.'
        : 'Could not load history. Please try again.',
    )
  }
  return HistoryList.parse(value)
}

export async function fetchHistoryDetail(id: string, signal: AbortSignal) {
  const response = await fetch('/api/history/' + encodeURIComponent(id), { signal })
  if (!response.ok) throw Error('History detail unavailable')
  const value = HistoryDetail.parse(await response.json())
  if (value.id !== id) throw Error('Mismatched history entry')
  return value
}

export async function deleteHistoryEntry(id: string) {
  const response = await fetch('/api/history/' + encodeURIComponent(id), { method: 'DELETE' })
  if (!response.ok && response.status !== 404) throw Error('Deletion unavailable')
}
