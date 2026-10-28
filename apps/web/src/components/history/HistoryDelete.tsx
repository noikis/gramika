import { useRef, useState } from 'react'
import { Button } from '../ui/button'
import { notify } from '../../lib/notifications'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import { deleteHistoryEntry } from '../../api/history'

export function HistoryDelete({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
  const { t, message } = useLocale()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const isSending = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)

  async function remove() {
    if (isSending.current) return
    isSending.current = true
    setIsDeleting(true)
    setError('')
    try {
      await deleteHistoryEntry(id)
      notify(message('historyEntryRemoved'), true)
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
        <div className="delete-confirmation">
          <p>{t('deleteConfirmation')}</p>
          <Button type="button" variant="secondary" disabled={isDeleting} onClick={remove}>
            {isDeleting ? t('deleting') : t('delete')}
          </Button>{' '}
          <Button
            type="button"
            variant="ghost"
            disabled={isDeleting}
            onClick={() => {
              setIsConfirming(false)
              setError('')
              requestAnimationFrame(() => trigger.current?.focus())
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <Button
          ref={trigger}
          type="button"
          variant="secondary"
          onClick={() => setIsConfirming(true)}
        >
          <Icon name="trash" />
          {t('delete')}
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
