import { useEffect, useMemo, useRef } from 'react'
import type { ExpressionExplanationInput } from '@gramota/contracts'
import type { TextDiff } from '../../lib/text-diff'
import { correctionDescription } from '../../lib/whitespace-display'
import { ExpressionExplanationPanel } from '../explanations/ExpressionExplanationPanel'
import type { ResultViewResult } from './types'
import type { ResultViewProps } from './types'

type ChangePart = { start: number; end: number; groupId: string | null; marker?: string }

function passage(text: string, empty: string) {
  if (!text) return empty
  if (/^\s+$/u.test(text)) return 'Whitespace only'
  return text
}

function displayParts(diff: TextDiff): ChangePart[] {
  const points = [
    ...new Set([
      ...diff.correctedRuns.flatMap((run) => [run.range.start, run.range.end]),
      ...diff.markers.map((marker) => marker.correctedOffset),
    ]),
  ].sort((a, b) => a - b)
  const parts: ChangePart[] = []
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

export function ResultChanges({
  result,
  diff,
  selected,
  panelId,
  onSelect,
  onManualSelection,
  manualSelection,
  translation,
  selectionSurfaceRef,
  showExplanation = true,
}: {
  result: ResultViewResult
  diff: TextDiff
  selected: number
  panelId: string
  onSelect: (index: number, element?: HTMLSpanElement) => void
  onManualSelection: (selection: ExpressionExplanationInput | null) => void
  manualSelection: ExpressionExplanationInput | null
  selectionSurfaceRef?: import('react').RefObject<HTMLDivElement | null>
  showExplanation?: boolean
  translation?: ResultViewProps['translation']
}) {
  const container = useRef<HTMLDivElement>(null)
  const selectedElement = useRef<HTMLSpanElement>(null)
  const corrections = diff.groups
  const parts = useMemo(() => displayParts(diff), [diff])
  const current = corrections[selected]

  function select(index: number, element?: HTMLSpanElement) {
    selectedElement.current = element ?? null
    onSelect(index, element)
  }

  function setManualRange(start: number, end: number) {
    if (start === end || start < 0 || end > result.correctedText.length) {
      onManualSelection(null)
      return
    }
    const range = start < end ? { start, end } : { start: end, end: start }
    const value = result.correctedText.slice(range.start, range.end)
    if (!value) onManualSelection(null)
    else
      onManualSelection({
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
      onManualSelection(null)
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

  useEffect(() => {
    if (!container.current || !current) return
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
  }, [selected, current])

  return (
    <>
      <div
        className="result-box result-changes"
        role="region"
        tabIndex={0}
        lang="ru"
        ref={(element) => {
          container.current = element
          if (selectionSurfaceRef) selectionSurfaceRef.current = element
        }}
        aria-labelledby={panelId}
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
      {showExplanation && manualSelection && (
        <ExpressionExplanationPanel
          key={JSON.stringify(manualSelection)}
          selection={manualSelection}
          translation={translation}
        />
      )}
    </>
  )
}
