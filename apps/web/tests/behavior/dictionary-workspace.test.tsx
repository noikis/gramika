import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { LocaleProvider } from '../../src/i18n/use-locale'
import { WORKSPACE_STORAGE_KEY } from '../../src/lib/workspace-storage'
import { ResultView } from '../../src/components/results/ResultView'
import type { DictionaryState } from '../../src/hooks/use-dictionary'

// Exercise the real desktop shell and application lifecycle without sheet animation or speech.
vi.mock('react-modal-sheet', () => ({
  Sheet: Object.assign(() => null, {
    Container: () => null,
    Header: () => null,
    Content: () => null,
    Backdrop: () => null,
    DragIndicator: () => null,
  }),
}))
vi.mock('../../src/components/ui/speech-button', () => ({ SpeechButton: () => null }))
vi.mock('../../src/components/settings/InstallApp', () => ({ InstallApp: () => null }))
vi.mock('../../src/components/explanations/ExplanationPanel', () => ({
  ExplanationPanel: () => null,
}))
vi.mock('../../src/components/explanations/ExpressionExplanationPanel', () => ({
  ExpressionExplanationPanel: ({ actions }: { actions?: React.ReactNode }) => <>{actions}</>,
}))

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  Object.defineProperty(document, 'fonts', { configurable: true, value: new EventTarget() })
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

function start(fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </QueryClientProvider>,
  )
}

function selectWord() {
  const original = screen.getByPlaceholderText('Type or paste your text') as HTMLTextAreaElement
  fireEvent.change(original, { target: { value: 'слово' } })
  original.focus()
  original.setSelectionRange(0, 5)
  fireEvent.select(original)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Dictionary' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dictionary' }))
  return original
}

it('mounts only the active responsive drawer and retains dictionary state across resizing', async () => {
  let isMobile = false
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query === '(max-width: 720px)' && isMobile
      },
      addEventListener: (_event: string, listener: () => void) => {
        if (query === '(max-width: 720px)') listeners.add(listener)
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener)
      },
    })),
  )
  start(
    vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(url.includes('dictionary') ? { query: 'слово', results: [] } : {}),
          ),
        ),
      ),
  )
  selectWord()
  await screen.findByText('No definitions found. Dictionary coverage may be incomplete.')
  expect(document.querySelector('[data-language-tools="desktop"]')).not.toBeNull()
  act(() => {
    isMobile = true
    listeners.forEach((listener) => listener())
  })
  expect(document.querySelector('[data-language-tools="desktop"]')).toBeNull()
  act(() => {
    isMobile = false
    listeners.forEach((listener) => listener())
  })
  expect(within(screen.getByRole('tabpanel')).getByText('слово')).toBeTruthy()
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
})

it('looks up Original before correction, renders one tool panel and preserves the lookup during edits', async () => {
  const fetch = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(url.includes('dictionary') ? { query: 'слово', results: [] } : {}),
        ),
      ),
    )
  start(fetch)
  const original = selectWord()
  const panel = screen.getByRole('tabpanel')
  await within(panel).findByText('No definitions found. Dictionary coverage may be incomplete.')
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  expect(within(panel).queryByRole('textbox')).toBeNull()
  fireEvent.change(original, { target: { value: 'другое' } })
  expect(within(screen.getByRole('tabpanel')).getByText('слово')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'Translation' }))
  expect(within(screen.getByRole('tabpanel')).getAllByRole('textbox')).toHaveLength(2)
  expect(
    (
      within(screen.getByRole('tabpanel')).getByRole('textbox', {
        name: 'Русский',
      }) as HTMLTextAreaElement
    ).value,
  ).toBe('другое')
  expect(
    screen.queryByText('No definitions found. Dictionary coverage may be incomplete.'),
  ).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Dictionary' }))
  expect(
    screen.getByText('No definitions found. Dictionary coverage may be incomplete.'),
  ).toBeTruthy()
  expect(fetch.mock.calls.filter(([url]) => String(url).includes('dictionary'))).toHaveLength(1)
  expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toContain('dictionary')
})

it.each(['text', 'changes'] as const)(
  'looks up a selected word from the %s result surface',
  (view) => {
    const lookup = vi.fn()
    const dictionary: DictionaryState = {
      details: {},
      loadDetails: vi.fn(),
      query: '',
      status: 'idle',
      data: null,
      error: null,
      lookup,
      clear: vi.fn(),
      retry: vi.fn(),
    }
    render(
      <LocaleProvider>
        <ResultView
          compact
          result={{
            originalText: 'старый',
            correctedText: 'новый',
            requestId: 'test',
            mode: 'strict',
          }}
          view={view}
          onViewChange={vi.fn()}
          labelId="result"
          dictionary={dictionary}
        />
      </LocaleProvider>,
    )
    if (view === 'text') {
      const input = screen.getByRole('textbox') as HTMLTextAreaElement
      input.focus()
      input.setSelectionRange(0, 5)
      fireEvent.select(input)
    } else {
      const surface = screen.getByRole('region')
      const range = document.createRange()
      range.selectNodeContents(surface)
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
      // Touch handles update selection without a mouseup on the result.
      fireEvent(document, new Event('selectionchange'))
    }
    const action = screen.getAllByRole('button', { name: 'Dictionary' })[0]
    action.focus()
    if (view === 'changes') {
      window.getSelection()!.removeAllRanges()
      fireEvent(document, new Event('selectionchange'))
    }
    fireEvent.keyDown(action, { key: 'Enter' })
    fireEvent.click(action)
    expect(lookup).toHaveBeenCalledWith('новый')
  },
)

it.each(['new', 'clear'])(
  'allows %s during an active lookup and ignores its eventual response',
  async (operation) => {
    let finish!: (response: Response) => void
    let signal!: AbortSignal
    const fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (!url.includes('dictionary')) return Promise.resolve(new Response('{}'))
      signal = options!.signal as AbortSignal
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    })
    start(fetch)
    const original = selectWord()
    expect(screen.getByText('Looking up definitions…')).toBeTruthy()
    if (operation === 'new') fireEvent.click(screen.getByRole('button', { name: 'New correction' }))
    else {
      fireEvent.click(screen.getByLabelText('Settings'))
      fireEvent.click(screen.getByRole('button', { name: 'Clear local data' }))
    }
    expect(signal.aborted).toBe(true)
    expect(original.value).toBe('')
    await act(async () => finish(new Response(JSON.stringify({ query: 'слово', results: [] }))))
    expect(screen.queryByRole('tabpanel')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Translation' })[0])
    fireEvent.click(screen.getByRole('tab', { name: 'Dictionary' }))
    expect(
      screen.getByText('Select a Russian word in the workspace, then choose Dictionary.'),
    ).toBeTruthy()
  },
)
