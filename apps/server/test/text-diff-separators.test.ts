import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ExplanationInput } from '@gramota/contracts'
import { explanationSelection } from '@gramota/contracts/text-diff'
import { type ChangeGroup } from '@gramota/text-diff'
import { fixtures } from './fixtures/text-diff-fixtures'
import { verify } from './support/text-diff/invariants'
import { renderResult } from './support/text-diff/presentation'

function fragments(text: string, spans: ChangeGroup['originalSpans']) {
  return spans.map((span) => text.slice(span.start, span.end))
}

function isSeparator(original: string, corrected: string, group: ChangeGroup) {
  const before = fragments(original, group.originalSpans)
  const after = fragments(corrected, group.correctedSpans)
  return (
    group.kind === 'replace' &&
    before.length === 1 &&
    after.length === 1 &&
    ((before[0] === ' ' && after[0] === '-') || (before[0] === '-' && after[0] === ' '))
  )
}

for (const fixture of fixtures.filter((fixture) => fixture.id.startsWith('step3-'))) {
  test(`Step 3: ${fixture.id}`, () => {
    const { original, corrected } = fixture
    const result = verify(original, corrected)
    const separators = result.groups.filter((group) => isSeparator(original, corrected, group))
    if (fixture.id.startsWith('step3-negative-')) {
      assert.equal(
        separators.length,
        0,
        'excluded candidates must not become separator replacements',
      )
      return
    }
    const expected = fixture.id.includes('repeated') || fixture.id.includes('chain') ? 2 : 1
    assert.equal(separators.length, expected)
    for (const group of separators) {
      const oldSpan = group.originalSpans[0]
      const newSpan = group.correctedSpans[0]
      assert.equal(oldSpan.end - oldSpan.start, 1)
      assert.equal(newSpan.end - newSpan.start, 1)
      const selection = ExplanationInput.parse(
        explanationSelection('00000000-0000-4000-8000-000000000000', group),
      )
      assert.deepEqual(selection.originalSpans, [oldSpan])
      assert.deepEqual(selection.correctedSpans, [newSpan])
      assert.deepEqual(selection.originalRange, group.originalRange)
      assert.deepEqual(selection.correctedRange, group.correctedRange)
    }
    if (fixture.id !== 'step3-s3-06') assert.equal(result.groups.length, expected)
    else {
      const spelling = result.groups.filter((group) => !separators.includes(group))
      assert(spelling.length > 0)
      assert(
        spelling.some(
          (group) =>
            fragments(original, group.originalSpans).includes('отпровил') &&
            fragments(corrected, group.correctedSpans).includes('отправил'),
        ),
      )
    }
    for (const side of ['original', 'corrected'] as const) {
      const text = side === 'original' ? original : corrected
      const runs = side === 'original' ? result.originalRuns : result.correctedRuns
      assert.equal(runs.map((run) => text.slice(run.range.start, run.range.end)).join(''), text)
    }
    if (fixture.id === 'step3-s3-01' || fixture.id === 'step3-s3-02') {
      assert.deepEqual(separators[0].originalSpans, [{ start: 3, end: 4 }])
      assert.deepEqual(separators[0].correctedSpans, [{ start: 3, end: 4 }])
      assert.equal(result.markers.length, 0, 'replacement needs no redundant deletion marker')
    }
  })
}

test('Step 3 presentation: one comparison and separator-only highlighting in all shared variants', () => {
  for (const id of ['step3-s3-03', 'step3-s3-04']) {
    const { original, corrected } = fixtures.find((fixture) => fixture.id === id)!
    const result = verify(original, corrected)
    const group = result.groups[0]
    const span = group.correctedSpans[0]
    for (const variant of ['workspace', 'history', 'compact'] as const) {
      const html = renderResult(original, corrected, variant)
      assert.equal((html.match(/class="correction-comparison"/gu) ?? []).length, 1)
      assert.match(html, /Correction 1 of 1/u)
      assert(!html.includes('correction-deletion'))
      assert(!html.includes('Correction 2 of'))
      assert.match(html, /чат<span class="comparison-change">/u)
      assert.match(html, /<\/span>бот/u)
      assert.equal((html.match(/class="comparison-whitespace"/gu) ?? []).length, 1)
      assert.match(html, /aria-label="space">␠<\/span>/u)
      assert.match(
        html,
        new RegExp(
          `data-change="${group.id}"[^>]*>(${corrected.slice(span.start, span.end)})<\\/span>`,
          'u',
        ),
      )
      assert(!html.includes('class="comparison-change">чат'))
      assert(!html.includes('class="comparison-change">бот'))
    }
  }
})

test('Step 3 keeps independent grammar corrections separate', () => {
  assert.equal(verify('Она был готов', 'Она была готова').groups.length, 2)
})
