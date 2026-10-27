import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffText, MAX_CHANGE_SPANS, type TextDiff } from '@gramota/text-diff'
import { explanationSelection } from '@gramota/contracts/text-diff'
import { fixtures, validateFixtures } from './fixtures/text-diff-fixtures'
import { evaluateCase } from './support/text-diff/evaluate'
import {
  assertOutcomes,
  assertSpanUnionPreserved,
  invariants,
} from './support/text-diff/invariants'
import { renderExcerpt, renderResult } from './support/text-diff/presentation'

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

test('renderer integration marks changed whitespace and retains ordinary context', () => {
  const html = renderResult('слово ,', 'слово,')
  assert.match(html, /aria-label="space">␠<\/span><\/span>,<\/dd>/u)
  assert.match(html, /<dt>Corrected<\/dt><dd>,<\/dd>/u)
  assert.match(html, /Removed an extra space/u)
  assert(html.includes('␠'))
})

test('removed whitespace uses one decorative dot while other deletions retain their markers', () => {
  for (const variant of ['workspace', 'history', 'compact'] as const) {
    for (const [original, corrected] of [
      ['слово ,', 'слово,'],
      [' ', ''],
      ['\t', ''],
    ]) {
      const html = renderResult(original, corrected, variant)
      assert.match(html, /correction-removed-whitespace/u)
      assert.match(html, /aria-hidden="true">·<\/span>/u)
      assert(!html.includes('aria-hidden="true">−</span>'))
    }
    assert.match(renderResult('Привет', '', variant), /aria-hidden="true">−<\/span>/u)
    assert.match(
      renderResult('Я пока не могу.', 'Я не могу пока.', variant),
      /aria-hidden="true">↪<\/span>/u,
    )
    const inserted = renderResult('Приветмир', 'Привет мир', variant)
    assert(!inserted.includes('correction-removed-whitespace'))
  }
})

test('renderer integration shows empty-side labels, deletions and punctuation', () => {
  assert.match(renderResult('', 'Привет'), /<dd>No original text<\/dd>/u)
  const deleted = renderResult('Привет', '')
  assert.match(deleted, /<dd>Removed text<\/dd>/u)
  assert.match(deleted, /aria-hidden="true">−<\/span>/u)
  const punctuation = renderResult('Привет', 'Привет!')
  assert.match(punctuation, /data-range-start="0" data-range-end="6">Привет<\/span>/u)
  assert.match(
    punctuation,
    /<dt>Corrected<\/dt><dd><span class="comparison-change">!<\/span><\/dd>/u,
  )
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

const whitespaceCases = [
  ['слово ,', 'слово,'],
  ['Привет  мир', 'Привет мир'],
  ['Привет мир', 'Привет  мир'],
  ['Привет !', 'Привет!'],
  [' ', '\n'],
  ['', '\t'],
  ['\t', ''],
  ['', '\u00a0'],
  ['\u00a0', ''],
  ['\u00a0', ' '],
  [' ', '\u00a0'],
  ['  Привет', 'Привет'],
  ['Привет  ', 'Привет'],
  ['', ' '],
  [' ', ''],
  ['', ''],
  ['', '\r'],
  ['', '\r\n'],
  ['', '\u2003'],
] as const

for (const [original, corrected] of whitespaceCases)
  test(`comparison renderer preserves sources for ${JSON.stringify([original, corrected])}`, () => {
    const diff = diffText(original, corrected)
    const before = structuredClone(diff)
    const selections = diff.groups.map((group) => explanationSelection('request', group))
    for (const variant of ['workspace', 'history', 'compact'] as const) {
      const html = renderResult(original, corrected, variant)
      assert(!html.includes('<dd>Whitespace only</dd>'))
      if (diff.groups.length) {
        assert.match(html, /<dt>Original<\/dt>/u)
        assert.match(html, /<dt>Corrected<\/dt>/u)
        const group = diff.groups[0]
        for (const [text, range, spans] of [
          [original, group.originalRange, group.originalSpans],
          [corrected, group.correctedRange, group.correctedSpans],
        ] as const) {
          const excerpt = renderExcerpt(text, range, spans)
          if (range.start !== range.end) assert(html.includes(`<dd>${excerpt}</dd>`))
          assert.equal((excerpt.match(/class="comparison-change"/gu) ?? []).length, spans.length)
          const changed = spans.map((span) => text.slice(span.start, span.end)).join('')
          assert.equal(
            (excerpt.match(/class="comparison-whitespace"/gu) ?? []).length,
            (changed.match(/\r\n|\s/gu) ?? []).length,
          )
        }
      }
    }
    assert.deepEqual(diff, before)
    assert.deepEqual(
      diff.groups.map((group) => explanationSelection('request', group)),
      selections,
    )
    assert.deepEqual(diffText(original, corrected), before)
  })

test('marker names distinguish whitespace types and preserve counts', () => {
  const text = '  \t\n\r\r\n\u00a0\u2003'
  const range = { start: 0, end: text.length }
  const html = renderExcerpt(text, range, [range])
  for (const label of [
    'space',
    'tab',
    'line break',
    'carriage return',
    'line break (carriage return and line feed)',
    'non-breaking space',
    'U+2003 whitespace character',
  ])
    assert(html.includes(`aria-label="${label}"`))
  assert.equal((html.match(/aria-label="space"/gu) ?? []).length, 2)
  assert.match(html, />NBSP<\/span>/u)
})

test('multiple changed spans preserve unmarked gaps, offsets, emoji and safe escaping', () => {
  const text = '🙂 <b>  gap\tend '
  const range = { start: 0, end: text.length }
  const spans = [
    { start: 7, end: 8 },
    { start: 11, end: 12 },
    { start: 15, end: 16 },
  ]
  const html = renderExcerpt(text, range, spans)
  assert.match(html, /🙂 &lt;b&gt; /u)
  assert.match(html, /<\/span>gap<span class="comparison-change">/u)
  assert.equal((html.match(/class="comparison-change"/gu) ?? []).length, 3)
  assert.equal((html.match(/aria-label="space"/gu) ?? []).length, 2)
  assert.match(html, /aria-label="tab"/u)
  assert.equal(renderExcerpt(' context \t', { start: 0, end: 10 }, []), ' context \t')
})

test('all user Step 2 examples render through shared workspace and History cards', () => {
  const examples = fixtures.filter((fixture) => fixture.id.startsWith('step2-'))
  assert.equal(examples.length, 12)
  for (const fixture of examples) {
    const before = diffText(fixture.original, fixture.corrected)
    for (const variant of ['workspace', 'history', 'compact'] as const) {
      const html = renderResult(fixture.original, fixture.corrected, variant)
      assert.match(html, /class="correction-comparison"/u)
      assert.match(html, /class="comparison-change"/u)
      assert(!html.includes('<dd>Whitespace only</dd>'))
    }
    for (const group of before.groups) {
      for (const [text, range, spans] of [
        [fixture.original, group.originalRange, group.originalSpans],
        [fixture.corrected, group.correctedRange, group.correctedSpans],
      ] as const) {
        const html = renderExcerpt(text, range, spans)
        assert.equal((html.match(/class="comparison-change"/gu) ?? []).length, spans.length)
      }
    }
    assert.deepEqual(diffText(fixture.original, fixture.corrected), before)
  }
})
