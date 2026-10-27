import { Fragment } from 'react'
import type { ChangeGroup } from '../lib/text-diff'

type WhitespaceMarker = {
  symbol: string
  label: string
}

const WHITESPACE_MARKERS: Record<string, WhitespaceMarker> = {
  ' ': { symbol: '␠', label: 'space' },
  '\t': { symbol: '⇥', label: 'tab' },
  '\n': { symbol: '↵', label: 'line break' },
  '\r\n': {
    symbol: '↵',
    label: 'line break (carriage return and line feed)',
  },
  '\r': { symbol: '↵', label: 'carriage return' },
  '\u00a0': { symbol: 'NBSP', label: 'non-breaking space' },
}

function whitespaceMarker(text: string): WhitespaceMarker {
  const marker = WHITESPACE_MARKERS[text]
  if (marker) return marker

  const code = `U+${text.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
  return { symbol: code, label: `${code} whitespace character` }
}

function changedText(text: string) {
  return text.split(/(\r\n|\s)/u).map((part, index) => {
    if (!/^\s+$/u.test(part)) return part
    const { symbol, label } = whitespaceMarker(part)
    return (
      <span key={index} className="comparison-whitespace" role="img" aria-label={label}>
        {symbol}
      </span>
    )
  })
}

/** Decorate only owned spans; source strings and UTF-16 ranges stay untouched. */
export function ComparisonExcerpt({
  text,
  range,
  spans,
  empty,
}: {
  text: string
  range: ChangeGroup['originalRange']
  spans: ChangeGroup['originalSpans']
  empty: string
}) {
  if (range.start === range.end) return empty
  const parts = spans.map((span, index) => {
    const context = text.slice(index === 0 ? range.start : spans[index - 1].end, span.start)
    return (
      <Fragment key={span.start}>
        {context}
        <span className="comparison-change">{changedText(text.slice(span.start, span.end))}</span>
      </Fragment>
    )
  })
  return (
    <>
      {parts}
      {text.slice(spans.at(-1)?.end ?? range.start, range.end)}
    </>
  )
}
