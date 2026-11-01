import { useMemo, useRef, useState } from 'react'
import type { ExpressionExplanationInput } from '@gramota/contracts'
import { ExpressionExplanationPanel } from '../explanations/ExpressionExplanationPanel'
import { Textarea } from '../ui/textarea'
import { explanationSelection, diffText } from '../../lib/text-diff'
import { correctionDescription } from '../../lib/whitespace-display'
import { useLocale } from '../../i18n/use-locale'
import { CorrectionComparison } from './CorrectionComparison'
import { ResultChanges } from './ResultChanges'
import { ResultViewToggle } from './ResultViewToggle'
import type { ResultViewProps } from './types'
import { SpeechButton } from '../ui/speech-button'
import { TranslationAction } from '../translation/TranslationAction'

export function ResultView(props: ResultViewProps) {
  return <ResultContent key={props.result.requestId} {...props} />
}

function ResultContent({
  result,
  view,
  onViewChange,
  labelId,
  title = 'Result',
  compact = false,
  actions,
  translation,
}: ResultViewProps) {
  const { t } = useLocale()
  const isHistory = !compact && Boolean(actions)
  const [selected, setSelected] = useState(0)
  const [manualSelection, setManualSelection] = useState<ExpressionExplanationInput | null>(null)
  const textSelection = useRef<{ start: number; end: number } | null>(null)
  const panelId = `${labelId}-details`
  const diff = useMemo(
    () => diffText(result.originalText, result.correctedText),
    [result.originalText, result.correctedText],
  )
  const corrections = diff.groups
  const current = corrections[selected]
  const spacingOnly = current?.kind === 'whitespace'
  const comparison = current
    ? {
        original: result.originalText.slice(current.originalRange.start, current.originalRange.end),
        corrected: result.correctedText.slice(
          current.correctedRange.start,
          current.correctedRange.end,
        ),
      }
    : null
  const selection = current ? explanationSelection(result.requestId, current) : null
  const description = comparison
    ? current.kind === 'move'
      ? 'Moved: ' +
        current.originalSpans
          .map((range) => result.originalText.slice(range.start, range.end))
          .join(' · ')
      : correctionDescription(comparison.original, comparison.corrected, spacingOnly)
    : ''

  function select(index: number) {
    if (index >= 0 && index < corrections.length) setSelected(index)
  }

  const viewToggle = <ResultViewToggle title={title} view={view} onViewChange={onViewChange} />
  const speechAction = (
    <SpeechButton
      sourceId={`result-${result.requestId}`}
      lang="ru-RU"
      getSelection={() => {
        if (view === 'changes' && manualSelection?.source === 'edited') return manualSelection.value
        const range = textSelection.current
        return range && range.start !== range.end
          ? result.correctedText.slice(
              Math.min(range.start, range.end),
              Math.max(range.start, range.end),
            )
          : null
      }}
      getText={() => {
        if (view === 'changes' && manualSelection?.source === 'edited') return manualSelection.value
        const range = textSelection.current
        return range && range.start !== range.end
          ? result.correctedText.slice(
              Math.min(range.start, range.end),
              Math.max(range.start, range.end),
            )
          : result.correctedText
      }}
    />
  )

  return (
    <>
      {compact ? (
        <h3 id={labelId} className="sr-only">
          {title}
        </h3>
      ) : actions ? (
        <div className="result-toolbar">
          <div className="editor-heading">
            <h2 id={labelId}>{title}</h2>
            {viewToggle}
          </div>
          <div className="result-toolbar-actions">{actions}</div>
        </div>
      ) : (
        <div className="editor-heading">
          <h2 id={labelId}>{title}</h2>
          {viewToggle}
        </div>
      )}
      <div className="result-content">
        {view === 'text' ? (
          <Textarea
            className="editor-input result-text"
            readOnly
            aria-labelledby={labelId}
            value={result.correctedText}
            lang="ru"
            spellCheck={false}
            onSelect={(event) => {
              const start = event.currentTarget.selectionStart
              const end = event.currentTarget.selectionEnd
              textSelection.current = { start, end }
              if (start === end || start < 0 || end > result.correctedText.length) {
                setManualSelection(null)
                return
              }
              const range = start < end ? { start, end } : { start: end, end: start }
              const value = result.correctedText.slice(range.start, range.end)
              setManualSelection(
                value
                  ? {
                      version: 3,
                      requestId: result.requestId,
                      kind: 'expression',
                      mode: result.mode,
                      source: 'edited',
                      correctedRange: range,
                      value,
                    }
                  : null,
              )
            }}
          />
        ) : (
          <ResultChanges
            result={result}
            diff={diff}
            selected={selected}
            panelId={panelId}
            onSelect={(index) => select(index)}
            onManualSelection={setManualSelection}
            manualSelection={manualSelection}
            translation={translation}
          />
        )}
        <div className="speech-row">
          {speechAction}
          {translation && (
            <TranslationAction
              scope="result"
              getText={() => result.correctedText}
              getSelection={() => {
                const range = textSelection.current
                return range && range.start !== range.end
                  ? result.correctedText.slice(
                      Math.min(range.start, range.end),
                      Math.max(range.start, range.end),
                    )
                  : null
              }}
              translation={translation}
            />
          )}
        </div>
      </div>
      {compact && <p className="result-model-caption">{title}</p>}
      {manualSelection && view === 'text' && (
        <ExpressionExplanationPanel
          key={JSON.stringify(manualSelection)}
          selection={manualSelection}
          translation={translation}
        />
      )}
      {compact && (
        <div className="result-actions">
          {viewToggle}
          {actions}
        </div>
      )}
      {compact && !corrections.length && <p className="clipboard-feedback">{t('noChanges')}</p>}
      {view === 'changes' && current && comparison && (
        <CorrectionComparison
          result={result}
          current={current}
          selection={selection}
          compact={compact}
          title={title}
          isHistory={isHistory}
          selected={selected}
          total={corrections.length}
          description={description}
          panelId={panelId}
          onSelect={select}
          translation={translation}
        />
      )}
    </>
  )
}
