import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fixtures, loadFixtures } from './fixtures/text-diff-fixtures'
import { evaluateCase } from './support/text-diff/evaluate'
import { parseArguments, runEvaluation, saveReport } from './support/text-diff/cli-main'
import {
  compare,
  markdown,
  newReport,
  readBaseline,
  Report,
  summarize,
  visible,
} from './support/text-diff/report'

const root = resolve(__dirname, '../../..')
function temporary(t: { after: (action: () => void) => void }) {
  const output = join(root, 'test-results/text-diff')
  mkdirSync(output, { recursive: true })
  const directory = mkdtempSync(join(output, 'test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}
function completed() {
  const report = newReport('synthetic-revision', true, [fixtures[0].id])
  report.status = 'completed'
  report.cases = [evaluateCase(fixtures[0])]
  report.summary = summarize(report.cases)
  return report
}

test('JSON fixtures decode whitespace exactly and allow omitted expectations', (t) => {
  const directory = temporary(t)
  const filename = join(directory, 'examples.json')
  const original = 'Привет\n\tмир\r\n\u00a0😀'
  const entry = {
    id: 'json-whitespace',
    original,
    corrected: original,
    category: 'unicode',
    description: 'Synthetic JSON whitespace case.',
    evaluation: 'confirmed',
  }
  writeFileSync(filename, JSON.stringify([entry]), 'utf8')
  const raw = readFileSync(filename, 'utf8')
  assert(raw.includes('\\n') && raw.includes('\\t') && raw.includes('\\r'))
  const [fixture] = loadFixtures(filename)
  assert.equal(fixture.original, original)
  assert.equal(fixture.corrected, original)
  assert.deepEqual(fixture.expectation, {})
  const result = evaluateCase(fixture)
  assert(result.assertions.every((assertion) => assertion.isPassed))
  assert(result.assertions.some((assertion) => assertion.name === 'residual coverage'))
  assert(!result.assertions.some((assertion) => assertion.name.startsWith('behavior:')))
})

test('JSON fixture errors identify the file, case and invalid field; duplicates are rejected', (t) => {
  const directory = temporary(t)
  const filename = join(directory, 'examples.json')
  writeFileSync(filename, JSON.stringify([{ ...fixtures[0], expectation: { count: 'one' } }]))
  assert.throws(
    () => loadFixtures(filename),
    (error: Error) => {
      assert(error.message.includes(filename))
      assert(error.message.includes('case "identical"'))
      assert(error.message.includes('expectation.count'))
      return true
    },
  )
  writeFileSync(filename, JSON.stringify([fixtures[0], fixtures[0]]))
  assert.throws(() => loadFixtures(filename), /Duplicate fixture ID: identical/u)
  writeFileSync(filename, '[invalid json]')
  assert.throws(
    () => loadFixtures(filename),
    (error: Error) => error.message.includes(filename),
  )
})

test('argument validation covers selection, baseline, duplicate and invalid arguments', () => {
  assert.deepEqual(parseArguments(['--case', 'identical', '--baseline', 'baseline.json']), {
    caseId: 'identical',
    baselinePath: 'baseline.json',
  })
  for (const args of [
    ['--case'],
    ['--case', '--baseline'],
    ['--other', 'x'],
    ['--case', 'a', '--case', 'b'],
  ])
    assert.throws(() => parseArguments(args))
})

test('full and selected command runs write schema-valid JSON and Markdown without console output', async (t) => {
  const fullDirectory = temporary(t)
  const full = await runEvaluation({ root, directory: fullDirectory, args: [] })
  assert.equal(full.exitCode, 0)
  assert.equal(full.report.cases.length, fixtures.length)
  assert.equal(
    Report.parse(JSON.parse(readFileSync(join(fullDirectory, 'results.json'), 'utf8'))).status,
    'completed',
  )
  assert.match(
    readFileSync(join(fullDirectory, 'report.md'), 'utf8'),
    /Exploratory quality expectation/u,
  )
  const originalFiles = readdirSync(fullDirectory).map((file) => [
    file,
    readFileSync(join(fullDirectory, file), 'utf8'),
  ])
  const selected = await runEvaluation({
    root,
    directory: temporary(t),
    args: ['--case', 'spelling', '--baseline', join(fullDirectory, 'results.json')],
  })
  assert.equal(selected.exitCode, 0)
  assert.deepEqual(selected.report.selectedCaseIds, ['spelling'])
  assert(selected.report.comparison!.cases.some((entry) => entry.status === 'missing'))
  assert.deepEqual(
    readdirSync(fullDirectory).map((file) => [
      file,
      readFileSync(join(fullDirectory, file), 'utf8'),
    ]),
    originalFiles,
    'baseline remains byte-for-byte unchanged',
  )
})

test('failed assertions are saved, return nonzero and do not stop later cases', async (t) => {
  const corpus = [{ ...fixtures[0], expectation: { count: 999 } }, fixtures[1]]
  const directory = temporary(t)
  const { report, exitCode } = await runEvaluation({ root, directory, args: [], corpus })
  assert.equal(exitCode, 1)
  assert.equal(report.status, 'completed')
  assert.equal(report.summary.failed, 1)
  assert.equal(report.cases.length, 2)
  assert.match(readFileSync(join(directory, 'report.md'), 'utf8'), /FAIL/u)
  assert.equal(
    readBaseline(JSON.parse(readFileSync(join(directory, 'results.json'), 'utf8'))).summary.failed,
    1,
  )
})

test('diff execution errors are recorded per case and available output survives operational errors', async (t) => {
  const failed = await runEvaluation({
    root,
    directory: temporary(t),
    args: [],
    corpus: fixtures.slice(0, 2),
    implementation: () => {
      throw new Error('synthetic engine failure')
    },
  })
  assert.equal(failed.exitCode, 1)
  assert.equal(failed.report.cases.length, 2)
  assert.equal(failed.report.summary.failed, 2)
  const directory = temporary(t)
  const partial = await runEvaluation({
    root,
    directory,
    args: [],
    onCase: () => {
      throw new Error('synthetic interruption of writing workflow')
    },
  })
  assert.equal(partial.report.status, 'failed')
  assert.equal(partial.report.cases.length, 1)
  assert.equal(partial.exitCode, 1)
  assert.match(readFileSync(join(directory, 'report.md'), 'utf8'), /Run error/u)
})

test('signal interruption saves partial results and can never be a completed pass', async (t) => {
  const directory = temporary(t)
  const result = await runEvaluation({
    root,
    directory,
    args: [],
    onCase: () => process.emit('SIGTERM', 'SIGTERM'),
  })
  assert.equal(result.exitCode, 130)
  assert.equal(result.report.status, 'interrupted')
  assert.equal(result.report.cases.length, 1)
  assert.throws(() => readBaseline(result.report), /completed run/u)
  assert.match(readFileSync(join(directory, 'report.md'), 'utf8'), /interrupted/u)
})

test('invalid arguments, unknown IDs and missing/malformed baselines produce saved failed runs', async (t) => {
  const invalidDirectory = temporary(t)
  const invalid = join(invalidDirectory, 'invalid.json')
  writeFileSync(invalid, '{bad-json')
  for (const args of [
    ['--unknown', 'value'],
    ['--case', 'unknown'],
    ['--baseline', join(invalidDirectory, 'missing.json')],
    ['--baseline', invalid],
  ]) {
    const directory = temporary(t)
    const result = await runEvaluation({ root, directory, args })
    assert.equal(result.exitCode, 1)
    assert.equal(result.report.status, 'failed')
    assert(result.report.error)
    assert.equal(JSON.parse(readFileSync(join(directory, 'results.json'), 'utf8')).status, 'failed')
  }
})

test('baseline validation rejects incompatible, duplicate and inconsistent data', () => {
  const baseline = completed()
  assert.doesNotThrow(() => readBaseline(baseline))
  assert.throws(() => readBaseline({ ...baseline, schemaVersion: 2 }))
  assert.throws(() => readBaseline({ ...baseline, status: 'running' }))
  assert.throws(
    () => readBaseline({ ...baseline, cases: [...baseline.cases, ...baseline.cases] }),
    /IDs/u,
  )
  assert.throws(
    () => readBaseline({ ...baseline, summary: { ...baseline.summary, failed: 42 } }),
    /summary/u,
  )
  assert.throws(() => readBaseline({ ...baseline, cases: [{ ...baseline.cases[0], actual: {} }] }))
})

test('comparison distinguishes unchanged, boundary/assertion changes, changed inputs and added/missing cases', () => {
  const baseline = completed(),
    candidate = structuredClone(baseline)
  assert.equal(compare(candidate, baseline, 'synthetic.json').cases[0].status, 'unchanged')
  candidate.cases[0].elapsedMs += 100
  assert.equal(
    compare(candidate, baseline, 'synthetic.json').cases[0].status,
    'unchanged',
    'timing is not an automatic quality verdict',
  )
  candidate.cases[0].fixture.corrected = 'Другой текст'
  assert.equal(compare(candidate, baseline, 'synthetic.json').cases[0].status, 'changed-input')
  candidate.cases = [evaluateCase(fixtures[4])]
  const additions = compare(candidate, baseline, 'synthetic.json').cases
  assert.deepEqual(
    additions.map((entry) => entry.status),
    ['missing', 'added'],
  )
  baseline.cases = [evaluateCase(fixtures[4])]
  candidate.cases = structuredClone(baseline.cases)
  candidate.cases[0].actual!.groups[0].correctedRange.end--
  candidate.cases[0].actual!.groups[0].correctedSpans[0].end--
  candidate.cases[0].assertions[0].isPassed = false
  candidate.cases[0].fixture.description += ' revised'
  const change = compare(candidate, baseline, 'synthetic.json').cases[0]
  assert.equal(change.status, 'changed')
  assert(change.differences.includes('comparison boundaries'))
  assert(change.differences.includes('exact spans'))
  assert(change.differences.includes('assertions'))
  assert(change.differences.includes('expectations and metadata'))
  candidate.comparison = compare(candidate, baseline, 'synthetic.json')
  assert.match(markdown(candidate), /Baseline detail/u)
  assert.match(markdown(candidate), /Candidate detail/u)
})

test('Markdown escapes source syntax and exposes whitespace; JSON preserves exact text', (t) => {
  const fixture = fixtures.find((fixture) => fixture.id === 'report-markup')!
  const report = completed()
  report.cases = [evaluateCase(fixture)]
  const directory = temporary(t)
  saveReport(directory, report)
  assert.equal(
    JSON.parse(readFileSync(join(directory, 'results.json'), 'utf8')).cases[0].fixture.original,
    fixture.original,
  )
  const md = readFileSync(join(directory, 'report.md'), 'utf8')
  assert(!md.includes('<b>'))
  assert(md.includes('&lt;b'))
  assert(md.includes('\\|') && md.includes('\\`') && md.includes('\\['))
  assert.equal(visible(' \t\r\n\u00a0\u0000'), '␠⇥␍↵⍽[NBSP][U+0]')
})

test('report output failure propagates instead of claiming a saved report', async (t) => {
  const directory = temporary(t)
  const occupied = join(directory, 'file')
  writeFileSync(occupied, 'not a directory')
  await assert.rejects(runEvaluation({ root, directory: occupied, args: [] }))
})

test('npm CLI wrapper returns real success/failure exit codes with concise output and unique directories', () => {
  const cli = resolve(__dirname, 'support/text-diff/cli.mjs')
  const directories: string[] = []
  for (const [id, expectedExit] of [
    ['identical', 0],
    ['not-a-fixture', 1],
  ] as const) {
    const child = spawnSync(process.execPath, [cli, '--case', id], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    })
    assert.ifError(child.error)
    assert.equal(child.status, expectedExit, child.stderr)
    assert.equal(child.stdout.trim().split(/\r?\n/u).length, 1)
    const match = child.stdout
      .trim()
      .match(/^Text diff evaluation [a-z]+: \d+ failed cases\. (.+)$/u)
    assert(match, child.stdout)
    directories.push(match[1])
    const report = Report.parse(JSON.parse(readFileSync(join(match[1], 'results.json'), 'utf8')))
    assert.equal(report.status, expectedExit ? 'failed' : 'completed')
    assert.equal(child.stderr.trim().split(/\r?\n/u).length, 1)
  }
  assert.notEqual(directories[0], directories[1])
})
