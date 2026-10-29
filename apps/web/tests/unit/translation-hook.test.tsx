import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../src/i18n/use-locale'
import { useTranslation } from '../../src/hooks/use-translation'

describe('translation query caching', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses a successful translation for the same scope, text and target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Hello', target: 'en', scope: 'original' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useTranslation(null, 'en'), { wrapper })

    result.current.translate('original', 'Привет')
    await waitFor(() => expect(result.current.saved?.translatedText).toBe('Hello'))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    result.current.clear()
    result.current.translate('original', 'Привет')
    await waitFor(() => expect(result.current.saved?.translatedText).toBe('Hello'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
