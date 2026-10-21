import { ExplanationPanel } from './explanation-panel'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CorrectionResult } from '@gramota/contracts'
import { diffText, isWhitespaceOnlyChange } from '../lib/text-diff'
import { correctionDescription, whitespaceComparison } from '../lib/whitespace-display'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'

export type ResultViewMode = 'text' | 'changes'

type Props = {
  result: Pick<CorrectionResult, 'originalText' | 'correctedText' | 'requestId' | 'mode'>
  view: ResultViewMode
  onViewChange: (view: ResultViewMode) => void
  labelId: string
  title?: string
  compact?: boolean
  actions?: ReactNode
}

export function ResultView(props: Props) {
  return <ResultContent key={props.result.requestId} {...props} />
}

function passage(text: string, empty: string) {
  if (!text) return empty
  if (/^\s+$/u.test(text)) return 'Whitespace only'
  return text
}

function ResultContent({
  result,
  view,
  onViewChange,
  labelId,
  title = 'Result',
  compact = false,
  actions,
}: Props) {
  const groupName = useId()
  const panelId = useId()
  const [selected, setSelected] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const selectedElement = useRef<HTMLSpanElement>(null)
  const segments = useMemo(
    () => diffText(result.originalText, result.correctedText),
    [result.originalText, result.correctedText],
  )
  const corrections = segments.filter((segment) => segment.kind === 'correction')
  const current = corrections[selected]
  const spacingOnly =
    current !== undefined && isWhitespaceOnlyChange(current.original, current.corrected)
  const comparison =
    current && spacingOnly
      ? whitespaceComparison(current, segments[segments.indexOf(current) + 1])
      : current
  const explanationSelection =
    current && comparison
      ? {
          requestId: result.requestId,
          originalRange: {
            start: current.originalRange.start,
            end: current.originalRange.start + comparison.original.length,
          },
          correctedRange: {
            start: current.correctedRange.start,
            end: current.correctedRange.start + comparison.corrected.length,
          },
        }
      : null
  const description = comparison
    ? correctionDescription(comparison.original, comparison.corrected, spacingOnly)
    : ''

  useEffect(() => {
    if (view !== 'changes' || !container.current || !selectedElement.current) return
    const box = container.current
    const bounds = box.getBoundingClientRect()
    const target = selectedElement.current.getBoundingClientRect()
    const inset = 12
    const top = bounds.top + box.clientTop + inset
    const bottom = bounds.top + box.clientTop + box.clientHeight - inset
    if (target.top < top || target.height > bottom - top) box.scrollTop += target.top - top
    else if (target.bottom > bottom) box.scrollTop += target.bottom - bottom
  }, [selected, view])

  let correctionIndex = 0
  const viewToggle = (
    <fieldset className="result-toggle">
      <legend className="sr-only">
        {title === 'Result' ? 'Result view' : `${title} result view`}
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
          {mode === 'text' ? 'Text' : 'Changes'}
        </label>
      ))}
    </fieldset>
  )
  const correctionNavigation = corrections.length > 1 && (
    <div
      className="correction-navigation"
      aria-label={`${title} correction navigation`}
      role="group"
    >
      {selected > 0 && (
        <Button
          className="previous-correction"
          type="button"
          variant="secondary"
          onClick={() => setSelected(selected - 1)}
          aria-label="Previous correction"
        >
          Previous
        </Button>
      )}
      <span className="correction-counter">
        {selected + 1} / {corrections.length}
      </span>
      {selected < corrections.length - 1 && (
        <Button
          className="next-correction"
          type="button"
          variant="secondary"
          onClick={() => setSelected(selected + 1)}
          aria-label="Next correction"
        >
          Next
        </Button>
      )}
    </div>
  )

  return (
    <>
      {compact ? (
        <h3 id={labelId} className="sr-only">
          {title}
        </h3>
      ) : (
        <div className="editor-heading">
          <h2 id={labelId}>{title}</h2>
          {viewToggle}
        </div>
      )}
      {view === 'text' ? (
        <Textarea
          className="editor-input result-text"
          readOnly
          aria-labelledby={labelId}
          value={result.correctedText}
          lang="ru"
          spellCheck={false}
        />
      ) : (
        <div
          className="result-box result-changes"
          role="region"
          aria-labelledby={labelId}
          tabIndex={0}
          lang="ru"
          ref={container}
        >
          {segments.map((segment, index) => {
            if (segment.kind === 'equal') return segment.corrected
            const unitIndex = correctionIndex++
            const active = unitIndex === selected
            const spacing = isWhitespaceOnlyChange(segment.original, segment.corrected)
            const accessibleComparison = spacing
              ? whitespaceComparison(segment, segments[index + 1])
              : segment
            return (
              <span
                key={index}
                ref={active ? selectedElement : undefined}
                role="button"
                tabIndex={0}
                className={`correction-highlight${segment.corrected ? '' : ' correction-deletion'}${/^\s+$/u.test(segment.corrected) ? ' correction-whitespace' : ''}${spacing ? ' correction-spacing-only' : ''}`}
                aria-pressed={active}
                aria-controls={panelId}
                aria-label={`Correction ${unitIndex + 1} of ${corrections.length}. ${correctionDescription(accessibleComparison.original, accessibleComparison.corrected, spacing)} Original: ${passage(accessibleComparison.original, 'No original text')}. Corrected: ${passage(accessibleComparison.corrected, 'Removed text')}`}
                title={spacing ? 'Spacing only — select to compare' : undefined}
                onClick={() => setSelected(unitIndex)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelected(unitIndex)
                  }
                }}
              >
                {segment.corrected || <span aria-hidden="true">−</span>}
              </span>
            )
          })}
        </div>
      )}
      {compact && (
        <div className="result-actions">
          {viewToggle}
          {actions}
        </div>
      )}
      {compact && !corrections.length && <p className="clipboard-feedback">No changes.</p>}
      {view === 'changes' && current && comparison && (
        <div className={`correction-details${compact ? ' compact-inspector' : ''}`}>
          {compact ? (
            <div className="inspector-heading">
              <h3>{title}</h3>
              {correctionNavigation}
            </div>
          ) : (
            correctionNavigation
          )}
          <div id={panelId} className="correction-comparison" role="status" aria-atomic="true">
            <span className="sr-only">
              Correction {selected + 1} of {corrections.length}.
            </span>
            <p className="correction-kind">{description}</p>
            <dl>
              <div>
                <dt>Original</dt>
                <dd>{passage(comparison.original, 'No original text')}</dd>
              </div>
              <div>
                <dt>Corrected</dt>
                <dd>{passage(comparison.corrected, 'Removed text')}</dd>
              </div>
            </dl>
          </div>
          {result.mode === 'strict' && explanationSelection && (
            <ExplanationPanel
              key={JSON.stringify(explanationSelection)}
              selection={explanationSelection}
            />
          )}
        </div>
      )}
    </>
  )
}
