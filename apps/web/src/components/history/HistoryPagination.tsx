import { HISTORY_PAGE_SIZE } from '@gramota/contracts'
import { Button } from '../ui/button'
import { useLocale } from '../../i18n/use-locale'

export function HistoryPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  const { message } = useLocale()
  return (
    <nav className="history-pagination" aria-label="History pagination">
      <small>{message('perPage', { count: HISTORY_PAGE_SIZE })}</small>
      <div className="page-buttons">
        <Button
          type="button"
          variant="ghost"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span
          aria-current="page"
          aria-label={message('pageCounter', { current: page, total: pageCount })}
        >
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="ghost"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
