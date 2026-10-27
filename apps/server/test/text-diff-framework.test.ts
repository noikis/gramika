import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffText, MAX_CHANGE_SPANS, type TextDiff } from '@gramota/text-diff'
import { fixtures, validateFixtures } from './fixtures/text-diff-fixtures'
import { evaluateCase } from './support/text-diff/evaluate'
import {
  assertOutcomes,
  assertSpanUnionPreserved,
  invariants,
} from './support/text-diff/invariants'
import { renderResult } from './support/text-diff/presentation'

test('corpus metadata validates IDs, expectations and exact timing lengths', () => {
  assert(
    fixtures.length >= 30,
    'retain the initial regression corpus; additional examples are allowed',
  )
  assert.throws(() => validateFixtures([fixtures[0], fixtures[0]]), /Duplicate/u)
  assert.throws(() => validateFixtures([{ ...fixtures[0], evaluation: 'silent-skip' }]))
  for (const fixture of fixtures.filter((fixture) => fixture.performance)) {
    const length = Number(fixture.id.split('-').at(-1))
    assert.equal(fixture.original.length, length)
    assert.equal(fixture.corrected.length, length)
  }
})

test('hard structural checks remain enforced on exploratory cases; diff errors are recorded', () => {
  const fixture = fixtures.find((fixture) => fixture.id === 'separator-forward')!
  const failed = evaluateCase(fixture, () => ({
    groups: [],
    originalRuns: [],
    correctedRuns: [],
    markers: [],
  }))
  assert(failed.assertions.some((assertion) => !assertion.isPassed))
  const thrown = evaluateCase(fixture, () => {
    throw new Error('synthetic diff error')
  })
  assert.equal(thrown.actual, null)
  assert.match(thrown.assertions[0].error!, /synthetic diff error/u)
})

const malformed: [string, (result: TextDiff) => void, string][] = [
  [
    'duplicate ID',
    (result) => result.groups.push(structuredClone(result.groups[0])),
    'unique group IDs',
  ],
  [
    'invalid context',
    (result) => {
      result.groups[0].originalRange.end = 100
    },
    'spans and context',
  ],
  [
    'fractional range',
    (result) => {
      result.originalRuns[0].range.start = 0.5
    },
    'run partition',
  ],
  [
    'zero span',
    (result) => {
      result.groups[0].originalSpans[0].end = 0
    },
    'spans and context',
  ],
  [
    'missing owner',
    (result) => {
      result.correctedRuns[0].groupId = 'fabricated'
    },
    'run partition',
  ],
  [
    'unowned span',
    (result) => {
      result.originalRuns[0].groupId = null
    },
    'spans and context',
  ],
  [
    'duplicate spans',
    (result) => result.groups[0].originalSpans.push({ ...result.groups[0].originalSpans[0] }),
    'disjoint span ownership',
  ],
  [
    'run gap',
    (result) => {
      result.correctedRuns[0].range.start = 1
    },
    'run partition',
  ],
  [
    'Explain limit',
    (result) => {
      result.groups[0].originalSpans = Array.from({ length: MAX_CHANGE_SPANS + 1 }, () => ({
        start: 0,
        end: 3,
      }))
    },
    'Explain selection',
  ],
  [
    'invalid marker',
    (result) =>
      result.markers.push({ correctedOffset: 100, groupId: 'fabricated', kind: 'deletion' }),
    'marker offset/reference',
  ],
  [
    'unclaimed difference',
    (result) => {
      result.groups = []
      result.originalRuns[0].groupId = null
      result.correctedRuns[0].groupId = null
    },
    'residual coverage',
  ],
]
for (const [label, mutate, expected] of malformed)
  test(`validator rejects ${label}`, () => {
    const result = diffText('кот', 'кит')
    mutate(result)
    assert(
      invariants('кот', 'кит', result).some(
        (outcome) => !outcome.isPassed && outcome.name.includes(expected),
      ),
    )
  })

test('validator rejects split graphemes, missing move markers and changed moved text', () => {
  const emoji = diffText('😀', '😃')
  emoji.groups[0].originalSpans[0].start = 1
  assert(invariants('😀', '😃', emoji).some((outcome) => outcome.error?.includes('grapheme')))
  const original = 'Я пока не могу.',
    corrected = 'Я не могу пока.'
  const moved = diffText(original, corrected)
  moved.markers = []
  assert(
    invariants(original, corrected, moved).some(
      (outcome) => !outcome.isPassed && outcome.name.includes('movement'),
    ),
  )
  assert(
    invariants(original, corrected.replace('пока', 'поку'), diffText(original, corrected)).some(
      (outcome) => outcome.error?.includes('moved fragments'),
    ),
  )
})

test('changed-span union check permits regrouping but rejects lost, duplicated and added coverage', () => {
  const before = diffText('чат бот', 'чат-бот')
  const merged = structuredClone(before)
  merged.groups = [
    {
      ...merged.groups[0],
      originalSpans: merged.groups.flatMap((group) => group.originalSpans),
      correctedSpans: merged.groups.flatMap((group) => group.correctedSpans),
    },
  ]
  assertSpanUnionPreserved(before, merged)
  for (const mutate of [
    (result: TextDiff) => {
      result.groups[0].originalSpans = []
    },
    (result: TextDiff) => {
      result.groups[0].originalSpans.push({ ...result.groups[0].originalSpans[0] })
    },
    (result: TextDiff) => {
      result.groups[0].originalSpans.push({ start: 0, end: 1 })
    },
  ]) {
    const after = structuredClone(merged)
    mutate(after)
    assert.throws(() => assertSpanUnionPreserved(before, after))
  }
})

test('renderer integration characterizes whitespace context without pretending it is visible whitespace markup', () => {
  const html = renderResult('слово ,', 'слово,')
  assert.match(html, /<dt>Original<\/dt><dd> ,<\/dd>/u)
  assert.match(html, /<dt>Corrected<\/dt><dd>,<\/dd>/u)
  assert.match(html, /Removed an extra space/u)
  assert(!html.includes('␠'))
})

test('renderer integration shows empty-side labels, deletions and punctuation', () => {
  assert.match(renderResult('', 'Привет'), /<dd>No original text<\/dd>/u)
  const deleted = renderResult('Привет', '')
  assert.match(deleted, /<dd>Removed text<\/dd>/u)
  assert.match(deleted, /aria-hidden="true">−<\/span>/u)
  const punctuation = renderResult('Привет', 'Привет!')
  assert.match(punctuation, /data-range-start="0" data-range-end="6">Привет<\/span>/u)
  assert.match(punctuation, /<dt>Corrected<\/dt><dd>!<\/dd>/u)
})

test('renderer integration preserves multi-span movement and distinct unchanged context', () => {
  const original = 'сейчас же я не могу',
    corrected = 'я не могу сейчас же'
  const result = diffText(original, corrected)
  const move = result.groups.find((group) => group.kind === 'move')!
  assert(move.originalSpans.length > 1 && move.correctedSpans.length > 1)
  assertOutcomes(invariants(original, corrected, result))
  const html = renderResult(original, corrected)
  assert.match(html, /Movement source/u)
  assert.match(html, /Movement destination/u)
  assert(
    (html.match(new RegExp(`data-change="${move.id}"`, 'gu')) ?? []).length >=
      move.correctedSpans.length + 1,
  )
  assert.match(html, /data-range-start="0" data-range-end="10">я не могу <\/span>/u)
})
