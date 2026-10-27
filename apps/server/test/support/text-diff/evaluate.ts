import assert from 'node:assert/strict'
import { diffText, type TextDiff } from '@gramota/text-diff'
import type { Fixture } from '../../fixtures/text-diff-fixtures'
import { invariants, record, type AssertionOutcome } from './invariants'

export type CaseResult = {
  fixture: Fixture
  actual: TextDiff | null
  assertions: AssertionOutcome[]
  elapsedMs: number
  timingSamplesMs: number[]
}
const TIMING_SAMPLES = 5
export const measurement = {
  clock: 'performance.now',
  warmupCalls: 1,
  samples: TIMING_SAMPLES,
  includesValidation: false,
}

export function evaluateCase(
  fixture: Fixture,
  implementation: typeof diffText = diffText,
): CaseResult {
  const assertions: AssertionOutcome[] = []
  let actual: TextDiff | null = null
  let elapsedMs = 0
  const timingSamplesMs: number[] = []
  record(assertions, 'diff execution', () => {
    const started = performance.now()
    try {
      actual = implementation(fixture.original, fixture.corrected)
    } finally {
      elapsedMs = performance.now() - started
    }
  })
  if (!actual) return { fixture, actual, assertions, elapsedMs, timingSamplesMs }
  const result: TextDiff = actual
  assertions.push(...invariants(fixture.original, fixture.corrected, result))
  record(assertions, 'deterministic output', () =>
    assert.deepEqual(result, implementation(fixture.original, fixture.corrected)),
  )
  if (fixture.evaluation === 'confirmed') {
    const expected = fixture.expectation
    const check = (name: string, action: () => void) =>
      record(assertions, `behavior: ${name}`, action)
    if (expected.count !== undefined)
      check('group count', () => assert.equal(result.groups.length, expected.count))
    if (expected.min !== undefined)
      check('minimum groups', () => assert(result.groups.length >= expected.min!))
    if (expected.max !== undefined)
      check('maximum groups', () => assert(result.groups.length <= expected.max!))
    if (expected.kinds)
      check('change kinds', () =>
        assert.deepEqual(
          result.groups.map((group) => group.kind),
          expected.kinds,
        ),
      )
    for (const [side, text, runs] of [
      ['original', fixture.original, result.originalRuns],
      ['corrected', fixture.corrected, result.correctedRuns],
    ] as const) {
      const fragments =
        side === 'original' ? expected.originalFragments : expected.correctedFragments
      if (fragments)
        check(`${side} exact fragments`, () =>
          assert.deepEqual(
            result.groups.flatMap((group) =>
              group[side === 'original' ? 'originalSpans' : 'correctedSpans'].map((span) =>
                text.slice(span.start, span.end),
              ),
            ),
            fragments,
          ),
        )
      for (const anchor of expected.unchanged ?? [])
        check(`${side} unchanged anchor ${anchor}`, () =>
          assert(
            runs.some(
              (run) =>
                run.groupId === null && text.slice(run.range.start, run.range.end).includes(anchor),
            ),
            'anchor must not be highlighted',
          ),
        )
    }
    if (expected.marker)
      check('marker kind', () =>
        assert(result.markers.some((marker) => marker.kind === expected.marker)),
      )
  }
  if (fixture.performance)
    record(assertions, 'performance samples', () => {
      implementation(fixture.original, fixture.corrected)
      for (let index = 0; index < TIMING_SAMPLES; index++) {
        const started = performance.now()
        implementation(fixture.original, fixture.corrected)
        timingSamplesMs.push(performance.now() - started)
      }
      assert(timingSamplesMs.every((elapsed) => Number.isFinite(elapsed) && elapsed >= 0))
    })
  return { fixture, actual: result, assertions, elapsedMs, timingSamplesMs }
}
