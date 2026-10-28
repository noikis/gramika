import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import { describe, expect, it, vi } from 'vitest'
import { HistoryEntry } from '../../src/components/history/HistoryEntry'
import { LocaleProvider } from '../../src/i18n/use-locale'

const id = '00000000-0000-4000-8000-000000000003'
const item = {
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: '2026-01-01T00:00:00.000Z',
  preview: 'Привет мир',
  models: [DEFAULT_MODEL_ID],
}
const detail = {
  id,
  createdAt: item.createdAt,
  lastUsedAt: item.lastUsedAt,
  originalText: 'Привет мир',
  language: 'ru' as const,
  requests: [],
}

describe('history detail query', () => {
  it('fetches a stale cached detail when a closed entry is opened', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['history-detail', id], detail)
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <HistoryEntry
            item={item}
            rate={null}
            filters={{ model: '', result: 'all' }}
            onDeleted={() => undefined}
            onCopyingChange={() => undefined}
          />
        </LocaleProvider>
      </QueryClientProvider>,
    )

    const preview = () => screen.getByText(item.preview, { selector: '.history-preview' })
    await user.click(preview())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await user.click(preview())
    await user.click(preview())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
