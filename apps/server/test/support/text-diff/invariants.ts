import assert from 'node:assert/strict'
import { ExplanationInput } from '@gramota/contracts'
import { explanationSelection } from '@gramota/contracts/text-diff'
import { diffText, MAX_CHANGE_SPANS, type TextDiff, type TextRange } from '@gramota/text-diff'

export type AssertionOutcome = { name: string; isPassed: boolean; error?: string }
export function record(outcomes: AssertionOutcome[], name: string, action: () => void) {
  try {
    action()
    outcomes.push({ name, isPassed: true })
  } catch (error) {
    outcomes.push({
      name,
      isPassed: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })
export function invariants(
  original: string,
  corrected: string,
  result: TextDiff,
): AssertionOutcome[] {
  const outcomes: AssertionOutcome[] = []
  const check = (name: string, action: () => void) => record(outcomes, name, action)
  check('unique group IDs', () => {
    assert(result.groups.every((group) => typeof group.id === 'string' && group.id.length > 0))
    assert.equal(new Set(result.groups.map((group) => group.id)).size, result.groups.length)
  })
  check('identical and empty inputs', () => {
    if (original === corrected) {
      assert.equal(result.groups.length, 0)
      assert.equal(result.markers.length, 0)
    } else assert(result.groups.length > 0, 'different inputs need changes')
  })
  const residuals: string[] = []
  for (const [side, text, runs, spanKey, rangeKey] of [
    ['original', original, result.originalRuns, 'originalSpans', 'originalRange'],
    ['corrected', corrected, result.correctedRuns, 'correctedSpans', 'correctedRange'],
  ] as const) {
    const boundaries = new Set([
      text.length,
      ...Array.from(graphemes.segment(text), (part) => part.index),
    ])
    const range = (value: TextRange, isPositive = false) => {
      assert(
        Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end),
        'integer offsets',
      )
      assert(
        value.start >= 0 && value.end >= value.start && value.end <= text.length,
        'bounded range',
      )
      if (isPositive) assert(value.end > value.start, 'positive length')
      assert(boundaries.has(value.start) && boundaries.has(value.end), 'grapheme boundaries')
    }
    check(`${side}: run partition`, () => {
      let offset = 0
      for (const run of runs) {
        range(run.range, true)
        assert.equal(run.range.start, offset, 'runs partition text without gaps/overlaps')
        offset = run.range.end
        if (run.groupId !== null) {
          const group = result.groups.find((group) => group.id === run.groupId)
          assert(group, 'run references existing group')
          assert(
            group[spanKey].some(
              (span) => span.start === run.range.start && span.end === run.range.end,
            ),
            'run matches exact span',
          )
        }
      }
      assert.equal(offset, text.length)
      assert.equal(runs.map((run) => text.slice(run.range.start, run.range.end)).join(''), text)
    })
    const allSpans: TextRange[] = []
    for (const group of result.groups) {
      check(`${side}: ${group.id} spans and context`, () => {
        range(group[rangeKey])
        for (const span of group[spanKey]) {
          range(span, true)
          assert(
            span.start >= group[rangeKey].start && span.end <= group[rangeKey].end,
            'context contains changed span',
          )
          assert.equal(
            runs.filter(
              (run) =>
                run.groupId === group.id &&
                run.range.start === span.start &&
                run.range.end === span.end,
            ).length,
            1,
            'each exact span has one owned run',
          )
        }
      })
      allSpans.push(...group[spanKey])
    }
    check(`${side}: disjoint span ownership`, () => {
      const sorted = allSpans.toSorted((a, b) => a.start - b.start || a.end - b.end)
      for (let index = 1; index < sorted.length; index++)
        assert(sorted[index - 1].end <= sorted[index].start, 'no duplicate or overlapping spans')
    })
    residuals.push(
      runs
        .filter((run) => run.groupId === null)
        .map((run) => text.slice(run.range.start, run.range.end))
        .join(''),
    )
  }
  check('residual coverage', () => {
    if (result.groups.some((group) => group.kind === 'move')) {
      assert.equal(
        residuals[0].replace(/\s/gu, ''),
        residuals[1].replace(/\s/gu, ''),
        'retained lexical order',
      )
      assert.equal(
        residuals[0].replace(/\S/gu, ''),
        residuals[1].replace(/\S/gu, ''),
        'exact retained separators',
      )
    } else
      assert.equal(residuals[0], residuals[1], 'all remaining differences must be accounted for')
  })
  for (const group of result.groups) {
    check(`${group.id}: Explain selection`, () => {
      assert(group.originalSpans.length || group.correctedSpans.length, 'group owns a change')
      assert(
        group.originalSpans.length <= MAX_CHANGE_SPANS &&
          group.correctedSpans.length <= MAX_CHANGE_SPANS,
      )
      const parsed = ExplanationInput.safeParse(
        explanationSelection('00000000-0000-4000-8000-000000000000', group),
      )
      assert(parsed.success, parsed.success ? '' : parsed.error.message)
    })
    check(`${group.id}: movement and deletion markers`, () => {
      const markers = result.markers.filter((marker) => marker.groupId === group.id)
      if (group.kind === 'move') {
        assert.equal(markers.filter((marker) => marker.kind === 'move-source').length, 1)
        assert(group.originalSpans.length && group.correctedSpans.length)
        assert.deepEqual(
          group.originalSpans.map((span) => original.slice(span.start, span.end)),
          group.correctedSpans.map((span) => corrected.slice(span.start, span.end)),
          'moved fragments remain exact',
        )
      } else if (!group.correctedSpans.length)
        assert.equal(markers.filter((marker) => marker.kind === 'deletion').length, 1)
      else assert.equal(markers.length, 0, 'ordinary changes have no source marker')
    })
  }
  for (const marker of result.markers)
    check(`${marker.groupId}: marker offset/reference`, () => {
      assert(
        Number.isSafeInteger(marker.correctedOffset) &&
          marker.correctedOffset >= 0 &&
          marker.correctedOffset <= corrected.length,
      )
      const boundaries = new Set([
        corrected.length,
        ...Array.from(graphemes.segment(corrected), (part) => part.index),
      ])
      assert(boundaries.has(marker.correctedOffset), 'marker is grapheme-safe')
      const group = result.groups.find((group) => group.id === marker.groupId)
      assert(group)
      assert(marker.kind === (group.kind === 'move' ? 'move-source' : 'deletion'))
      if (marker.kind === 'deletion') assert.equal(group.correctedSpans.length, 0)
    })
  return outcomes
}

export function assertOutcomes(outcomes: AssertionOutcome[]) {
  const failures = outcomes.filter((outcome) => !outcome.isPassed)
  assert.equal(
    failures.length,
    0,
    failures.map((failure) => `${failure.name}: ${failure.error}`).join('\n'),
  )
}

export function verify(original: string, corrected: string) {
  const result = diffText(original, corrected)
  assert.deepEqual(result, diffText(original, corrected), 'deterministic output')
  assertOutcomes(invariants(original, corrected, result))
  return result
}

/** Compare coverage, allowing regrouping and adjacent span partition changes only. */
export function assertSpanUnionPreserved(before: TextDiff, after: TextDiff) {
  const union = (result: TextDiff, side: 'originalSpans' | 'correctedSpans') => {
    const spans = result.groups
      .flatMap((group) => group[side])
      .toSorted((a, b) => a.start - b.start || a.end - b.end)
    const merged: TextRange[] = []
    for (const span of spans) {
      assert(
        Number.isSafeInteger(span.start) &&
          Number.isSafeInteger(span.end) &&
          span.start >= 0 &&
          span.end > span.start,
      )
      const previous = merged.at(-1)
      if (previous) assert(previous.end <= span.start, 'duplicated/overlapping changed ownership')
      if (previous?.end === span.start) previous.end = span.end
      else merged.push({ ...span })
    }
    return merged
  }
  for (const side of ['originalSpans', 'correctedSpans'] as const)
    assert.deepEqual(
      union(after, side),
      union(before, side),
      `${side}: changed-span union preserved`,
    )
}
