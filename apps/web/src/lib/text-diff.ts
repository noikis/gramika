import { diffArrays } from 'diff'

export type ChangeSegment = { kind: 'equal' | 'removed' | 'added'; text: string }
type ArrayChange = { value: string[]; added?: boolean; removed?: boolean }
type ComparisonBudget = { remaining: number }

const words = new Intl.Segmenter('ru', { granularity: 'word' })
const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })
const COMPARISON_BUDGET = 65536
const MAX_COMPARISON_TOKENS = 256

function split(text: string, segmenter: Intl.Segmenter) {
  return Array.from(segmenter.segment(text), (part) => part.segment)
}

function append(segments: ChangeSegment[], kind: ChangeSegment['kind'], text: string) {
  if (!text) return
  const last = segments.at(-1)
  if (last?.kind === kind) last.text += text
  else segments.push({ kind, text })
}

function commonEdges(before: string[], after: string[]) {
  let start = 0
  let end = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - end - 1] === after[after.length - end - 1]
  )
    end++
  return { start, end }
}

function coarseChanges(before: string[], after: string[]): ArrayChange[] {
  const { start, end } = commonEdges(before, after)
  return [
    { value: before.slice(0, start) },
    { value: before.slice(start, before.length - end), removed: true },
    { value: after.slice(start, after.length - end), added: true },
    { value: before.slice(before.length - end) },
  ]
}

function compare(
  before: string[],
  after: string[],
  budget: ComparisonBudget,
): ArrayChange[] | null {
  const { start, end } = commonEdges(before, after)
  const oldMiddle = before.slice(start, before.length - end)
  const newMiddle = after.slice(start, after.length - end)
  const tokens = oldMiddle.length + newMiddle.length
  if (!oldMiddle.length || !newMiddle.length) return coarseChanges(before, after)
  if (tokens > MAX_COMPARISON_TOKENS || tokens * tokens > budget.remaining) return null
  budget.remaining -= tokens * tokens
  const middle: ArrayChange[] = diffArrays(oldMiddle, newMiddle)
  return [
    { value: before.slice(0, start) },
    ...middle,
    { value: before.slice(before.length - end) },
  ]
}

function refine(
  segments: ChangeSegment[],
  original: string,
  corrected: string,
  budget: ComparisonBudget,
) {
  const before = split(original, graphemes)
  const after = split(corrected, graphemes)
  const changes = compare(before, after, budget) ?? coarseChanges(before, after)
  for (const change of changes) {
    append(
      segments,
      change.added ? 'added' : change.removed ? 'removed' : 'equal',
      change.value.join(''),
    )
  }
}

export function diffText(original: string, corrected: string): ChangeSegment[] {
  if (original === corrected) return original ? [{ kind: 'equal', text: original }] : []
  const budget = { remaining: COMPARISON_BUDGET }
  const segments: ChangeSegment[] = []
  const changes = compare(split(original, words), split(corrected, words), budget)
  if (!changes) {
    refine(segments, original, corrected, budget)
    return segments
  }
  let removed = ''
  let added = ''
  for (const change of changes) {
    if (change.removed) removed += change.value.join('')
    else if (change.added) added += change.value.join('')
    else {
      if (removed || added) refine(segments, removed, added, budget)
      removed = ''
      added = ''
      append(segments, 'equal', change.value.join(''))
    }
  }
  if (removed || added) refine(segments, removed, added, budget)
  return segments
}
