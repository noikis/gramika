import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'

export function CorrectionNavigation({
  title,
  selected,
  total,
  isHistory,
  hasCurrent,
  description,
  onSelect,
}: {
  title: string
  selected: number
  total: number
  isHistory: boolean
  hasCurrent: boolean
  description: string
  onSelect: (index: number) => void
}) {
  const { t } = useLocale()
  if (total <= 1 && !(isHistory && hasCurrent)) return null
  return (
    <div
      className="correction-navigation"
      aria-label={`${title} correction navigation`}
      role="group"
    >
      {(selected > 0 || isHistory) && (
        <Button
          className="previous-correction"
          type="button"
          variant="secondary"
          onClick={() => onSelect(selected - 1)}
          aria-label={t('previous')}
          disabled={selected === 0}
        >
          <Icon name="chevronLeft" />
          <span className="navigation-label">{t('previous')}</span>
        </Button>
      )}
      <span className="correction-counter">
        <span>
          {selected + 1} / {total}
        </span>
        {isHistory && <span className="navigation-description">{description}</span>}
      </span>
      {(selected < total - 1 || isHistory) && (
        <Button
          className="next-correction"
          type="button"
          variant="secondary"
          onClick={() => onSelect(selected + 1)}
          aria-label={t('next')}
          disabled={selected === total - 1}
        >
          <span className="navigation-label">{t('next')}</span>
          <Icon name="chevronRight" />
        </Button>
      )}
    </div>
  )
}
