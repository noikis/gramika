import { explainBenchmarkCommand } from './explain-cli'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { BenchmarkInputError, prepareBenchmark, parseBenchmarkVariants, runBenchmark } from './run'
import { parseConfig, readEnvironment } from '../config'
import { createTransport } from '../openrouter'
import { STRICT_PROMPT_VERSION, REWRITE_PROMPT_VERSION } from '../correction'

// Human-only entry point. Never import or invoke this command from checks or startup.
async function main() {
  let values: {
    cases?: string
    models?: string
    variants?: string
    execute?: boolean
    'explain-run'?: string
  }
  try {
    values = parseArgs({
      options: {
        cases: { type: 'string' },
        models: { type: 'string' },
        variants: { type: 'string' },
        execute: { type: 'boolean' },
        'explain-run': { type: 'string' },
      },
      allowPositionals: false,
    }).values
  } catch {
    throw new BenchmarkInputError(
      'Usage: npm run benchmark -w apps/server -- --cases <file.json> (--models <id,id> | --variants <model:mode,model:mode>) [--execute], or --explain-run <existing-run-folder> [--execute]',
    )
  }
  if (values['explain-run'] !== undefined) {
    if (values.cases || values.models || values.variants)
      throw new BenchmarkInputError('Use --explain-run alone, optionally with --execute.')
    return explainBenchmarkCommand(values['explain-run'], values.execute)
  }
  if (!values.cases || (!values.models && !values.variants) || (values.models && values.variants))
    throw new BenchmarkInputError(
      'Provide --cases and exactly one of --models or --variants. No default models are selected.',
    )
  let cases: unknown
  try {
    cases = JSON.parse(readFileSync(resolve(values.cases), 'utf8'))
  } catch {
    throw new BenchmarkInputError('Could not read the cases JSON file.')
  }
  const models = values.models?.split(',').map((id) => id.trim())
  const variants =
    values.variants === undefined ? undefined : parseBenchmarkVariants(values.variants)
  const plan = prepareBenchmark(cases, models, variants)
  console.log(
    `Prompts: ${[...new Set(plan.variants.map((variant) => (variant.mode === 'strict' ? STRICT_PROMPT_VERSION : REWRITE_PROMPT_VERSION)))].join(', ')}\nSentences: ${plan.cases.length}\nVariants: ${plan.variants.map((variant) => variant.name).join(', ')}\nMaximum requests: ${plan.maxRequests}`,
  )
  console.log(
    'One request per sentence/model/mode combination; no retries. Stop on first failure. Monetary cost is not capped.',
  )
  if (!values.execute) {
    console.log('Preview only. No network calls or run files created.')
    return
  }
  if (!stdin.isTTY || !stdout.isTTY)
    throw new BenchmarkInputError(
      'Execution requires an interactive terminal. Piped confirmation is not supported.',
    )
  const config = parseConfig(readEnvironment())
  if (!config.available)
    throw new BenchmarkInputError(
      'Correction environment, credentials or mandatory proxy configuration is unavailable. No requests sent.',
    )
  const terminal = createInterface({ input: stdin, output: stdout })
  let accepted: boolean
  try {
    accepted =
      (
        await terminal.question(
          `Type RUN ${plan.maxRequests} to authorize up to ${plan.maxRequests} paid requests: `,
        )
      ).trim() === `RUN ${plan.maxRequests}`
  } finally {
    terminal.close()
  }
  if (!accepted) {
    console.log('Cancelled. No requests sent.')
    return
  }
  let stopping = false
  const stop = () => {
    stopping = true
    console.log('Stopping after the current request is saved. No further requests will be sent.')
  }
  process.on('SIGINT', stop)
  try {
    const result = await runBenchmark({
      cases,
      models,
      variants,
      outputRoot: resolve(__dirname, '../../benchmark-data/runs'),
      transport: createTransport(config),
      shouldStop: () => stopping,
      onCreated: (folder) => console.log(`Local results: ${folder}`),
      onProgress: (count, max) => console.log(`Saved attempts: ${count}/${max}`),
    })
    console.log(`Run ${result.run.status}. Open report.html in the local results folder.`)
    if (result.run.status !== 'completed') process.exitCode = stopping ? 130 : 1
  } finally {
    process.off('SIGINT', stop)
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(
      error instanceof BenchmarkInputError
        ? error.message
        : 'Benchmark stopped. No further requests will be sent. Check the local results folder if one was created.',
    )
    process.exitCode = 1
  })
}
