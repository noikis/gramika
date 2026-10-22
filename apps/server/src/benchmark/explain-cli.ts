import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { CorrectionMode } from '@gramota/contracts'
import { parseConfig, readEnvironment } from '../config'
import { createTransport } from '../openrouter'
import { BenchmarkInputError } from './run'
import { prepareExplanationBenchmark, runExplanationBenchmark } from './explain-run'
import { EXPLAIN_PROMPT_VERSION, REWRITE_EXPLAIN_PROMPT_VERSION } from '../explanation/prompt'

export async function explainBenchmarkCommand(
  folder: string,
  isExecute = false,
  mode: CorrectionMode = CorrectionMode.enum.strict,
) {
  const plan = prepareExplanationBenchmark(folder, mode)
  const promptVersion =
    mode === CorrectionMode.enum.strict ? EXPLAIN_PROMPT_VERSION : REWRITE_EXPLAIN_PROMPT_VERSION
  console.log(
    `Mode: ${mode}\nPrompt: ${promptVersion}\nCorrection results: ${plan.results.length}\nMaximum explanation requests: ${plan.maxRequests}`,
  )
  console.log(
    'One request per detected change in the selected mode, using the correcting model. No new corrections, retries or dollar cap. Source run stays unchanged.',
  )
  if (!isExecute) {
    console.log('Preview only. No network calls or output files created.')
    return
  }
  if (!plan.maxRequests) {
    console.log('No changes in the selected mode to explain. No requests sent.')
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
          `Type RUN ${plan.maxRequests} to authorize up to ${plan.maxRequests} paid explanation requests: `,
        )
      ).trim() === `RUN ${plan.maxRequests}`
  } finally {
    terminal.close()
  }
  if (!accepted) {
    console.log('Cancelled. No requests sent.')
    return
  }
  let isStopping = false
  const stop = () => {
    isStopping = true
    console.log('Stopping after the current explanation is saved.')
  }
  process.on('SIGINT', stop)
  try {
    const result = await runExplanationBenchmark({
      plan,
      outputRoot: resolve(__dirname, '../../benchmark-data/explain-runs'),
      transport: createTransport(config),
      shouldStop: () => isStopping,
      onCreated: (path) => console.log(`Local results: ${path}`),
      onProgress: (count, max) => console.log(`Saved explanations: ${count}/${max}`),
    })
    console.log(`Explain run ${result.run.status}. Open report.html in the local results folder.`)
    if (result.run.status !== 'completed') process.exitCode = isStopping ? 130 : 1
  } finally {
    process.off('SIGINT', stop)
  }
}
