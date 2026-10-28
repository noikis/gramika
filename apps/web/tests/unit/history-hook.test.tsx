import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { useHistory } from '../../src/hooks/use-history'

const historyResponse = { items: [], total: 0, page: 2, models: [] }

describe('useHistory', () => {
  it('posts the supplied search filters and retries only when requested', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(historyResponse), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const query = {
      search: 'мир',
      model: '',
      result: 'all' as const,
      from: null,
      to: null,
      sort: 'newest' as const,
      page: 2,
    }

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      },
    })
    const { result } = renderHook(() => useHistory(query), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await waitFor(() => expect(result.current.data).toEqual(historyResponse))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify(query),
    })

    result.current.retry()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('hides unexpected response parsing errors behind the friendly fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const query = {
      search: 'broken',
      model: '',
      result: 'all' as const,
      from: null,
      to: null,
      sort: 'newest' as const,
      page: 1,
    }
    const { result } = renderHook(() => useHistory(query), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    await waitFor(() =>
      expect(result.current.error).toBe('Could not load history. Please try again.'),
    )
  })
})
