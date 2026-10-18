import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { BenchmarkInputError, prepareBenchmark, runBenchmark } from './benchmark-run'
import { parseConfig, readEnvironment } from './correction-config'
import { createTransport } from './openrouter'

// Human-only entry point. Never import or invoke this command from checks or startup.
async function main() {
  let values: { cases?: string; models?: string; execute?: boolean }
  try {
    values = parseArgs({
      options: {
        cases: { type: 'string' },
        models: { type: 'string' },
        execute: { type: 'boolean' },
      },
      allowPositionals: false,
    }).values
  } catch {
    throw new BenchmarkInputError(
      'Usage: npm run benchmark -w apps/server -- --cases <file.json> --models <id,id> [--execute]',
    )
  }
  if (!values.cases || !values.models)
    throw new BenchmarkInputError(
      'Both --cases and --models are required. No default models are selected.',
    )
  let cases: unknown
  try {
    cases = JSON.parse(readFileSync(resolve(values.cases), 'utf8'))
  } catch {
    throw new BenchmarkInputError('Could not read the cases JSON file.')
  }
  const models = values.models.split(',').map((id) => id.trim())
  const plan = prepareBenchmark(cases, models)
  console.log(
    `Prompt: strict-v3\nSentences: ${plan.cases.length}\nModels: ${plan.models.map((model) => model.name).join(', ')}\nMaximum requests: ${plan.maxRequests}`,
  )
  console.log(
    'One request per sentence/model pair; no retries. Stop on first failure. Monetary cost is not capped.',
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
      outputRoot: resolve(__dirname, '../benchmark-data/runs'),
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
