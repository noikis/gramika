import { notify } from '../../src/lib/notifications'
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DictionaryResponse } from '@gramota/contracts'
import { DictionaryAction } from '../../src/components/dictionary/DictionaryAction'
import { DictionaryPanel } from '../../src/components/dictionary/DictionaryPanel'
import { DictionaryExcerpt } from '../../src/components/dictionary/DictionaryExcerpt'
import { TranslationHeading } from '../../src/components/translation/TranslationHeading'
import { LocaleProvider } from '../../src/i18n/use-locale'
import { useLanguageTools } from '../../src/hooks/use-language-tools'
import { useDictionary, type DictionaryState } from '../../src/hooks/use-dictionary'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from '../../src/hooks/use-translation'
import { catalogs } from '../../src/i18n'

vi.mock('../../src/lib/notifications', () => ({ notify: vi.fn() }))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LocaleProvider>{children}</LocaleProvider>
)
const state = (data: DictionaryResponse | null = null): DictionaryState => ({
  details: {},
  loadDetails: vi.fn(),
  query: data?.query ?? '',
  data,
  status: data ? 'ready' : 'idle',
  error: null,
  lookup: vi.fn(),
  retry: vi.fn(),
  clear: vi.fn(),
})
afterEach(() => vi.unstubAllGlobals())

describe('dictionary selection actions', () => {
  it('captures pointer selection before toolbar focus changes', () => {
    const dictionary = state()
    let selected = ' «Ёлка!» '
    render(<DictionaryAction dictionary={dictionary} getSelection={() => selected} />, { wrapper })
    const button = screen.getByRole('button', { name: 'Dictionary' })
    fireEvent.pointerDown(button)
    selected = ''
    fireEvent.click(button)
    expect(dictionary.lookup).toHaveBeenCalledWith('Ёлка')
  })

  it('supports keyboard activation and gives guidance for invalid selections', async () => {
    const user = userEvent.setup()
    const dictionary = state()
    let selected = 'ко́е-как'
    render(<DictionaryAction dictionary={dictionary} getSelection={() => selected} />, { wrapper })
    await user.tab()
    await user.keyboard('{Enter}')
    expect(dictionary.lookup).toHaveBeenCalledWith('ко́е-как')
    selected = 'два слова'
    await user.keyboard(' ')
    expect(notify).toHaveBeenCalledWith('Select one Russian word to look it up.')
    expect(screen.queryByText('Select one Russian word to look it up.')).toBeNull()
    expect(dictionary.lookup).toHaveBeenCalledTimes(1)
  })

  it('does not fall back to other text when selection is missing', () => {
    const dictionary = state()
    render(<DictionaryAction dictionary={dictionary} getSelection={() => null} />, { wrapper })
    fireEvent.click(screen.getByRole('button'))
    expect(dictionary.lookup).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('Select one Russian word to look it up.')
  })

  it('scopes comparison selections to their own excerpt', () => {
    const dictionary = state()
    const { container } = render(
      <>
        <DictionaryExcerpt dictionary={dictionary}>первый</DictionaryExcerpt>
        <DictionaryExcerpt dictionary={dictionary}>второй</DictionaryExcerpt>
      </>,
      { wrapper },
    )
    const surfaces = container.querySelectorAll('div[tabindex="0"]')
    const range = document.createRange()
    range.selectNodeContents(surfaces[1])
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    fireEvent.pointerUp(surfaces[0])
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(dictionary.lookup).not.toHaveBeenCalled()
    fireEvent.pointerUp(surfaces[1])
    fireEvent.click(screen.getAllByRole('button')[1])
    expect(dictionary.lookup).toHaveBeenCalledWith('второй')
    window.getSelection()!.removeAllRanges()
  })
})

describe('dictionary presentation', () => {
  const data: DictionaryResponse = {
    query: 'защиты',
    results: [
      {
        word: 'защита',
        edition: 'ru',
        matches: [],
        definitions: [
          {
            pos: 'noun',
            language: 'ru',
            senses: [
              {
                glosses: ['  Первое; знач.\nБез изменений.  ', 'Второй глосс.'],
                tags: [],
                examples: [{ text: '  Пример.  ', source: 'wiktionary' }],
              },
              { glosses: [], tags: [], examples: [] },
              {
                glosses: ['Другое значение.'],
                tags: ['unknown-label'],
                examples: [{ text: 'Другой пример.', source: 'wiktionary' }],
              },
            ],
          },
          {
            pos: 'noun',
            language: 'ru',
            senses: [{ glosses: ['Отдельная статья.'], tags: [], examples: [] }],
          },
          { pos: null, language: 'ru', senses: [{ glosses: [], tags: [], examples: [] }] },
        ],
      },
      {
        word: 'защит',
        edition: 'ru',
        matches: [],
        definitions: [
          {
            pos: 'mystery',
            language: 'ru',
            senses: [{ glosses: ['Другая лемма.'], tags: ['participle'], examples: [] }],
          },
        ],
      },
    ],
  }

  it('keeps headwords, entries, glosses and examples separate and verbatim', async () => {
    const { container } = render(<DictionaryPanel dictionary={state(data)} />, { wrapper })
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual([
      'защита',
      'защит',
    ])
    expect(screen.getAllByRole('heading', { name: 'Noun' })).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(container.querySelector('.dictionary-verbatim')!.textContent).toBe(
      '  Первое; знач.\nБез изменений.  ',
    )
    expect(screen.getByText('unknown-label')).toBeTruthy()
    expect(screen.getByText('mystery')).toBeTruthy()
    expect(screen.getByText('Participle')).toBeTruthy()
    const examples = container.querySelectorAll<HTMLDetailsElement>('.dictionary-examples')
    expect(examples).toHaveLength(2)
    expect(examples[0].open).toBe(false)
    await userEvent.click(within(examples[0]).getByText('Examples (1)'))
    expect(examples[0].open).toBe(true)
    expect(examples[1].open).toBe(false)
    expect(examples[0].querySelector('p')!.textContent).toBe('  Пример.  ')
    expect(examples[0].querySelector('footer')!.textContent).toBe('source: Wiktionary')
    expect(examples[0].querySelector('.expand-control')).not.toBeNull()
  })

  it('treats sparse definitions as empty rather than inventing a gloss', () => {
    render(
      <DictionaryPanel
        dictionary={state({
          query: 'слово',
          results: [
            {
              word: 'слово',
              edition: 'ru',
              matches: [],
              definitions: [
                {
                  pos: null,
                  language: 'ru',
                  senses: [
                    {
                      glosses: [' '],
                      tags: ['noun'],
                      examples: [{ text: 'Пример', source: 'wiktionary' }],
                    },
                  ],
                },
              ],
            },
          ],
        })}
      />,
      { wrapper },
    )
    expect(screen.getByRole('status').textContent).toContain('No definitions found')
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.queryByText('Пример')).toBeNull()
  })

  it('shows loading, errors and explicit retry', () => {
    const dictionary = state()
    const { rerender } = render(
      <DictionaryPanel dictionary={{ ...dictionary, status: 'loading', query: 'слово' }} />,
      { wrapper },
    )
    expect(screen.getByRole('status').textContent).toContain('Looking up')
    rerender(
      <DictionaryPanel
        dictionary={{ ...dictionary, status: 'error', error: 'dictionaryTimeout', query: 'слово' }}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('timed out')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(dictionary.retry).toHaveBeenCalledTimes(1)
  })

  it('defines Russian and French dictionary labels independently of English', () => {
    expect(catalogs.ru.dictionary).toBe('Словарь')
    expect(catalogs.fr.dictionary).toBe('Dictionnaire')
    expect(catalogs.ru.dictionaryParts.participle).toBe('Причастие')
    expect(catalogs.fr.dictionaryExamples).toBe('Exemples')
  })
})

describe('shared language tools', () => {
  it('offers keyboard tabs and restores trigger focus on close', async () => {
    function Harness() {
      const tools = useLanguageTools()
      return (
        <>
          <button onClick={() => tools.open('translation')}>Open</button>
          {tools.isOpen && <TranslationHeading tools={tools} prefix="test" />}
        </>
      )
    }
    const user = userEvent.setup()
    render(<Harness />, { wrapper })
    const trigger = screen.getByText('Open')
    await user.click(trigger)
    const tab = screen.getByRole('tab', { name: 'Translation' })
    tab.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Dictionary' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Dictionary' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.activeElement).toBe(trigger)
  })

  it('retains both results across tabs and close without refetching', async () => {
    const fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes('dictionary')
                ? { query: 'слово', results: [] }
                : { text: 'Word', source: 'ru', target: 'en', scope: 'original' },
            ),
          ),
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const client = new QueryClient()
    const providers = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    )
    const { result } = renderHook(
      () => {
        const translation = useTranslation(null, 'en')
        const dictionary = useDictionary(() => translation.tools.open('dictionary'))
        return { translation, dictionary, tools: translation.tools }
      },
      { wrapper: providers },
    )
    act(() => result.current.translation.translate('original', 'слово'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    await act(() => result.current.dictionary.lookup('слово'))
    expect(result.current.tools.activeTab).toBe('dictionary')
    expect(result.current.translation.saved?.translatedText).toBe('Word')
    act(() => result.current.tools.setActiveTab('translation'))
    expect(result.current.dictionary.data?.query).toBe('слово')
    act(() => result.current.tools.close())
    act(() => result.current.tools.open('dictionary'))
    expect(result.current.dictionary.status).toBe('ready')
    expect(fetch).toHaveBeenCalledTimes(2)
    act(() => result.current.translation.clear())
    expect(result.current.tools.isOpen).toBe(true)
    expect(result.current.dictionary.data?.query).toBe('слово')
  })
})
