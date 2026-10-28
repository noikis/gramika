import { useId, useRef, useState } from 'react'
import { MAX_INPUT_CHARACTERS, MODELS, type HistorySearchQuery } from '@gramota/contracts'
import { shortModelName } from '../../lib/history-format'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import type { HistoryFiltersState } from './history-filter-state'

export function HistoryFilters({
  search,
  filters,
  activeFilters,
  onSearchChange,
  onUpdate,
  onReset,
}: {
  search: string
  filters: HistoryFiltersState
  activeFilters: boolean
  onSearchChange: (value: string) => void
  onUpdate: (patch: Partial<HistoryFiltersState>) => void
  onReset: () => void
}) {
  const { t } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const filterPanelId = useId()
  const filterTrigger = useRef<HTMLButtonElement>(null)
  const activeFilterCount = [
    filters.model,
    filters.result !== 'all',
    filters.from,
    filters.to,
  ].filter(Boolean).length

  return (
    <form
      className="history-tools"
      onSubmit={(event) => event.preventDefault()}
      onReset={(event) => {
        event.preventDefault()
        onReset()
        filterTrigger.current?.focus()
      }}
    >
      <label className="history-field search-field">
        <span className="sr-only">{t('searchHistory')}</span>
        <Icon name="search" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
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
          aria-expanded={isOpen}
          aria-controls={filterPanelId}
          onClick={() => setIsOpen((value) => !value)}
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
              onUpdate({ sort: event.target.value as HistorySearchQuery['sort'] })
            }
          >
            <option value="newest">{t('newestFirst')}</option>
            <option value="oldest">{t('oldestFirst')}</option>
          </select>
        </label>
      </div>
      <div className="filter-fields" id={filterPanelId} hidden={!isOpen}>
        <label className="history-field">
          {t('model')}
          <select
            value={filters.model}
            onChange={(event) => onUpdate({ model: event.target.value })}
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
              onUpdate({ result: event.target.value as HistorySearchQuery['result'] })
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
            onChange={(event) => onUpdate({ from: event.target.value })}
          />
        </label>
        <label className="history-field">
          {t('to')}
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => onUpdate({ to: event.target.value })}
          />
        </label>
      </div>
    </form>
  )
}
