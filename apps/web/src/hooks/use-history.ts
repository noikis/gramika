import { useQuery } from '@tanstack/react-query'
import type { HistorySearchQuery } from '@gramota/contracts'
import { HistoryApiError, searchHistory } from '../api/history'

export function useHistory(query: HistorySearchQuery) {
  const result = useQuery({
    queryKey: ['history-search', query],
    queryFn: ({ signal }) => searchHistory(query, signal),
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return {
    data: result.data ?? null,
    loading: result.isPending,
    error:
      result.error instanceof HistoryApiError
        ? result.error.message
        : result.error
          ? 'Could not load history. Please try again.'
          : '',
    retry: () => void result.refetch(),
  }
}
