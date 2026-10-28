import { useEffect, useId, useRef, useState } from 'react'
import {
  HISTORY_PAGE_SIZE,
  MAX_INPUT_CHARACTERS,
  MODELS,
  HistoryDetail,
  type HistorySummary,
  type HistorySearchQuery,
} from '@gramota/contracts'
import { formatDate, shortModelName } from '../lib/history-format'
import { HistoryDelete } from './history-delete'
import { HistoryRequest } from './history-request'
import { Button } from './ui/button'
import { useHistory } from '../hooks/use-history'
import { useExchangeRate } from '../hooks/use-exchange-rate'
import { Icon } from './ui/icon'
import './history.css'
import { useLocale } from '../hooks/use-locale'

function HistoryEntry({
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

const initialFilters = {
  search: '',
  model: '',
  result: 'all' as HistorySearchQuery['result'],
  from: '',
  to: '',
  sort: 'newest' as HistorySearchQuery['sort'],
  page: 1,
}

function dateBoundary(value: string, nextDay = false) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (nextDay) date.setDate(date.getDate() + 1)
  return date.toISOString()
}

export function HistoryPage({
  onDeleted,
  onCopyingChange,
}: {
  onDeleted: (id: string) => void
  onCopyingChange: (isCopying: boolean) => void
}) {
  const { t, message } = useLocale()
  const rate = useExchangeRate()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const filterPanelId = useId()
  const filterTrigger = useRef<HTMLButtonElement>(null)
  const activeFilterCount = [
    filters.model,
    filters.result !== 'all',
    filters.from,
    filters.to,
  ].filter(Boolean).length
  const history = useHistory({
    ...filters,
    from: dateBoundary(filters.from),
    to: dateBoundary(filters.to, true),
  })
  const { data, loading, error } = history
  const page = data?.page ?? 1
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
  const start = (page - 1) * HISTORY_PAGE_SIZE
  const activeFilters = Boolean(
    filters.search || filters.model || filters.from || filters.to || filters.result !== 'all',
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((previous) =>
        previous.search === search.trim()
          ? previous
          : { ...previous, search: search.trim(), page: 1 },
      )
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  function updateFilters(patch: Partial<typeof initialFilters>) {
    setFilters((previous) => ({ ...previous, ...patch, page: 1 }))
  }

  function resetFilters() {
    setSearch('')
    setFilters((previous) => ({ ...initialFilters, sort: previous.sort }))
  }

  return (
    <section className="history-page" aria-labelledby="history-title" aria-busy={loading}>
      <h1 id="history-title">
        <Icon name="history" /> {t('history')}
      </h1>
      <form
        className="history-tools"
        onSubmit={(event) => event.preventDefault()}
        onReset={(event) => {
          event.preventDefault()
          resetFilters()
          filterTrigger.current?.focus()
        }}
      >
        <label className="history-field search-field">
          <span className="sr-only">{t('searchHistory')}</span>
          <Icon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={MAX_INPUT_CHARACTERS}
            placeholder={t('searchHistory')}
          />
        </label>
        <div className="history-toolbar-actions">
          <Button
            ref={filterTrigger}
            type="button"
            variant="secondary"
            className="filter-trigger"
            aria-expanded={isFiltersOpen}
            aria-controls={filterPanelId}
            onClick={() => setIsFiltersOpen((value) => !value)}
          >
            <Icon name="filters" /> {t('filters')}
            {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </Button>
          {(activeFilters || search.trim()) && (
            <Button type="reset" variant="secondary" aria-label="Reset filters" className="reset">
              <Icon name="reset" /> {t('reset')}
            </Button>
          )}
          <label className="history-field sort-field">
            <span className="sr-only">Sort by</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilters({ sort: event.target.value as HistorySearchQuery['sort'] })
              }
            >
              <option value="newest">{t('newestFirst')}</option>
              <option value="oldest">{t('oldestFirst')}</option>
            </select>
          </label>
        </div>
        <div className="filter-fields" id={filterPanelId} hidden={!isFiltersOpen}>
          <label className="history-field">
            {t('model')}
            <select
              value={filters.model}
              onChange={(event) => updateFilters({ model: event.target.value })}
            >
              <option value="">{t('allModels')}</option>
              {MODELS.map(({ id }) => (
                <option key={id} value={id}>
                  {shortModelName(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="history-field">
            {t('resultFilter')}
            <select
              value={filters.result}
              onChange={(event) =>
                updateFilters({ result: event.target.value as HistorySearchQuery['result'] })
              }
            >
              <option value="all">{t('allResults')}</option>
              <option value="corrected">{t('corrected')}</option>
              <option value="unchanged">{t('unchanged')}</option>
              <option value="failed">{t('failed')}</option>
              <option value="pending">{t('pending')}</option>
            </select>
          </label>
          <label className="history-field">
            {t('from')}
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => updateFilters({ from: event.target.value })}
            />
          </label>
          <label className="history-field">
            {t('to')}
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => updateFilters({ to: event.target.value })}
            />
          </label>
        </div>
      </form>
      {loading && (
        <p className="clipboard-feedback" role="status">
          {t('loadingHistory')}
        </p>
      )}
      {error && (
        <div>
          <p className="history-error" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" onClick={history.retry}>
            {t('retry')}
          </Button>
        </div>
      )}
      {data && !error && (
        <>
          <div className="list-heading">
            <small role="status" aria-atomic="true">
              {total
                ? message('historyRange', { start: start + 1, end: Math.min(start + HISTORY_PAGE_SIZE, total), total })
                : `0 ${message('correctionsFooter')}`}
            </small>
          </div>
          {data.items.length === 0 ? (
            <section className="history-empty">
              <h2>{activeFilters ? 'No matching corrections' : 'No corrections yet'}</h2>
              <p>{activeFilters ? t('noMatchingHint') : t('correctionsWillAppear')}</p>
              {activeFilters && (
                <Button type="button" variant="secondary" onClick={resetFilters}>
                  Clear search and filters
                </Button>
              )}
            </section>
          ) : (
            <>
              <div className="history-list" key={JSON.stringify(filters)}>
                {data.items.map((item) => (
                  <HistoryEntry
                    key={item.id}
                    item={item}
                    filters={filters}
                    rate={rate}
                    onCopyingChange={onCopyingChange}
                    onDeleted={(id) => {
                      onDeleted(id)
                      history.retry()
                    }}
                  />
                ))}
              </div>
              <nav className="history-pagination" aria-label="History pagination">
                <small>{message('perPage', { count: HISTORY_PAGE_SIZE })}</small>
                <div className="page-buttons">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={page === 1}
                    onClick={() => setFilters((previous) => ({ ...previous, page: page - 1 }))}
                  >
                    Previous
                  </Button>
                  <span aria-current="page" aria-label={message('pageCounter', { current: page, total: pageCount })}>
                    {page} / {pageCount}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={page === pageCount}
                    onClick={() => setFilters((previous) => ({ ...previous, page: page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            </>
          )}
        </>
      )}
      <small className="history-cost-note">
        {message('approximateCosts')} <a href="https://www.exchangerate-api.com">Rates By Exchange Rate API</a>
      </small>
    </section>
  )
}
