import { useId } from 'react'
import { useLocale } from '../../i18n/use-locale'
import type { ResultViewMode } from './types'

export function ResultViewToggle({
  title,
  view,
  onViewChange,
}: {
  title: string
  view: ResultViewMode
  onViewChange: (view: ResultViewMode) => void
}) {
  const { t } = useLocale()
  const groupName = useId()
  return (
    <fieldset className="result-toggle">
      <legend className="sr-only">
        {title === t('result')
          ? `${t('result')} view`
          : `${title} ${t('result').toLowerCase()} view`}
      </legend>
      {(['text', 'changes'] as const).map((mode) => (
        <label key={mode}>
          <input
            type="radio"
            name={groupName}
            value={mode}
            checked={view === mode}
            onChange={() => onViewChange(mode)}
          />
          {mode === 'text' ? t('text') : t('changes')}
        </label>
      ))}
    </fieldset>
  )
}
