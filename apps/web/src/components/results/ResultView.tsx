import { ExplanationPanel, ExpressionExplanationPanel } from '../explanations/ExplanationPanel'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CorrectionResult, ExpressionExplanationInput } from '@gramota/contracts'
import { diffText, explanationSelection, type TextDiff } from '../../lib/text-diff'
import { correctionDescription } from '../../lib/whitespace-display'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { ComparisonExcerpt } from './ComparisonExcerpt'
import { useLocale } from '../../hooks/use-locale'
import type { ResultViewMode } from './types'

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

function displayParts(diff: TextDiff) {
  const points = [
    ...new Set([
      ...diff.correctedRuns.flatMap((run) => [run.range.start, run.range.end]),
      ...diff.markers.map((marker) => marker.correctedOffset),
    ]),
  ].sort((a, b) => a - b)
  const parts: { start: number; end: number; groupId: string | null; marker?: string }[] = []
  let runIndex = 0
  points.forEach((start, index) => {
    for (const marker of diff.markers.filter((value) => value.correctedOffset === start))
      parts.push({ start, end: start, groupId: marker.groupId, marker: marker.kind })
    const end = points[index + 1]
    if (end === undefined) return
    while (diff.correctedRuns[runIndex]?.range.end <= start) runIndex++
    parts.push({ start, end, groupId: diff.correctedRuns[runIndex]?.groupId ?? null })
  })
  return parts
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
  const { t } = useLocale()
  const groupName = useId()
  const panelId = useId()
  const isHistory = !compact && Boolean(actions)
  const [selected, setSelected] = useState(0)
  const [manualSelection, setManualSelection] = useState<ExpressionExplanationInput | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const selectedElement = useRef<HTMLSpanElement>(null)
  const diff = useMemo(
    () => diffText(result.originalText, result.correctedText),
    [result.originalText, result.correctedText],
  )
  const corrections = diff.groups
  const parts = useMemo(() => displayParts(diff), [diff])
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

  function setManualRange(start: number, end: number) {
    if (start === end || start < 0 || end > result.correctedText.length) {
      setManualSelection(null)
      return
    }
    const range = start < end ? { start, end } : { start: end, end: start }
    const value = result.correctedText.slice(range.start, range.end)
    if (!value) setManualSelection(null)
    else
      setManualSelection({
        version: 3,
        requestId: result.requestId,
        kind: 'expression',
        mode: result.mode,
        source: 'edited',
        correctedRange: range,
        value,
      })
  }

  function readDomSelection() {
    if (!container.current) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setManualSelection(null)
      return
    }
    const range = selection.getRangeAt(0)
    if (
      !container.current.contains(range.startContainer) ||
      !container.current.contains(range.endContainer)
    )
      return
    const nodes = document.createTreeWalker(container.current, NodeFilter.SHOW_TEXT)
    let offset = 0
    let start: number | null = null
    let end: number | null = null
    let node: Node | null
    while ((node = nodes.nextNode())) {
      const parent = node.parentElement
      if (parent?.closest('[aria-hidden="true"]')) continue
      if (node === range.startContainer) start = offset + range.startOffset
      if (node === range.endContainer) end = offset + range.endOffset
      offset += node.textContent?.length ?? 0
    }
    if (start !== null && end !== null) setManualRange(start, end)
  }

  function select(index: number, element?: HTMLSpanElement) {
    selectedElement.current = element ?? null
    setSelected(index)
  }

  useEffect(() => {
    if (view !== 'changes' || !container.current || !current) return
    const box = container.current
    if (
      !selectedElement.current?.isConnected ||
      selectedElement.current.dataset.change !== current.id
    )
      selectedElement.current = box.querySelector<HTMLSpanElement>(`[data-change="${current.id}"]`)
    if (!selectedElement.current) return
    const bounds = box.getBoundingClientRect()
    const target = selectedElement.current.getBoundingClientRect()
    const inset = 12
    const top = bounds.top + box.clientTop + inset
    const bottom = bounds.top + box.clientTop + box.clientHeight - inset
    if (target.top < top || target.height > bottom - top) box.scrollTop += target.top - top
    else if (target.bottom > bottom) box.scrollTop += target.bottom - bottom
  }, [selected, view, current])

  const viewToggle = (
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
  const correctionNavigation = (corrections.length > 1 || (isHistory && current)) && (
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
          onClick={() => select(selected - 1)}
          aria-label="Previous correction"
          disabled={selected === 0}
        >
          {isHistory && <Icon name="chevronLeft" />}
          <span className="navigation-label">{t('previous')}</span>
        </Button>
      )}
      <span className="correction-counter">
        <span>
          {selected + 1} / {corrections.length}
        </span>
        {isHistory && <span className="navigation-description">{description}</span>}
      </span>
      {(selected < corrections.length - 1 || isHistory) && (
        <Button
          className="next-correction"
          type="button"
          variant="secondary"
          onClick={() => select(selected + 1)}
          aria-label="Next correction"
          disabled={selected === corrections.length - 1}
        >
          <span className="navigation-label">{t('next')}</span>
          {isHistory && <Icon name="chevronRight" />}
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
      ) : actions ? (
        <div className="result-toolbar">
          <div className="editor-heading">
            <h2 id={labelId}>{title}</h2>
            {viewToggle}
          </div>
          {actions}
        </div>
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
          onSelect={(event) =>
            setManualRange(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
          }
        />
      ) : (
        <div
          className="result-box result-changes"
          role="region"
          aria-labelledby={labelId}
          tabIndex={0}
          lang="ru"
          ref={container}
          onMouseUp={readDomSelection}
          onKeyUp={readDomSelection}
        >
          {parts.map((part, index) => {
            const text = result.correctedText.slice(part.start, part.end)
            if (!part.groupId)
              return (
                <span key={index} data-range-start={part.start} data-range-end={part.end}>
                  {text}
                </span>
              )
            const unitIndex = corrections.findIndex((group) => group.id === part.groupId)
            const group = corrections[unitIndex]
            const active = unitIndex === selected
            const spacing = group.kind === 'whitespace'
            const isRemovedWhitespace =
              part.marker === 'deletion' &&
              group.originalSpans.length > 0 &&
              group.originalSpans.every((range) =>
                /^\s+$/u.test(result.originalText.slice(range.start, range.end)),
              )
            const before = result.originalText.slice(
              group.originalRange.start,
              group.originalRange.end,
            )
            const after = result.correctedText.slice(
              group.correctedRange.start,
              group.correctedRange.end,
            )
            const label =
              group.kind === 'move'
                ? part.marker
                  ? 'Movement source'
                  : 'Movement destination'
                : correctionDescription(before, after, spacing)
            return (
              <span
                key={index}
                data-change={group.id}
                role="button"
                tabIndex={0}
                className={`correction-highlight${part.marker ? ' correction-deletion' : ''}${/^\s+$/u.test(text) ? ' correction-whitespace' : ''}${spacing ? ' correction-spacing-only' : ''}${isRemovedWhitespace ? ' correction-removed-whitespace' : ''}`}
                aria-pressed={active}
                aria-controls={panelId}
                aria-label={`Correction ${unitIndex + 1} of ${corrections.length}. ${label}. Original context: ${passage(before, 'No original text')}. Corrected context: ${passage(after, 'Removed text')}`}
                title={spacing ? 'Spacing only — select to compare' : undefined}
                onClick={(event) => select(unitIndex, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    select(unitIndex, event.currentTarget)
                  }
                }}
              >
                {part.marker ? (
                  <span aria-hidden="true">
                    {part.marker === 'move-source' ? '↪' : isRemovedWhitespace ? '·' : '−'}
                  </span>
                ) : (
                  text
                )}
              </span>
            )
          })}
        </div>
      )}
      {manualSelection && (
        <ExpressionExplanationPanel
          key={JSON.stringify(manualSelection)}
          selection={manualSelection}
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
              {t('correction')} {selected + 1} / {corrections.length}.
            </span>
            {!isHistory && <p className="correction-kind">{description}</p>}
            <dl>
              <div>
                <dt>{t('original')}</dt>
                <dd>
                  <ComparisonExcerpt
                    text={result.originalText}
                    range={current.originalRange}
                    spans={current.originalSpans}
                    empty={t('noOriginalText')}
                  />
                </dd>
              </div>
              <div>
                <dt>{t('corrected')}</dt>
                <dd>
                  <ComparisonExcerpt
                    text={result.correctedText}
                    range={current.correctedRange}
                    spans={current.correctedSpans}
                    empty={t('removedText')}
                  />
                </dd>
              </div>
            </dl>
          </div>
          {selection && <ExplanationPanel key={JSON.stringify(selection)} selection={selection} />}
        </div>
      )}
    </>
  )
}
