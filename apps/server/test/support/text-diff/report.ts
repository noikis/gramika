import { z } from 'zod'
import { TextRange, ChangeKind } from '@gramota/text-diff'
import { Fixture } from '../../fixtures/text-diff-fixtures'
import { measurement, type CaseResult } from './evaluate'

const Diff = z.strictObject({
  groups: z.array(
    z.strictObject({
      id: z.string(),
      kind: ChangeKind,
      originalSpans: z.array(TextRange),
      correctedSpans: z.array(TextRange),
      originalRange: TextRange,
      correctedRange: TextRange,
    }),
  ),
  originalRuns: z.array(z.strictObject({ range: TextRange, groupId: z.string().nullable() })),
  correctedRuns: z.array(z.strictObject({ range: TextRange, groupId: z.string().nullable() })),
  markers: z.array(
    z.strictObject({
      correctedOffset: z.number().int().nonnegative(),
      groupId: z.string(),
      kind: z.enum(['deletion', 'move-source']),
    }),
  ),
})
const Assertion = z.strictObject({
  name: z.string(),
  isPassed: z.boolean(),
  error: z.string().optional(),
})
const Result = z.strictObject({
  fixture: Fixture,
  actual: Diff.nullable(),
  assertions: z.array(Assertion),
  elapsedMs: z.number().nonnegative().finite(),
  timingSamplesMs: z.array(z.number().nonnegative().finite()),
})
const Summary = z.strictObject({
  cases: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  exploratory: z.number().int().nonnegative(),
  assertions: z.number().int().nonnegative(),
  failedAssertions: z.number().int().nonnegative(),
})
const ComparisonEntry = z.strictObject({
  id: z.string(),
  status: z.enum(['unchanged', 'changed', 'changed-input', 'added', 'missing']),
  differences: z.array(z.string()),
  baseline: Result.optional(),
  candidate: Result.optional(),
})
export const Report = z.strictObject({
  schemaVersion: z.literal(1),
  timestamp: z.iso.datetime(),
  status: z.enum(['running', 'completed', 'failed', 'interrupted']),
  revision: z.string(),
  isDirty: z.boolean(),
  runtime: z.strictObject({
    node: z.string(),
    platform: z.string(),
    arch: z.string(),
    icu: z.string(),
  }),
  settings: z.strictObject({
    api: z.literal('diffText(original, corrected)'),
    options: z.null(),
    offsetUnit: z.literal('UTF-16'),
  }),
  measurement: z.strictObject({
    clock: z.string(),
    warmupCalls: z.number(),
    samples: z.number(),
    includesValidation: z.boolean(),
  }),
  selectedCaseIds: z.array(z.string()),
  summary: Summary,
  cases: z.array(Result),
  error: z.string().optional(),
  comparison: z
    .strictObject({
      baselinePath: z.string(),
      baselineTimestamp: z.string(),
      baselineRevision: z.string(),
      isBaselineDirty: z.boolean(),
      baselineSettings: z.unknown(),
      isSettingsChanged: z.boolean(),
      cases: z.array(ComparisonEntry),
    })
    .optional(),
})
export type Report = z.infer<typeof Report>

export function summarize(cases: CaseResult[]): Report['summary'] {
  const failed = cases.filter((result) =>
    result.assertions.some((assertion) => !assertion.isPassed),
  ).length
  return {
    cases: cases.length,
    passed: cases.length - failed,
    failed,
    exploratory: cases.filter((result) => result.fixture.evaluation === 'exploratory').length,
    assertions: cases.reduce((sum, result) => sum + result.assertions.length, 0),
    failedAssertions: cases.reduce(
      (sum, result) => sum + result.assertions.filter((assertion) => !assertion.isPassed).length,
      0,
    ),
  }
}

export function newReport(revision: string, isDirty: boolean, ids: string[]): Report {
  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    status: 'running',
    revision,
    isDirty,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      icu: process.versions.icu ?? 'unknown',
    },
    settings: { api: 'diffText(original, corrected)', options: null, offsetUnit: 'UTF-16' },
    measurement,
    selectedCaseIds: ids,
    summary: summarize([]),
    cases: [],
  }
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
export function readBaseline(input: unknown): Report {
  const report = Report.parse(input)
  if (report.status !== 'completed')
    throw new Error(
      'Baseline must be a completed run (completed runs may contain assertion failures)',
    )
  const ids = report.cases.map((result) => result.fixture.id)
  if (new Set(ids).size !== ids.length || !same(ids, report.selectedCaseIds))
    throw new Error('Baseline case IDs are duplicate or inconsistent')
  if (!same(summarize(report.cases), report.summary))
    throw new Error('Baseline summary is inconsistent')
  return report
}

export function compare(
  candidate: Report,
  baseline: Report,
  baselinePath: string,
): NonNullable<Report['comparison']> {
  const oldCases = new Map(baseline.cases.map((result) => [result.fixture.id, result]))
  const newCases = new Map(candidate.cases.map((result) => [result.fixture.id, result]))
  const cases: NonNullable<Report['comparison']>['cases'] = []
  for (const id of new Set([...oldCases.keys(), ...newCases.keys()])) {
    const before = oldCases.get(id),
      after = newCases.get(id)
    if (!before || !after) {
      cases.push({
        id,
        status: before ? 'missing' : 'added',
        differences: [],
        baseline: before,
        candidate: after,
      })
      continue
    }
    if (
      before.fixture.original !== after.fixture.original ||
      before.fixture.corrected !== after.fixture.corrected
    ) {
      cases.push({
        id,
        status: 'changed-input',
        differences: ['Inputs differ; no direct output comparison'],
        baseline: before,
        candidate: after,
      })
      continue
    }
    const differences: string[] = []
    const note = (name: string, left: unknown, right: unknown) => {
      if (!same(left, right)) differences.push(name)
    }
    note('group count', before.actual?.groups.length, after.actual?.groups.length)
    note(
      'group kinds',
      before.actual?.groups.map((group) => group.kind),
      after.actual?.groups.map((group) => group.kind),
    )
    note(
      'comparison boundaries',
      before.actual?.groups.map((group) => [group.originalRange, group.correctedRange]),
      after.actual?.groups.map((group) => [group.originalRange, group.correctedRange]),
    )
    note(
      'exact spans',
      before.actual?.groups.map((group) => [group.originalSpans, group.correctedSpans]),
      after.actual?.groups.map((group) => [group.originalSpans, group.correctedSpans]),
    )
    note('groups and IDs', before.actual?.groups, after.actual?.groups)
    note(
      'runs and markers',
      before.actual && [
        before.actual.originalRuns,
        before.actual.correctedRuns,
        before.actual.markers,
      ],
      after.actual && [after.actual.originalRuns, after.actual.correctedRuns, after.actual.markers],
    )
    note('assertions', before.assertions, after.assertions)
    note('expectations and metadata', before.fixture, after.fixture)
    cases.push({
      id,
      status: differences.length ? 'changed' : 'unchanged',
      differences,
      baseline: before,
      candidate: after,
    })
  }
  return {
    baselinePath,
    baselineTimestamp: baseline.timestamp,
    baselineRevision: baseline.revision,
    isBaselineDirty: baseline.isDirty,
    baselineSettings: baseline.settings,
    isSettingsChanged: !same(candidate.settings, baseline.settings),
    cases,
  }
}

/** Render source characters visibly without allowing fixture content to become markup. */
export function visible(text: string): string {
  return (
    Array.from(text, (char) => {
      const whitespace: Record<string, string> = {
        ' ': '␠',
        '\t': '⇥',
        '\n': '↵',
        '\r': '␍',
        '\u00a0': '⍽[NBSP]',
      }
      if (whitespace[char]) return whitespace[char]
      if (/\p{C}|\s/u.test(char) && char !== '\u200d')
        return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`
      return char
        .replace(
          /[&<>"']/gu,
          (value) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!,
        )
        .replace(/[\\`*_{}[\]()#+.!|~>-]/gu, '\\$&')
    }).join('') || '∅ (empty)'
  )
}

function caseMarkdown(result: CaseResult): string[] {
  const { fixture, actual } = result
  const lines = [
    `### ${visible(fixture.id)}`,
    '',
    `${fixture.evaluation === 'exploratory' ? '**Exploratory quality expectation** (structural assertions still required)' : '**Confirmed behavior**'} — ${visible(fixture.description)}`,
    '',
    `Category: ${fixture.category}. Expectations: ${visible(JSON.stringify(fixture.expectation))}.`,
    '',
    `Original: ${visible(fixture.original)}`,
    '',
    `Corrected: ${visible(fixture.corrected)}`,
    '',
    `Groups: ${actual?.groups.length ?? 'unavailable'}. Pure diff: ${result.elapsedMs.toFixed(3)} ms.`,
    '',
  ]
  if (fixture.notes) lines.push(`Notes: ${visible(fixture.notes)}`, '')
  if (result.timingSamplesMs.length)
    lines.push(
      `Warmed pure-diff samples (ms): ${result.timingSamplesMs.map((sample) => sample.toFixed(3)).join(', ')}.`,
      '',
    )
  for (const group of actual?.groups ?? []) {
    lines.push(`- ${visible(group.id)} — ${group.kind}`)
    for (const [label, text, spans, context] of [
      ['Original', fixture.original, group.originalSpans, group.originalRange],
      ['Corrected', fixture.corrected, group.correctedSpans, group.correctedRange],
    ] as const)
      lines.push(
        `  - ${label} exact spans: ${spans.map((span) => `[${span.start}, ${span.end}) ${visible(text.slice(span.start, span.end))}`).join('; ') || '∅'}. Context [${context.start}, ${context.end}): ${visible(text.slice(context.start, context.end))}`,
      )
  }
  lines.push(
    '',
    `Assertions: ${result.assertions.filter((assertion) => assertion.isPassed).length}/${result.assertions.length} passed.`,
    '',
  )
  for (const assertion of result.assertions.filter((assertion) => !assertion.isPassed))
    lines.push(`- **FAIL** ${visible(assertion.name)}: ${visible(assertion.error ?? '')}`)
  return lines
}

export function markdown(report: Report): string {
  const lines = [
    '# Text diff evaluation',
    '',
    `Status: **${report.status}**. ${report.timestamp}.`,
    '',
    `Revision: ${visible(report.revision)}. Dirty working tree: ${report.isDirty}. Node: ${report.runtime.node}, ICU: ${report.runtime.icu}, ${report.runtime.platform}/${report.runtime.arch}.`,
    '',
    `Cases: ${report.summary.cases}; passed: ${report.summary.passed}; failed: ${report.summary.failed}; exploratory: ${report.summary.exploratory}; failed assertions: ${report.summary.failedAssertions}.`,
    '',
    `Settings: ${visible(JSON.stringify(report.settings))}`,
    '',
    `Timing method: ${visible(JSON.stringify(report.measurement))}. Timing is diagnostic, not a pass/fail threshold.`,
    '',
    'Whitespace legend: ␠ space; ⇥ tab; ↵ LF; ␍ CR; ⍽[NBSP] non-breaking space. All boundaries are UTF-16. Context is not highlighted ownership.',
    '',
  ]
  if (report.error) lines.push(`**Run error:** ${visible(report.error)}`, '')
  if (report.comparison) {
    const comparison = report.comparison
    lines.push(
      '## Baseline comparison',
      '',
      `Baseline: ${visible(comparison.baselinePath)}; ${comparison.baselineTimestamp}; revision ${visible(comparison.baselineRevision)}; dirty: ${comparison.isBaselineDirty}; settings changed: ${comparison.isSettingsChanged}.`,
      '',
    )
    for (const entry of comparison.cases) {
      lines.push(
        `### Comparison: ${visible(entry.id)} — ${entry.status}`,
        '',
        `Differences: ${entry.differences.map(visible).join('; ') || 'none (timing excluded)'}.`,
        '',
      )
      if (entry.baseline && entry.candidate)
        lines.push(
          `Timing baseline/candidate: ${entry.baseline.elapsedMs.toFixed(3)}/${entry.candidate.elapsedMs.toFixed(3)} ms.`,
          '',
        )
      if (entry.status !== 'unchanged') {
        if (entry.baseline) lines.push('Baseline detail:', '', ...caseMarkdown(entry.baseline), '')
        if (entry.candidate)
          lines.push('Candidate detail:', '', ...caseMarkdown(entry.candidate), '')
      }
    }
  }
  lines.push('## Case results', '')
  for (const result of report.cases) lines.push(...caseMarkdown(result), '')
  return lines.join('\n') + '\n'
}
