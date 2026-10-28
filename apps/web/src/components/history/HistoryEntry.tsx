import { useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { HistorySummary, HistorySearchQuery } from '@gramota/contracts'
import { fetchHistoryDetail } from '../../api/history'
import { formatDate, shortModelName } from '../../lib/history-format'
import { HistoryDelete } from './HistoryDelete'
import { HistoryRequest } from './HistoryRequest'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'

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
  const [isOpen, setIsOpen] = useState(false)
  const hasOpened = useRef(false)
  const originalId = useId()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    queryKey: ['history-detail', item.id],
    queryFn: ({ signal }) => fetchHistoryDetail(item.id, signal),
    enabled: isOpen,
    staleTime: Infinity,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const detail = detailQuery.data ?? null
  const loading = detailQuery.isLoading
  const error = detailQuery.isError ? 'Could not load this correction. Please try again.' : ''
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
  return (
    <details
      className="history-entry"
      onToggle={(event) => {
        if (event.currentTarget.open && !hasOpened.current) {
          hasOpened.current = true
          void queryClient.invalidateQueries({
            queryKey: ['history-detail', item.id],
            refetchType: 'none',
          })
        }
        setIsOpen(event.currentTarget.open)
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
            <Button type="button" variant="secondary" onClick={() => void detailQuery.refetch()}>
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
