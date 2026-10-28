import { useEffect, useState } from 'react'
import { HISTORY_PAGE_SIZE } from '@gramota/contracts'
import { HistoryEntry } from '../components/history/HistoryEntry'
import { HistoryFilters } from '../components/history/HistoryFilters'
import {
  initialHistoryFilters,
  type HistoryFiltersState,
} from '../components/history/history-filter-state'
import { HistoryPagination } from '../components/history/HistoryPagination'
import { Button } from '../components/ui/button'
import { useHistory } from '../hooks/use-history'
import { useExchangeRate } from '../hooks/use-exchange-rate'
import { Icon } from '../components/ui/icon'
import '../styles/history.css'
import '../styles/history-details.css'
import { useLocale } from '../i18n/use-locale'

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
  const [filters, setFilters] = useState(initialHistoryFilters)
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

  function updateFilters(patch: Partial<HistoryFiltersState>) {
    setFilters((previous) => ({ ...previous, ...patch, page: 1 }))
  }

  function resetFilters() {
    setSearch('')
    setFilters((previous) => ({ ...initialHistoryFilters, sort: previous.sort }))
  }

  return (
    <section className="history-page" aria-labelledby="history-title" aria-busy={loading}>
      <h1 id="history-title">
        <Icon name="history" /> {t('history')}
      </h1>
      <HistoryFilters
        search={search}
        filters={filters}
        activeFilters={activeFilters}
        onSearchChange={setSearch}
        onUpdate={updateFilters}
        onReset={resetFilters}
      />
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
                ? message('historyRange', {
                    start: start + 1,
                    end: Math.min(start + HISTORY_PAGE_SIZE, total),
                    total,
                  })
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
              <HistoryPagination
                page={page}
                pageCount={pageCount}
                onPageChange={(nextPage) =>
                  setFilters((previous) => ({ ...previous, page: nextPage }))
                }
              />
            </>
          )}
        </>
      )}
      <small className="history-cost-note">
        {message('approximateCosts')}{' '}
        <a href="https://www.exchangerate-api.com">Rates By Exchange Rate API</a>
      </small>
    </section>
  )
}
