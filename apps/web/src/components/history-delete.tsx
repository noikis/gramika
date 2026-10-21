import { useRef, useState } from 'react'
import { Button } from './ui/button'
import { notify } from '../lib/notifications'

export function HistoryDelete({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const isSending = useRef(false)

  async function remove() {
    if (isSending.current) return
    isSending.current = true
    setIsDeleting(true)
    setError('')
    try {
      const response = await fetch('/api/history/' + encodeURIComponent(id), { method: 'DELETE' })
      if (!response.ok && response.status !== 404) throw Error('Deletion unavailable')
      notify('Entry removed from history.', true)
      onDeleted(id)
    } catch {
      setError('Could not delete this entry. Please try again.')
    } finally {
      isSending.current = false
      setIsDeleting(false)
    }
  }

  return (
    <div className="history-delete" aria-busy={isDeleting}>
      {isConfirming ? (
        <>
          <p>
            Remove this original and all its attempts from history? Stored data will be retained.
            There is no restore screen.
          </p>
          <Button type="button" variant="secondary" disabled={isDeleting} onClick={remove}>
            {isDeleting ? 'Deleting...' : 'Confirm delete'}
          </Button>{' '}
          <Button
            type="button"
            variant="ghost"
            disabled={isDeleting}
            onClick={() => {
              setIsConfirming(false)
              setError('')
            }}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setIsConfirming(true)}>
          Delete entry
        </Button>
      )}
      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
