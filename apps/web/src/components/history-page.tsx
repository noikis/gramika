import { useEffect, useId, useRef, useState } from 'react'
import { HistoryDetail, HistoryList, type HistorySummary } from '@gramota/contracts'
import { formatDate, modelName } from '../lib/history-format'
import { HistoryRequest } from './history-request'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'

function HistoryEntry({ item }: { item: HistorySummary }) {
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const originalId = useId()
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
      }}
    >
      <summary>
        <span className="history-entry-summary">
          <span className="history-preview" lang="ru">
            {item.preview}
          </span>
          <span className="history-meta">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            {' · '}
            {item.models.map(modelName).join(', ') || 'Unavailable'}
          </span>
        </span>
      </summary>
      <div className="history-detail" aria-busy={loading}>
        {loading && (
          <p className="clipboard-feedback" role="status">
            Loading correction...
          </p>
        )}
        {error && (
          <div>
            <p className="history-error" role="alert">
              {error}
            </p>
            <Button type="button" variant="secondary" onClick={load}>
              Retry
            </Button>
          </div>
        )}
        {detail && (
          <>
            <div className="editor-heading">
              <h2 id={originalId}>Original</h2>
            </div>
            <Textarea
              readOnly
              className="history-original"
              aria-labelledby={originalId}
              value={detail.originalText}
              lang="ru"
              spellCheck={false}
            />
            {detail.requests.map((request) => (
              <HistoryRequest key={request.id} request={request} original={detail.originalText} />
            ))}
            {detail.requests.length === 0 && (
              <p className="clipboard-feedback">No recorded requests.</p>
            )}
          </>
        )}
      </div>
    </details>
  )
}

export function HistoryPage() {
  const [items, setItems] = useState<HistorySummary[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/history', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error('History unavailable')
        const value = HistoryList.parse(await response.json())
        if (!controller.signal.aborted) setItems(value.items)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load history. Please try again.')
      })
    return () => controller.abort()
  }, [attempt])

  return (
    <section className="history-page" aria-labelledby="history-title">
      <h1 id="history-title">History</h1>
      {items === null && !error && (
        <p className="clipboard-feedback" role="status">
          Loading history...
        </p>
      )}
      {error && (
        <div>
          <p className="history-error" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setError('')
              setAttempt((value) => value + 1)
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {items?.length === 0 && <p className="clipboard-feedback">No corrections yet.</p>}
      {items && items.length > 0 && (
        <div className="history-list">
          {items.map((item) => (
            <HistoryEntry key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
