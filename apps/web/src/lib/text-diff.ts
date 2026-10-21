import { diffArrays } from 'diff'

type TextRange = { start: number; end: number }
export type ChangeSegment =
  | { kind: 'equal'; original: string; corrected: string }
  | {
      kind: 'correction'
      original: string
      corrected: string
      originalRange: TextRange
      correctedRange: TextRange
    }
type ArrayChange = { value: string[]; added?: boolean; removed?: boolean }
type ComparisonBudget = { remaining: number }

const words = new Intl.Segmenter('ru', { granularity: 'word' })
const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })
const COMPARISON_BUDGET = 65536
const MAX_COMPARISON_TOKENS = 256

export function isWhitespaceOnlyChange(original: string, corrected: string) {
  const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim()
  return original !== corrected && normalize(original) === normalize(corrected)
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

function tokens(text: string) {
  // A word boundary must also be a grapheme boundary (including emoji sequences).
  const boundaries = new Set(Array.from(graphemes.segment(text), (part) => part.index))
  const result: string[] = []
  for (const part of words.segment(text)) {
    if (result.length && !boundaries.has(part.index)) result[result.length - 1] += part.segment
    else result.push(part.segment)
  }
  // Keep punctuation and trailing whitespace with their word. Whitespace must
  // never become an alignment anchor between unrelated words.
  const chunks: string[] = []
  for (const token of result) {
    const last = chunks.at(-1)
    if (last !== undefined && !/\s$/u.test(last)) chunks[chunks.length - 1] += token
    else if (/^\s+$/u.test(token) && last !== undefined) chunks[chunks.length - 1] += token
    else chunks.push(token)
  }
  return chunks
}

function wordKey(text: string) {
  return text.toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}\p{M}]/gu, '')
}

function similarWord(before: string, after: string) {
  const oldWord = wordKey(before)
  const newWord = wordKey(after)
  if (!oldWord || !newWord || /^\p{N}/u.test(oldWord) || /^\p{N}/u.test(newWord)) return false
  if (oldWord === newWord)
    return before.trimEnd().toLocaleLowerCase('ru') === after.trimEnd().toLocaleLowerCase('ru')
  const oldParts = Array.from(graphemes.segment(oldWord), (part) => part.segment)
  const newParts = Array.from(graphemes.segment(newWord), (part) => part.segment)
  const { start, end } = commonEdges(oldParts, newParts)
  return start + end >= 2 && (start + end) / Math.max(oldParts.length, newParts.length) >= 0.65
}

function joinsWord(parts: string[], target: string, fromEnd: boolean) {
  const key = wordKey(target)
  if (!key) return false
  let combined = ''
  for (let index = 0; index < parts.length; index++) {
    const part = wordKey(parts[fromEnd ? parts.length - index - 1 : index])
    combined = fromEnd ? part + combined : combined + part
    if (index > 0 && combined === key) return true
    if (combined.length >= key.length) return false
  }
  return false
}

export function diffText(original: string, corrected: string): ChangeSegment[] {
  if (original === corrected) return original ? [{ kind: 'equal', original, corrected }] : []
  const budget = { remaining: COMPARISON_BUDGET }
  const passages: { original: string; corrected: string }[] = []
  const before = tokens(original)
  const after = tokens(corrected)
  // Fall back at word boundaries as well: a large rewrite stays one readable passage.
  const beforeKeys = before.map((token) => token.trimEnd())
  const afterKeys = after.map((token) => token.trimEnd())
  const aligned = compare(beforeKeys, afterKeys, budget)
  const changes = aligned ?? coarseChanges(beforeKeys, afterKeys)
  let removed: string[] = []
  let added: string[] = []
  let oldIndex = 0
  let newIndex = 0
  function passage(oldText: string, newText: string) {
    if (!oldText && !newText) return
    if (oldText === newText) {
      const last = passages.at(-1)
      if (last && last.original === last.corrected) {
        last.original += oldText
        last.corrected += newText
        return
      }
    }
    passages.push({ original: oldText, corrected: newText })
  }
  function correction(oldText: string, newText: string) {
    // Unchanged trailing separators belong outside the highlight. A changed
    // separator keeps its word as visible context instead of an empty box.
    const oldParts = Array.from(graphemes.segment(oldText), (part) => part.segment)
    const newParts = Array.from(graphemes.segment(newText), (part) => part.segment)
    let end = 0
    while (
      end < oldParts.length &&
      end < newParts.length &&
      oldParts[oldParts.length - end - 1] === newParts[newParts.length - end - 1] &&
      /^\s+$/u.test(oldParts[oldParts.length - end - 1])
    )
      end++
    passage(
      oldParts.slice(0, oldParts.length - end).join(''),
      newParts.slice(0, newParts.length - end).join(''),
    )
    if (end) passage(oldParts.slice(-end).join(''), newParts.slice(-end).join(''))
  }
  function flush() {
    if (!removed.length && !added.length) return
    // Keep an obvious spelling/case edit separate from an adjacent split/join.
    // Only inspect the two ends of this bounded unmatched run, without fuzzy
    // searching through the text or treating separators as matching words.
    const tail: [string, string][] = []
    if (aligned && removed.length !== added.length) {
      for (const fromEnd of [false, true]) {
        while (removed.length && added.length) {
          const oldWord = removed[fromEnd ? removed.length - 1 : 0]
          const newWord = added[fromEnd ? added.length - 1 : 0]
          if (
            !similarWord(oldWord, newWord) ||
            joinsWord(removed, newWord, fromEnd) ||
            joinsWord(added, oldWord, fromEnd)
          )
            break
          if (fromEnd) tail.unshift([removed.pop()!, added.pop()!])
          else correction(removed.shift()!, added.shift()!)
        }
      }
    }
    // Equal-size substitutions can remain separate word edits. Split/join and
    // inserted/deleted phrases stay together; coarse fallback remains bounded.
    if (aligned && removed.length === added.length) {
      removed.forEach((token, index) => correction(token, added[index]))
    } else correction(removed.join(''), added.join(''))
    tail.forEach(([oldWord, newWord]) => correction(oldWord, newWord))
    removed = []
    added = []
  }
  for (const change of changes) {
    const count = change.value.length
    if (change.removed) {
      removed.push(...before.slice(oldIndex, oldIndex + count))
      oldIndex += count
    } else if (change.added) {
      added.push(...after.slice(newIndex, newIndex + count))
      newIndex += count
    } else {
      flush()
      for (let index = 0; index < count; index++) {
        const oldText = before[oldIndex++]
        const newText = after[newIndex++]
        if (oldText === newText) passage(oldText, newText)
        else correction(oldText, newText)
      }
    }
  }
  flush()
  let originalOffset = 0
  let correctedOffset = 0
  return passages.map(({ original: oldText, corrected: newText }): ChangeSegment => {
    const originalRange = { start: originalOffset, end: originalOffset + oldText.length }
    const correctedRange = { start: correctedOffset, end: correctedOffset + newText.length }
    originalOffset = originalRange.end
    correctedOffset = correctedRange.end
    return oldText === newText
      ? { kind: 'equal', original: oldText, corrected: newText }
      : { kind: 'correction', original: oldText, corrected: newText, originalRange, correctedRange }
  })
}
