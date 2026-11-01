import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DictionaryPanel } from '../../src/components/dictionary/DictionaryPanel'
import { DictionaryExampleText } from '../../src/components/dictionary/DictionaryExampleText'
import { DictionaryEntryDetails } from '../../src/components/dictionary/DictionaryEntryDetails'
import { LocaleProvider } from '../../src/i18n/use-locale'
import type { DictionaryState } from '../../src/hooks/use-dictionary'

it('combines case, number and gender filters, retains them when collapsed and restores all forms', async () => {
  const dictionary: DictionaryState = {
    query: 'новый',
    status: 'ready',
    error: null,
    data: null,
    lookup: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    loadDetails: vi.fn(),
    details: {
      новый: {
        status: 'ready',
        error: null,
        data: {
          word: 'новый',
          entries: [
            {
              partOfSpeech: 'adjective',
              pronunciations: [],
              forms: [
                { form: 'новый', tags: ['nominative', 'singular', 'masculine'] },
                { form: 'новая', tags: ['nominative', 'singular', 'feminine'] },
                { form: 'новое', tags: ['nominative', 'singular', 'neuter'] },
                { form: 'новые', tags: ['nominative', 'plural'] },
                { form: 'новой', tags: ['genitive', 'singular', 'feminine'] },
              ],
            },
          ],
        },
      },
    },
  }
  const { container } = render(
    <LocaleProvider>
      <DictionaryEntryDetails word="новый" dictionary={dictionary} />
    </LocaleProvider>,
  )
  const rows = () =>
    Array.from(container.querySelectorAll('tbody tr')).map(
      (row) => row.querySelector('td')?.textContent,
    )
  await userEvent.click(screen.getByText('Forms (5)'))
  expect(rows()).toEqual(['новый', 'новая', 'новое', 'новые', 'новой'])
  await userEvent.selectOptions(screen.getByLabelText('Падеж'), 'nominative')
  await userEvent.selectOptions(screen.getByLabelText('Число'), 'singular')
  await userEvent.selectOptions(screen.getByLabelText('Род'), 'feminine')
  expect(rows()).toEqual(['новая'])
  await userEvent.selectOptions(screen.getByLabelText('Падеж'), 'genitive')
  expect(rows()).toEqual(['новой'])
  await userEvent.click(screen.getByText('Forms (5)'))
  await userEvent.click(screen.getByText('Forms (5)'))
  expect(rows()).toEqual(['новой'])
  await userEvent.selectOptions(screen.getByLabelText('Падеж'), 'nominative')
  expect(rows()).toEqual(['новая'])
  await userEvent.selectOptions(screen.getByLabelText('Род'), 'neuter')
  expect(rows()).toEqual(['новое'])
  await userEvent.selectOptions(screen.getByLabelText('Число'), 'plural')
  expect(rows()).toEqual([])
  expect(screen.getByRole('status').textContent).toBe('No forms match these filters.')
  await userEvent.selectOptions(screen.getByLabelText('Род'), '')
  expect(rows()).toEqual(['новые'])
  await userEvent.selectOptions(screen.getByLabelText('Число'), '')
  expect(rows()).toHaveLength(4)
  await userEvent.selectOptions(screen.getByLabelText('Падеж'), '')
  expect(rows()).toHaveLength(5)
  expect(dictionary.loadDetails).not.toHaveBeenCalledWith('новый', true)
})

it('preserves exact example text while emphasizing only valid annotated ranges', () => {
  const example = {
    text: '😀 Сло́во.  ',
    source: 'wiktionary' as const,
    highlights: [
      { start: 3, end: 9 },
      { start: 5, end: 8 },
      { start: 90, end: 100 },
    ],
  }
  const { container } = render(<DictionaryExampleText example={example} />)
  expect(container.textContent).toBe(example.text)
  expect(container.querySelectorAll('strong')).toHaveLength(1)
  expect(container.querySelector('strong')?.textContent).toBe('Сло́во')
})

it('shows stressed morphology and forms, plays the recording directly and reveals citations on demand', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const dictionary: DictionaryState = {
    query: 'слова',
    status: 'ready',
    error: null,
    lookup: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    loadDetails: vi.fn(),
    data: {
      query: 'слова',
      results: [
        {
          word: 'слово',
          edition: 'ru',
          matches: [
            {
              partOfSpeech: 'noun',
              form: 'сло́ва',
              grammar: { cases: ['genitive'], numbers: ['singular'], genders: ['neuter'] },
              sources: ['inflection'],
              unmappedTags: [],
            },
          ],
          definitions: [
            {
              pos: 'noun',
              language: 'ru',
              senses: [
                {
                  glosses: ['  Определение.  '],
                  tags: [],
                  examples: [
                    {
                      text: 'Нет сло́ва.',
                      source: 'wiktionary',
                      citation: '  Автор, 1900.  ',
                      highlights: [{ start: 4, end: 10 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    details: {
      слово: {
        status: 'ready',
        error: null,
        data: {
          word: 'слово',
          entries: [
            {
              partOfSpeech: 'noun',
              forms: [{ form: 'сло́ва', tags: ['genitive', 'singular', 'unknown-tag'] }],
              pronunciations: [
                { ipa: '[test]', audioUrl: 'https://audio.test/word.mp3', tags: [] },
              ],
            },
          ],
        },
      },
    },
  }
  const { container } = render(
    <LocaleProvider>
      <DictionaryPanel dictionary={dictionary} />
    </LocaleProvider>,
  )
  expect(screen.queryByText('Selected word:')).toBeNull()
  expect(container.querySelector('.dictionary-form')?.textContent).toContain('сло́ва')
  expect(container.querySelector('.dictionary-grammar')?.textContent).toContain('Родительный падеж')
  expect(dictionary.loadDetails).not.toHaveBeenCalled()
  await userEvent.click(screen.getByText('Forms (1)'))
  expect(dictionary.loadDetails).toHaveBeenCalledWith('слово')
  expect(screen.getByRole('table').textContent).not.toContain('unknown-tag')
  expect(screen.getByRole('table').textContent).toContain('Единственное число')
  expect(screen.getByRole('table').textContent).toContain('Родительный падеж')
  expect(screen.getByRole('table').textContent).not.toContain('Genitive')
  expect(play).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  expect(play).toHaveBeenCalledTimes(1)
  expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://audio.test/word.mp3')
  expect(container.querySelector('audio')?.controls).toBe(false)
  expect(container.querySelector('audio')?.hidden).toBe(true)
  expect(screen.queryByText('[test]')).toBeNull()
  expect(container.querySelector('.dictionary-pronunciation-details')).toBeNull()
  await userEvent.click(screen.getByText('Examples (1)'))
  const citation = container.querySelector('.dictionary-citation')!
  expect(citation.hasAttribute('open')).toBe(false)
  await userEvent.click(screen.getByText('source Wiktionary'))
  expect(citation.hasAttribute('open')).toBe(true)
  expect(citation.querySelector('p')?.textContent).toBe('Citation:   Автор, 1900.  ')
  expect(citation.querySelector('p span')?.textContent).toBe('  Автор, 1900.  ')
  await userEvent.click(screen.getByText('source Wiktionary'))
  expect(citation.hasAttribute('open')).toBe(false)
})

it('presents multiple analyses as alternatives instead of selecting one', () => {
  const match = {
    partOfSpeech: 'noun',
    form: 'слова',
    grammar: { numbers: ['plural' as const] },
    sources: ['inflection' as const],
    unmappedTags: [],
  }
  const dictionary: DictionaryState = {
    query: 'слова',
    status: 'ready',
    error: null,
    lookup: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
    loadDetails: vi.fn(),
    details: {},
    data: {
      query: 'слова',
      results: [
        {
          word: 'слово',
          edition: 'ru',
          matches: [match, { ...match, grammar: { cases: ['genitive'], numbers: ['singular'] } }],
          definitions: [
            {
              pos: 'noun',
              language: 'ru',
              senses: [{ glosses: ['Определение.'], tags: [], examples: [] }],
            },
          ],
        },
      ],
    },
  }
  const { container } = render(
    <LocaleProvider>
      <DictionaryPanel dictionary={dictionary} />
    </LocaleProvider>,
  )
  expect(screen.getByText('Possible word forms (2)')).toBeTruthy()
  expect(container.querySelectorAll('.dictionary-analysis')).toHaveLength(2)
  expect(container.querySelector('.dictionary-analyses')?.hasAttribute('open')).toBe(false)
})
