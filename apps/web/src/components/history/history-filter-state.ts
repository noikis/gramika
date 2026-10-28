import type { HistorySearchQuery } from '@gramota/contracts'

export type HistoryFiltersState = {
  search: string
  model: string
  result: HistorySearchQuery['result']
  from: string
  to: string
  sort: HistorySearchQuery['sort']
  page: number
}

export const initialHistoryFilters: HistoryFiltersState = {
  search: '',
  model: '',
  result: 'all',
  from: '',
  to: '',
  sort: 'newest',
  page: 1,
}
