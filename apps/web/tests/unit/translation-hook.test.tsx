import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { SavedTranslation } from '../../src/lib/workspace-storage'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../src/i18n/use-locale'
import { useTranslation } from '../../src/hooks/use-translation'

describe('translation query caching', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses a successful translation for the same scope, text and target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: 'Hello', source: 'ru', target: 'en', scope: 'original' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
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

  it('swaps languages and text when either selector matches the other', () => {
    localStorage.clear()
    const initial: SavedTranslation = {
      scope: 'original',
      sourceText: 'Hello',
      source: 'en',
      target: 'fr',
      translatedText: 'Bonjour',
    }
    localStorage.setItem('gramika.translation-target', 'fr')
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useTranslation(initial, 'en'), { wrapper })

    act(() => result.current.setSource('fr'))

    expect(result.current.source).toBe('fr')
    expect(result.current.target).toBe('en')
    expect(result.current.saved?.sourceText).toBe('Bonjour')
    expect(result.current.saved?.translatedText).toBe('Hello')
  })

  it('opens a seeded translation without sending a request', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useTranslation(null, 'en'), { wrapper })

    act(() => result.current.open('original', ' Привет '))

    expect(result.current.isOpen).toBe(true)
    expect(result.current.saved).toMatchObject({
      scope: 'original',
      sourceText: 'Привет',
      source: 'ru',
      target: 'en',
      translatedText: '',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens an empty translation editor without sending a request', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useTranslation(null, 'en'), { wrapper })

    act(() => result.current.open('original', ''))

    expect(result.current.isOpen).toBe(true)
    expect(result.current.saved?.sourceText).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swaps correctly when the target is changed to the source', () => {
    localStorage.clear()
    localStorage.setItem('gramika.translation-target', 'en')
    const initial: SavedTranslation = {
      scope: 'original',
      sourceText: 'Привет',
      source: 'ru',
      target: 'en',
      translatedText: 'Hello',
    }
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useTranslation(initial, 'en'), { wrapper })

    act(() => result.current.setTarget('ru'))

    expect(result.current.source).toBe('en')
    expect(result.current.target).toBe('ru')
    expect(result.current.saved?.sourceText).toBe('Hello')
    expect(result.current.saved?.translatedText).toBe('Привет')
  })
})
