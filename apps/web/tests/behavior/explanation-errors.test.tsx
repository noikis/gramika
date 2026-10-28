import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExplanationPanel } from '../../src/components/explanations/ExplanationPanel'
import { LocaleProvider } from '../../src/i18n/use-locale'

const selection = {
  version: 2 as const,
  requestId: '00000000-0000-4000-8000-000000000002',
  kind: 'insert' as const,
  originalSpans: [],
  correctedSpans: [{ start: 6, end: 7 }],
  originalRange: { start: 6, end: 6 },
  correctedRange: { start: 6, end: 7 },
}

describe('explanation error handling', () => {
  it('uses a friendly fallback for malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })))
    render(
      <LocaleProvider>
        <ExplanationPanel selection={selection} />
      </LocaleProvider>,
    )

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Could not load the explanation. Please try again.',
      ),
    )
  })
})
