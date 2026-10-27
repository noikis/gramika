import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { diffText } from '@gramota/text-diff'
import { fixtures, validateFixtures, type Fixture } from '../../fixtures/text-diff-fixtures'
import { evaluateCase, type CaseResult } from './evaluate'
import { compare, markdown, newReport, readBaseline, summarize, type Report } from './report'

export function parseArguments(args: string[]) {
  const options: { caseId?: string; baselinePath?: string } = {}
  for (let index = 0; index < args.length; index++) {
    const flag = args[index],
      value = args[++index]
    if (!['--case', '--baseline'].includes(flag) || !value || value.startsWith('--'))
      throw new Error(
        'Usage: npm run --silent diff:evaluate -- [--case <id>] [--baseline <results.json>]',
      )
    const key = flag === '--case' ? 'caseId' : 'baselinePath'
    if (options[key]) throw new Error(`Duplicate option ${flag}`)
    options[key] = value
  }
  return options
}

export function saveReport(directory: string, report: Report) {
  for (const [file, contents] of [
    ['results.json', JSON.stringify(report, null, 2) + '\n'],
    ['report.md', markdown(report)],
  ] as const) {
    const target = join(directory, file),
      temporary = target + '.tmp'
    writeFileSync(temporary, contents, 'utf8')
    renameSync(temporary, target)
  }
}

type Options = {
  root: string
  directory: string
  args: string[]
  corpus?: Fixture[]
  implementation?: typeof diffText
  onCase?: (result: CaseResult) => void
}
export async function runEvaluation(
  options: Options,
): Promise<{ exitCode: number; report: Report }> {
  const { root, directory } = options
  // No model, application or transport imports; Git metadata is the only subprocess here.
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim()
  const isDirty =
    execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    }).length > 0
  const report = newReport(revision, isDirty, [])
  let isInterrupted = false
  const interrupt = () => {
    isInterrupted = true
  }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  try {
    saveReport(directory, report)
    const args = parseArguments(options.args)
    const corpus = validateFixtures(options.corpus ?? fixtures)
    const selected = args.caseId ? corpus.filter((fixture) => fixture.id === args.caseId) : corpus
    if (!selected.length) throw new Error(`Unknown case ID: ${args.caseId}`)
    report.selectedCaseIds = selected.map((fixture) => fixture.id)
    const baselinePath = args.baselinePath ? resolve(root, args.baselinePath) : undefined
    const baseline = baselinePath
      ? readBaseline(JSON.parse(readFileSync(baselinePath, 'utf8')))
      : undefined
    for (const fixture of selected) {
      await setImmediate()
      if (isInterrupted) break
      const result = evaluateCase(fixture, options.implementation)
      report.cases.push(result)
      report.summary = summarize(report.cases)
      saveReport(directory, report)
      options.onCase?.(result)
    }
    await setImmediate()
    report.status = isInterrupted ? 'interrupted' : 'completed'
    if (isInterrupted) report.error = 'Interrupted; available results are partial.'
    if (baseline) report.comparison = compare(report, baseline, baselinePath!)
    saveReport(directory, report)
    return { exitCode: isInterrupted ? 130 : report.summary.failed ? 1 : 0, report }
  } catch (error) {
    report.status = 'failed'
    report.error = error instanceof Error ? error.message : String(error)
    report.summary = summarize(report.cases)
    saveReport(directory, report)
    return { exitCode: 1, report }
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
  }
}
