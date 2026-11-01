import type { ChangeGroup } from '@gramota/text-diff'
import { DictionaryExcerpt } from '../dictionary/DictionaryExcerpt'
import { ExplanationPanel } from '../explanations/ExplanationPanel'
import { ComparisonExcerpt } from './ComparisonExcerpt'
import { CorrectionNavigation } from './CorrectionNavigation'
import type { ResultViewResult } from './types'
import type { ResultViewProps } from './types'
import { useLocale } from '../../i18n/use-locale'

export function CorrectionComparison({
  result,
  current,
  selection,
  compact,
  title,
  isHistory,
  selected,
  total,
  description,
  panelId,
  onSelect,
  translation,
  dictionary,
}: {
  result: ResultViewResult
  current: ChangeGroup
  selection: ReturnType<typeof import('../../lib/text-diff').explanationSelection> | null
  compact: boolean
  title: string
  isHistory: boolean
  selected: number
  total: number
  description: string
  panelId: string
  onSelect: (index: number) => void
  dictionary?: ResultViewProps['dictionary']
  translation?: ResultViewProps['translation']
}) {
  const { t } = useLocale()
  return (
    <div className={`correction-details${compact ? ' compact-inspector' : ''}`}>
      {compact ? (
        <div className="inspector-heading">
          <CorrectionNavigation
            title={title}
            selected={selected}
            total={total}
            isHistory={isHistory}
            hasCurrent
            description={description}
            onSelect={onSelect}
          />
        </div>
      ) : (
        <CorrectionNavigation
          title={title}
          selected={selected}
          total={total}
          isHistory={isHistory}
          hasCurrent
          description={description}
          onSelect={onSelect}
        />
      )}
      <div id={panelId} className="correction-comparison" role="status" aria-atomic="true">
        <span className="sr-only">
          {t('correction')} {selected + 1} / {total}.
        </span>
        {!isHistory && <p className="correction-kind">{description}</p>}
        <dl>
          <div>
            <dt>{t('original')}</dt>
            <dd>
              <DictionaryExcerpt dictionary={dictionary}>
                <ComparisonExcerpt
                  text={result.originalText}
                  range={current.originalRange}
                  spans={current.originalSpans}
                  empty={t('noOriginalText')}
                />
              </DictionaryExcerpt>
            </dd>
          </div>
          <div>
            <dt>{t('corrected')}</dt>
            <dd>
              <DictionaryExcerpt dictionary={dictionary}>
                <ComparisonExcerpt
                  text={result.correctedText}
                  range={current.correctedRange}
                  spans={current.correctedSpans}
                  empty={t('removedText')}
                />
              </DictionaryExcerpt>
            </dd>
          </div>
        </dl>
      </div>
      {selection && (
        <ExplanationPanel
          key={JSON.stringify(selection)}
          selection={selection}
          translation={translation}
        />
      )}
    </div>
  )
}
