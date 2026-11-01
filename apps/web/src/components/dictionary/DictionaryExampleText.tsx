import { Fragment, type ReactNode } from 'react'
import type { DictionaryExample } from '@gramota/contracts'

export function DictionaryExampleText({ example }: { example: DictionaryExample }) {
  let offset = 0
  const ranges = (example.highlights ?? [])
    .filter(
      ({ start, end }) =>
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 0 &&
        end > start &&
        end <= example.text.length,
    )
    .sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  for (const [index, { start, end }] of ranges.entries()) {
    if (start < offset) continue
    const before = example.text.slice(offset, start)
    offset = end
    parts.push(
      <Fragment key={index}>
        {before}
        <strong>{example.text.slice(start, end)}</strong>
      </Fragment>,
    )
  }
  return (
    <>
      {parts}
      {example.text.slice(offset)}
    </>
  )
}
