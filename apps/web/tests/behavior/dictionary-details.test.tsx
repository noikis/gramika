import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { DictionaryPanel } from '../../src/components/dictionary/DictionaryPanel'
import { DictionaryExampleText } from '../../src/components/dictionary/DictionaryExampleText'
import { LocaleProvider } from '../../src/i18n/use-locale'
import type { DictionaryState } from '../../src/hooks/use-dictionary'

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

it('shows stressed morphology once and reveals forms, IPA, recording and citations on demand', async () => {
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
  expect(container.querySelector('.dictionary-grammar')?.textContent).toContain('Genitive')
  expect(dictionary.loadDetails).not.toHaveBeenCalled()
  await userEvent.click(screen.getByText('Forms (1)'))
  expect(dictionary.loadDetails).toHaveBeenCalledWith('слово')
  expect(screen.getByRole('table').textContent).toContain('unknown-tag')
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  const pronunciation = container.querySelector<HTMLDetailsElement>(
    '.dictionary-entry-details details:last-child',
  )!
  expect(pronunciation.open).toBe(true)
  expect(within(pronunciation).getByText('[test]')).toBeTruthy()
  expect(pronunciation.querySelector('audio')?.getAttribute('preload')).toBe('none')
  expect(pronunciation.querySelector('audio')?.autoplay).toBe(false)
  await userEvent.click(screen.getByText('Examples (1)'))
  await userEvent.click(screen.getByText('Citation'))
  expect(container.querySelector('.dictionary-citation p')?.textContent).toBe('  Автор, 1900.  ')
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
