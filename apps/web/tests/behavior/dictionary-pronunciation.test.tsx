import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DictionaryPronunciationButton } from '../../src/components/dictionary/DictionaryPronunciationButton'
import { LocaleProvider } from '../../src/i18n/use-locale'
import { notify } from '../../src/lib/notifications'
import type { DictionaryState } from '../../src/hooks/use-dictionary'
import type { DictionaryDetailsResponse } from '@gramota/contracts'

vi.mock('../../src/lib/notifications', () => ({ notify: vi.fn() }))
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const data: DictionaryDetailsResponse = {
  word: 'слово',
  entries: [
    {
      partOfSpeech: null,
      forms: [],
      pronunciations: [
        { ipa: '[ipa-only]', audioUrl: null, tags: [] },
        { ipa: '[recorded]', audioUrl: 'https://audio.test/word.mp3', tags: [] },
      ],
    },
  ],
}
function state(): DictionaryState {
  return {
    query: 'слово',
    status: 'ready',
    data: null,
    error: null,
    details: {},
    loadDetails: vi.fn().mockResolvedValue(data),
    lookup: vi.fn(),
    retry: vi.fn(),
    clear: vi.fn(),
  }
}
function show(dictionary = state()) {
  return render(
    <LocaleProvider>
      <DictionaryPronunciationButton word="слово" dictionary={dictionary} />
    </LocaleProvider>,
  )
}

it('loads once on click and starts the first recording without showing IPA or a player', async () => {
  const dictionary = state()
  const { container } = show(dictionary)
  expect(dictionary.loadDetails).not.toHaveBeenCalled()
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  expect(container.querySelector('audio')?.getAttribute('src')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1))
  expect(dictionary.loadDetails).toHaveBeenCalledWith('слово', false)
  expect(container.querySelector('audio')?.getAttribute('src')).toBe('https://audio.test/word.mp3')
  expect(container.querySelector('audio')?.controls).toBe(false)
  expect(screen.queryByText('[recorded]')).toBeNull()
})

it('replays a cached recording without fetching details', async () => {
  const dictionary = state()
  dictionary.details['слово'] = { status: 'ready', data, error: null }
  show(dictionary)
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1))
  expect(dictionary.loadDetails).not.toHaveBeenCalled()
})

it('notifies when no recording is available or playback is blocked', async () => {
  const dictionary = state()
  vi.mocked(dictionary.loadDetails).mockResolvedValue({ word: 'слово', entries: [] })
  const { unmount } = show(dictionary)
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith('No pronunciation recording is available for this entry.'),
  )
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  unmount()
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
    new DOMException('Blocked', 'NotAllowedError'),
  )
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith('The pronunciation recording could not be played.'),
  )
})

it('does not start delayed audio after the drawer closes or the entry unmounts', async () => {
  let finish!: (value: DictionaryDetailsResponse) => void
  const dictionary = state()
  vi.mocked(dictionary.loadDetails).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { container, unmount } = show(dictionary)
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  container.setAttribute('inert', '')
  await act(async () => finish(data))
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  container.removeAttribute('inert')
  fireEvent.click(screen.getByRole('button', { name: 'Pronunciation' }))
  unmount()
  await act(async () => finish(data))
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
})
