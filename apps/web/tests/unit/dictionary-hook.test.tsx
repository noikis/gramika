import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDictionary } from '../../src/hooks/use-dictionary'
import { requestDictionary } from '../../src/api/dictionary'

const response = (query: string) => new Response(JSON.stringify({ query, results: [] }))
afterEach(() => vi.unstubAllGlobals())

describe('dictionary requests', () => {
  it('loads details only explicitly, shares an in-flight request and reuses it within the lookup', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response('слово'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ word: 'слово', entries: [] })))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useDictionary(vi.fn()))
    await act(() => result.current.lookup('слово'))
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      await Promise.all([result.current.loadDetails('слово'), result.current.loadDetails('слово')])
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe('/api/dictionary/details')
    expect(result.current.details['слово'].status).toBe('ready')
    await act(() => result.current.loadDetails('слово'))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('prevents late detail responses from restoring a cleared workspace', async () => {
    let finish!: (response: Response) => void
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response('слово'))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      )
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useDictionary(vi.fn()))
    await act(() => result.current.lookup('слово'))
    act(() => {
      void result.current.loadDetails('слово')
    })
    const signal = fetch.mock.calls[1][1].signal as AbortSignal
    act(() => result.current.clear())
    expect(signal.aborted).toBe(true)
    await act(async () => finish(new Response(JSON.stringify({ word: 'слово', entries: [] }))))
    expect(result.current.details).toEqual({})
  })

  it('keeps definition results when details fail and retries details explicitly', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response('слово'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'DICTIONARY_TIMEOUT' } }), { status: 504 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ word: 'слово', entries: [] })))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useDictionary(vi.fn()))
    await act(() => result.current.lookup('слово'))
    await act(() => result.current.loadDetails('слово'))
    expect(result.current.details['слово'].error).toBe('dictionaryTimeout')
    expect(result.current.status).toBe('ready')
    await act(() => result.current.loadDetails('слово', true))
    expect(result.current.details['слово'].status).toBe('ready')
    expect(result.current.data?.query).toBe('слово')
  })
  it('sends only the normalized word and validates responses', async () => {
    const fetch = vi.fn().mockResolvedValue(response('Ёлка'))
    vi.stubGlobal('fetch', fetch)
    await expect(requestDictionary(' «Ёлка!» ')).resolves.toEqual({ query: 'Ёлка', results: [] })
    expect(fetch.mock.calls[0][0]).toBe('/api/dictionary/lookup')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ word: 'Ёлка' })
    fetch.mockResolvedValue(new Response(JSON.stringify({ query: 'ёлка' })))
    await expect(requestDictionary('ёлка')).rejects.toThrow()
  })

  it.each(['', 'два слова', 'cлово', 'ёлка2', '123'])(
    'rejects invalid selection %j without opening or requesting',
    async (word) => {
      const fetch = vi.fn()
      const open = vi.fn()
      vi.stubGlobal('fetch', fetch)
      const { result } = renderHook(() => useDictionary(open))
      await act(() => result.current.lookup(word))
      expect(open).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.status).toBe('idle')
    },
  )

  it('ignores an older response even if transport ignores abort', async () => {
    let finishOld!: (value: Response) => void
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOld = resolve
          }),
      )
      .mockResolvedValueOnce(response('новый'))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useDictionary(vi.fn()))
    act(() => {
      void result.current.lookup('старый')
    })
    const oldSignal = fetch.mock.calls[0][1].signal as AbortSignal
    await act(() => result.current.lookup('новый'))
    expect(oldSignal.aborted).toBe(true)
    await act(async () => finishOld(response('старый')))
    expect(result.current.data?.query).toBe('новый')
  })

  it('clears immediately during lookup and prevents resurrection', async () => {
    let finish!: (value: Response) => void
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useDictionary(vi.fn()))
    act(() => {
      void result.current.lookup('слово')
    })
    act(() => result.current.clear())
    await act(async () => finish(response('слово')))
    expect(result.current.status).toBe('idle')
    expect(result.current.data).toBeNull()
  })

  it.each([
    ['DICTIONARY_TIMEOUT', 'dictionaryTimeout'],
    ['DICTIONARY_UNAVAILABLE', 'dictionaryUnavailable'],
    ['DICTIONARY_FAILED', 'dictionaryFailed'],
    ['INVALID_INPUT', 'dictionaryInvalid'],
  ])('maps %s and retries the same word only explicitly', async (code, expected) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code } }), { status: 502 }))
      .mockResolvedValueOnce(response('слово'))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useDictionary(vi.fn()))
    await act(() => result.current.lookup('слово'))
    expect(result.current.error).toBe(expected)
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(() => result.current.retry())
    expect(result.current.status).toBe('ready')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ word: 'слово' })
  })

  it('handles malformed and network failures without persisting lookup state', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Network unavailable'))
    vi.stubGlobal('fetch', fetch)
    const save = vi.spyOn(Storage.prototype, 'setItem')
    const { result, unmount } = renderHook(() => useDictionary(vi.fn()))
    await act(() => result.current.lookup('слово'))
    await waitFor(() => expect(result.current.error).toBe('dictionaryFailed'))
    expect(save).not.toHaveBeenCalled()
    unmount()
    const reopened = renderHook(() => useDictionary(vi.fn()))
    expect(reopened.result.current.status).toBe('idle')
  })
})
