import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExpressionExplanationPanel } from '../../src/components/explanations/ExpressionExplanationPanel'
import { LocaleProvider } from '../../src/i18n/use-locale'

vi.mock('../../src/components/ui/speech-button', () => ({ SpeechButton: () => null }))
afterEach(() => vi.unstubAllGlobals())

it('keeps Explain beside the text tools and places its requested result underneath', async () => {
  const selection = {
    version: 3 as const,
    requestId: '00000000-0000-4000-8000-000000000002',
    kind: 'expression' as const,
    mode: 'strict' as const,
    source: 'original' as const,
    originalRange: { start: 0, end: 5 },
    value: 'слово',
  }
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        selection,
        explanation: 'Объяснение выделенного слова.',
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const { container } = render(
    <LocaleProvider>
      <ExpressionExplanationPanel
        selection={selection}
        actions={
          <>
            <button>Read aloud</button>
            <button>Dictionary</button>
            <button>Translate</button>
          </>
        }
      />
    </LocaleProvider>,
  )
  const toolbar = container.querySelector('.expression-action-row') as HTMLElement
  expect(
    within(toolbar)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Read aloud', 'Dictionary', 'Translate', 'Explain'])
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Explain' }))
  const explanation = await screen.findByRole('status')
  expect(explanation.textContent).toBe('Объяснение выделенного слова.')
  expect(toolbar.contains(explanation)).toBe(false)
  expect(within(toolbar).getAllByRole('button')).toHaveLength(3)
  expect(fetch).toHaveBeenCalledTimes(1)
})
