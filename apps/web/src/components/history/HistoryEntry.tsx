import { useEffect, useId, useRef, useState } from 'react'
import { HistoryDetail, type HistorySummary, type HistorySearchQuery } from '@gramota/contracts'
import { formatDate, shortModelName } from '../../lib/history-format'
import { HistoryDelete } from '../history-delete'
import { HistoryRequest } from '../history-request'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../hooks/use-locale'

export function HistoryEntry({
  item,
  rate,
  onDeleted,
  onCopyingChange,
  filters,
}: {
  item: HistorySummary
  rate: number | null
  onDeleted: (id: string) => void
  onCopyingChange: (isCopying: boolean) => void
  filters: Pick<HistorySearchQuery, 'model' | 'result'>
}) {
  const { t, locale } = useLocale()
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const originalId = useId()
  const requests =
    detail?.requests.filter((request) => {
      if (filters.model && request.requestedModel !== filters.model) return false
      if (filters.result === 'all') return true
      if (filters.result === 'corrected' || filters.result === 'unchanged') {
        return (
          request.status === 'succeeded' &&
          (filters.result === 'unchanged'
            ? request.correctedText === detail.originalText
            : request.correctedText !== detail.originalText)
        )
      }
      return request.status === filters.result
    }) ?? []
  useEffect(
    () => () => {
      controller.current?.abort()
    },
    [],
  )

  async function load() {
    if (controller.current) return
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/history/' + encodeURIComponent(item.id), {
        signal: current.signal,
      })
      if (!response.ok) throw Error('History detail unavailable')
      const value = HistoryDetail.parse(await response.json())
      if (value.id !== item.id) throw Error('Mismatched history entry')
      if (!current.signal.aborted) setDetail(value)
    } catch {
      if (!current.signal.aborted) setError('Could not load this correction. Please try again.')
    } finally {
      if (!current.signal.aborted) {
        setLoading(false)
        controller.current = null
      }
    }
  }

  return (
    <details
      className="history-entry"
      onToggle={(event) => {
        if (event.currentTarget.open && !detail && !error) void load()
        if (!event.currentTarget.open)
          event.currentTarget
            .querySelectorAll('dialog[open]')
            .forEach((dialog) => (dialog as HTMLDialogElement).close())
      }}
    >
      <summary>
        <Icon name="history" className="history-entry-icon" />
        <span className="history-entry-summary">
          <span className="history-preview" lang="ru">
            {item.preview}
          </span>
          <span className="history-meta">
            Last used <time dateTime={item.lastUsedAt}>{formatDate(item.lastUsedAt, locale)}</time>
            {' · '}
            {item.models.map(shortModelName).join(', ') || 'Unavailable'}
          </span>
        </span>
        <span className="expand-control" aria-hidden="true" />
      </summary>
      <div className="history-detail" aria-busy={loading}>
        {(!detail || requests.length === 0) && <HistoryDelete id={item.id} onDeleted={onDeleted} />}
        {loading && (
          <p className="clipboard-feedback" role="status">
            {t('loading')}
          </p>
        )}
        {error && (
          <div>
            <p className="history-error" role="alert">
              {error}
            </p>
            <Button type="button" variant="secondary" onClick={load}>
              {t('retry')}
            </Button>
          </div>
        )}
        {detail && (
          <>
            <div className="editor-heading">
              <h2 id={originalId}>{t('original')}</h2>
            </div>
            <div
              className="history-original"
              role="region"
              aria-labelledby={originalId}
              lang="ru"
              tabIndex={0}
            >
              {detail.originalText}
            </div>
            {requests.map((request, index) => (
              <HistoryRequest
                key={request.id}
                request={request}
                original={detail.originalText}
                rate={rate}
                onCopyingChange={onCopyingChange}
                entryAction={
                  index === 0 ? <HistoryDelete id={item.id} onDeleted={onDeleted} /> : undefined
                }
                multipleResults={requests.length > 1}
              />
            ))}
            {requests.length === 0 && (
              <p className="clipboard-feedback">
                {detail.requests.length === 0 ? 'No recorded requests.' : 'No matching requests.'}
              </p>
            )}
          </>
        )}
      </div>
    </details>
  )
}
