import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, openSync, closeSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../../..')
let directory
try {
  const output = join(root, 'test-results/text-diff')
  mkdirSync(output, { recursive: true })
  directory = mkdtempSync(join(output, new Date().toISOString().replace(/[:.]/gu, '-') + '-'))
  const lifecycle = (status) =>
    writeFileSync(
      join(directory, 'run-status.json'),
      JSON.stringify({ status, timestamp: new Date().toISOString() }) + '\n',
    )
  lifecycle('running')
  const log = openSync(join(directory, 'build.log'), 'w')
  let build
  try {
    // npm supplies its own CLI path. No shell and no caller-controlled executable/command.
    if (!process.env.npm_execpath) throw new Error('Run through npm run --silent diff:evaluate')
    build = spawnSync(
      process.execPath,
      [process.env.npm_execpath, 'run', 'build', '-w', '@gramota/text-diff'],
      { cwd: root, stdio: ['ignore', log, log], windowsHide: true },
    )
    if (build.status === 0)
      build = spawnSync(
        process.execPath,
        [process.env.npm_execpath, 'run', 'build', '-w', '@gramota/contracts'],
        { cwd: root, stdio: ['ignore', log, log], windowsHide: true },
      )
  } finally {
    closeSync(log)
  }
  if (build.error || build.status !== 0)
    throw new Error('Prerequisite build failed; inspect build.log in the report directory')
  require('ts-node').register({ project: join(root, 'apps/server/test/tsconfig.json') })
  const { runEvaluation } = require('./cli-main.ts')
  const result = await runEvaluation({ root, directory, args: process.argv.slice(2) })
  lifecycle(result.report.status)
  process.exitCode = result.exitCode
  console.log(
    `Text diff evaluation ${result.report.status}: ${result.report.summary.failed} failed cases. ${directory}`,
  )
  if (result.report.error && result.report.status === 'failed')
    console.error('Evaluation error: inspect results.json for details.')
} catch (error) {
  if (directory) {
    try {
      writeFileSync(join(directory, 'run-status.json'), JSON.stringify({ status: 'failed' }) + '\n')
    } catch {
      /* Report directory may be unwritable. */
    }
  }
  console.error(
    `Text diff evaluation failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}${directory ? `. ${directory}` : ''}`,
  )
  process.exitCode = 1
}
