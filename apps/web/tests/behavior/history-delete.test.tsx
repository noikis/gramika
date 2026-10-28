import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../../src/hooks/use-locale'
import { HistoryDelete } from '../../src/components/history-delete'

function renderDelete(onDeleted = vi.fn()) {
  return {
    onDeleted,
    ...render(
      <LocaleProvider>
        <HistoryDelete id="entry/1" onDeleted={onDeleted} />
      </LocaleProvider>,
    ),
  }
}

describe('history deletion', () => {
  it('treats a missing entry as already deleted and notifies the owner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
    const user = userEvent.setup()
    const { onDeleted } = renderDelete()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('entry/1'))
    expect(fetch).toHaveBeenCalledWith('/api/history/entry%2F1', { method: 'DELETE' })
  })

  it('keeps the confirmation open and exposes an error when deletion fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    const user = userEvent.setup()
    renderDelete()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete this entry')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })
})
