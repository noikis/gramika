import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import type { CorrectionResult, ExpressionExplanationInput } from '@gramota/contracts'
import { RussianWord } from '@gramota/contracts'
import type { ChangeGroup } from '@gramota/text-diff'
import { diffText } from '../../lib/text-diff'
import { useLocale } from '../../i18n/use-locale'
import type { Correction } from './types'
import { Textarea } from '../ui/textarea'
import { ResultChanges } from '../results/ResultChanges'
import { ResultViewToggle } from '../results/ResultViewToggle'
import { SpeechButton } from '../ui/speech-button'
import { Icon } from '../ui/icon'
import type { ResultViewMode } from '../results/types'

export type MobileSelection = {
  text: string
  group: ChangeGroup | null
  x: number
  y: number
  isWord: boolean
}

function locateWord(text: string, position: number) {
  const words = text.matchAll(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu)
  for (const match of words) {
    const start = match.index
    const end = start + match[0].length
    if (position >= start && position <= end)
      return { text: match[0], start, end }
  }
  return null
}

function withinViewport(x: number, y: number, actionCount: number) {
  const width = Math.min(actionCount * 94 + 10, window.innerWidth - 24)
  return {
    x: Math.max(12, Math.min(x - width / 2, window.innerWidth - width - 12)),
    y: Math.max(12, Math.min(y + 12, window.innerHeight - 94)),
  }
}

function correctionForRange(groups: ChangeGroup[], start: number, end: number) {
  const matches = groups.filter(
    (group) =>
      group.correctedRange.start < end && group.correctedRange.end > start,
  )
  return matches.length === 1 ? matches[0] : null
}

function SelectionPopover({
  selection,
  correction,
  correctedText,
  onDismiss,
  onExplain,
}: {
  selection: MobileSelection
  correction: Correction
  correctedText: string
  onDismiss: () => void
  onExplain: (group: ChangeGroup) => void
}) {
  const { t } = useLocale()
  const parsedWord = selection.isWord ? RussianWord.safeParse(selection.text.trim()) : null
  const validWord = parsedWord?.success ? parsedWord.data : null
  const position = withinViewport(
    selection.x,
    selection.y,
    1 + Number(Boolean(validWord)) + Number(Boolean(selection.group)),
  )

  return (
    <div
      className="mobile-context-popover"
      style={{ left: position.x, top: position.y }}
      role="group"
      aria-label={selection.text}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {validWord && (
        <button type="button" onClick={() => {
          onDismiss()
          void correction.dictionary.lookup(validWord)
        }}>
          <Icon name="book" />
          <span>{t('dictionary')}</span>
        </button>
      )}
      <button type="button" onClick={() => {
        onDismiss()
        correction.translation.translate('result', correctedText, selection.text)
      }}>
        <Icon name="translate" />
        <span>{t('translate')}</span>
      </button>
      {selection.group && (
        <button type="button" onClick={() => {
          onDismiss()
          onExplain(selection.group!)
        }}>
          <Icon name="star4" />
          <span>{t('explain')}</span>
        </button>
      )}
    </div>
  )
}

export function MobileResult({
  result,
  view,
  onViewChange,
  correction,
  onExplain,
}: {
  result: CorrectionResult
  view: ResultViewMode
  onViewChange: (view: ResultViewMode) => void
  correction: Correction
  onExplain: (group: ChangeGroup) => void
}) {
  const { t } = useLocale()
  const diff = useMemo(
    () => diffText(result.originalText, result.correctedText),
    [result.originalText, result.correctedText],
  )
  const [selected, setSelected] = useState(0)
  const [manualSelection, setManualSelection] = useState<ExpressionExplanationInput | null>(null)
  const [popover, setPopover] = useState<MobileSelection | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const panelId = `mobile-result-${result.requestId}-details`

  useEffect(() => {
    if (!popover) return
    function dismiss(event: globalThis.PointerEvent) {
      if (!(event.target as Element).closest('.mobile-context-popover')) setPopover(null)
    }
    function close(event: KeyboardEvent) {
      if (event.key === 'Escape') setPopover(null)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', close)
    }
  }, [popover])

  useLayoutEffect(() => {
    if (view !== 'text' || !textRef.current) return
    textRef.current.style.height = 'auto'
    textRef.current.style.height = `${textRef.current.scrollHeight}px`
  }, [view, result.correctedText])

  function showSelection(text: string, start: number, end: number, x: number, y: number) {
    const value = text.trim()
    if (!value) return
    setPopover({
      text: value,
      group: correctionForRange(diff.groups, start, end),
      x,
      y,
      isWord: !/\s/u.test(value),
    })
  }

  function fromDomSelection() {
    const container = contentRef.current
    const selection = window.getSelection()
    if (!container || !selection || selection.isCollapsed || !selection.rangeCount) return false
    const range = selection.getRangeAt(0)
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer))
      return false
    const text = selection.toString().trim()
    if (!text) return false
    const matching = Array.from(container.querySelectorAll<HTMLElement>('[data-change]'))
      .filter((element) => range.intersectsNode(element))
      .map((element) => element.dataset.change)
    const groupIds = new Set(matching)
    const group = groupIds.size === 1
      ? diff.groups.find((item) => item.id === [...groupIds][0]) ?? null
      : null
    const rect = range.getBoundingClientRect()
    setPopover({
      text,
      group,
      x: rect.left + rect.width / 2,
      y: rect.bottom,
      isWord: !/\s/u.test(text),
    })
    return true
  }

  function onChangesClick(event: MouseEvent<HTMLDivElement>) {
    if (fromDomSelection()) return
    const point = document.caretRangeFromPoint?.(event.clientX, event.clientY)
    if (!point || !contentRef.current?.contains(point.startContainer)) return
    const node = point.startContainer
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent) return
    const word = locateWord(node.textContent, point.startOffset)
    if (!word) return
    const range = document.createRange()
    range.setStart(node, word.start)
    range.setEnd(node, word.end)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const groupId = node.parentElement?.closest<HTMLElement>('[data-change]')?.dataset.change
    const group = groupId ? diff.groups.find((item) => item.id === groupId) ?? null : null
    setPopover({
      text: word.text,
      group,
      x: event.clientX,
      y: event.clientY,
      isWord: true,
    })
  }

  function onCleanPointerUp(event: PointerEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget
    if (target.selectionStart === target.selectionEnd) return
    showSelection(
      result.correctedText.slice(target.selectionStart, target.selectionEnd),
      target.selectionStart,
      target.selectionEnd,
      event.clientX,
      event.clientY,
    )
  }

  function onCleanClick(event: MouseEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget
    if (target.selectionStart !== target.selectionEnd) return
    const word = locateWord(result.correctedText, target.selectionStart)
    if (!word) return
    target.setSelectionRange(word.start, word.end)
    showSelection(word.text, word.start, word.end, event.clientX, event.clientY)
  }

  return (
    <div className="mobile-result-card">
      <div ref={contentRef} className="mobile-result-reading">
        <span id={panelId} className="sr-only">{t('changes')}</span>
        {view === 'text' ? (
          <Textarea
            ref={textRef}
            readOnly
            className="editor-input result-text mobile-result-text"
            value={result.correctedText}
            lang="ru"
            spellCheck={false}
            aria-label={t('result')}
            onPointerUp={onCleanPointerUp}
            onClick={onCleanClick}
          />
        ) : (
          <div
            onClick={onChangesClick}
            onMouseUp={fromDomSelection}
            onTouchEnd={() => requestAnimationFrame(fromDomSelection)}
          >
            <ResultChanges
              result={result}
              diff={diff}
              selected={selected}
              panelId={panelId}
              onSelect={setSelected}
              onManualSelection={setManualSelection}
              manualSelection={manualSelection}
              showExplanation={false}
            />
          </div>
        )}
      </div>
      <div className="mobile-result-footer">
        <SpeechButton
          showLabel
          sourceId={`mobile-result-${result.requestId}`}
          getText={() => result.correctedText}
          getSelection={() => popover?.text ?? null}
          lang="ru-RU"
        />
        <ResultViewToggle
          title={t('result')}
          view={view}
          onViewChange={(next) => {
            setPopover(null)
            onViewChange(next)
          }}
        />
      </div>
      {popover && (
        <SelectionPopover
          selection={popover}
          correctedText={result.correctedText}
          correction={correction}
          onDismiss={() => setPopover(null)}
          onExplain={onExplain}
        />
      )}
    </div>
  )
}
