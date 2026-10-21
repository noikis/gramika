import { mockOpenRouterTransport } from './mock-transport'
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { Script } from 'node:vm'
import { MODELS, ModelPreference } from '@gramota/contracts'
import {
  assertBenchmarkPrompt,
  BENCHMARK_MODELS,
  prepareBenchmark,
  parseBenchmarkVariants,
  runBenchmark,
  type BenchmarkRun,
  benchmarkSummary,
} from '../src/benchmark'

import {
  AttemptError,
  createCorrectionService,
  OPENROUTER_REQUEST_DEFAULTS,
  STRICT_PROMPT,
  REWRITE_PROMPT,
  type CorrectionTransport,
} from '../src/correction'

import { SqliteDatabase } from '../src/database'

const models = MODELS.slice(0, 2).map((model) => model.id)
const cases = [
  { id: 'first', text: 'Привет мир!' },
  { id: 'second', text: 'Все хорошо.\n\nСпасибо 🙂' },
]

test('only the selected Gemma and Gemini models are available to benchmarks and the application', () => {
  assert.deepEqual(BENCHMARK_MODELS, [
    { id: 'google/gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B' },
    { id: 'google/gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
  ])
  assert.deepEqual(prepareBenchmark(cases, models).models, MODELS)
  for (const modelId of [
    'qwen/qwen3.7-flash',
    'qwen/qwen3.5-flash-02-23',
    'deepseek/deepseek-v3.2',
    'qwen/qwen3.8-27b',
    'qwen/qwen3-235b-a22b-2507',
    'openai/gpt-4.1-mini',
  ]) {
    assert.equal(ModelPreference.safeParse({ modelId }).success, false)
    assert.throws(() => prepareBenchmark(cases, [modelId]))
  }
})

test('benchmarks accept reasoning-bearing outputs and retain usage while ordinary corrections reject them', async (t) => {
  let calls = 0
  const transport: CorrectionTransport = mockOpenRouterTransport({
    async send(body) {
      calls++
      assert.deepEqual((body as { reasoning: unknown }).reasoning, { enabled: false })
      return {
        status: 200,
        data: {
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: 'Привет, мир!',
                reasoning: 'Fictional reasoning',
                reasoning_content: 'Fictional reasoning',
                reasoning_details: [{ type: 'reasoning.text', text: 'Fictional reasoning' }],
              },
            },
          ],
          usage: {
            prompt_tokens: 42,
            completion_tokens: 8,
            total_tokens: 50,
            cost: 0.0002,
            completion_tokens_details: { reasoning_tokens: 3 },
          },
        },
      }
    },
    async close() {},
  })
  const result = await runBenchmark({ cases, models, outputRoot: directory(t), transport })
  assert.equal(result.run.status, 'completed')
  assert.equal(calls, cases.length * models.length)
  const requests = Object.values(reportData(result.folder).data.requests)
  assert.equal(requests.length, 4)
  for (const request of requests) {
    assert.equal(request.correctedText, 'Привет, мир!')
    assert.equal(request.reasoningTokens, 3)
    assert.equal(request.costUsd, 0.0002)
  }
  const database = new SqliteDatabase(':memory:')
  try {
    const ordinary = createCorrectionService({
      repository: database.corrections,
      transport,
      isAvailable: true,
    })
    await assert.rejects(
      ordinary(cases[0]!.text, models[0]),
      (error: unknown) => error instanceof AttemptError && error.code === 'REASONING_NOT_DISABLED',
    )
  } finally {
    database.close()
  }
})

function directory(t: TestContext) {
  const parent = resolve(tmpdir())
  const folder = mkdtempSync(join(parent, 'gramota-benchmark-'))
  assert.equal(dirname(folder), parent)
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  return folder
}
function reply(text: string, cost: number | null = 0.0002) {
  return {
    status: 200,
    data: {
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text } }],
      usage: { prompt_tokens: 42, completion_tokens: 8, total_tokens: 50, cost },
    },
  }
}
function saved(folder: string) {
  return JSON.parse(readFileSync(join(folder, 'run.json'), 'utf8')) as BenchmarkRun
}
function reportData(folder: string) {
  const html = readFileSync(join(folder, 'report.html'), 'utf8')
  const match = html.match(
    /<script id="benchmark-data" type="application\/json">([^]*?)<\/script>/,
  )!
  return {
    html,
    encoded: match[1]!,
    data: JSON.parse(match[1]!) as {
      run: BenchmarkRun
      requests: Parameters<typeof benchmarkSummary>[1]
      summary: ReturnType<typeof benchmarkSummary>
    },
  }
}

test('benchmark inputs validate every case/model, preserve exact texts, and refuse other prompt versions', () => {
  const plan = prepareBenchmark(cases, models)
  assert.equal(plan.maxRequests, 4)
  assert.deepEqual(plan.cases, cases)
  assertBenchmarkPrompt('strict-v3')
  assert.throws(() => assertBenchmarkPrompt('strict-v4'))
  for (const invalid of [
    [],
    null,
    [{ id: 'x', text: ' ' }],
    [{ id: 'x', text: '\ud800' }],
    [{ id: 'x', text: 'x'.repeat(5001) }],
    [
      { id: 'x', text: 'a' },
      { id: ' x ', text: 'b' },
    ],
    [{ id: '', text: 'a' }],
    [{ id: 'x', text: 'a', extra: true }],
  ]) {
    assert.throws(() => prepareBenchmark(invalid, models))
  }
  for (const invalid of [[], null, [models[0], models[0]], ['unknown/model']])
    assert.throws(() => prepareBenchmark(cases, invalid))
})

test('mocked library run sends identical sentences in order, reuses production parameters and isolates records', async (t) => {
  const root = directory(t)
  const ordinary = new SqliteDatabase(join(root, 'ordinary.sqlite'))
  try {
    ordinary.modelPreferences.set(MODELS[1]!.id)
    const ordinaryId = randomUUID()
    ordinary.corrections.beginAttempt({
      ids: { correctionId: ordinaryId, requestId: randomUUID() },
      originalText: 'Обычная запись',
      modelId: MODELS[1]!.id,
      promptVersion: 'strict-v3',
      parameters: {},
      startedAt: new Date().toISOString(),
    })
    const bodies: { model: string; messages: { role: string; content: string }[] }[] = []
    let closed = false
    let folder = ''
    const transport: CorrectionTransport = mockOpenRouterTransport({
      async send(body) {
        const request = body as (typeof bodies)[number]
        bodies.push(request)
        assert.ok(existsSync(join(folder, 'report.html')))
        return reply(request.messages[1]!.content)
      },
      async close() {
        closed = true
      },
    })
    const result = await runBenchmark({
      cases,
      models,
      outputRoot: join(root, 'runs'),
      transport,
      onCreated: (value) => {
        folder = value
      },
      onProgress: (count) => {
        assert.equal(
          saved(folder).attempts.filter((item) => item.status !== 'not-run').length,
          count,
        )
      },
    })
    assert.equal(closed, true)
    assert.deepEqual(
      bodies.map((body) => [body.model, body.messages[1]!.content]),
      cases.flatMap((item) => models.map((model) => [model, item.text])),
    )
    for (const body of bodies) {
      assert.deepEqual(body, {
        ...OPENROUTER_REQUEST_DEFAULTS,
        model: body.model,
        messages: [
          { role: 'system', content: STRICT_PROMPT },
          { role: 'user', content: body.messages[1]!.content },
        ],
      })
      assert.equal(body.messages.length, 2)
    }
    assert.equal(result.run.status, 'completed')
    assert.ok(result.run.endedAt)
    assert.equal(result.run.prompts.strict?.text, STRICT_PROMPT)
    assert.deepEqual(result.run.parameters[models[1]!], {
      ...OPENROUTER_REQUEST_DEFAULTS,
      model: models[1],
    })
    const local = new SqliteDatabase(join(folder, 'records.sqlite'))
    try {
      assert.equal(local.history.list().total, 2)
      for (let index = 0; index < cases.length; index++) {
        const attempts = result.run.attempts.slice(index * 2, index * 2 + 2)
        assert.equal(attempts[0]!.correctionId, attempts[1]!.correctionId)
        const detail = local.history.get(attempts[0]!.correctionId!)!
        assert.equal(detail.originalText, cases[index]!.text)
        assert.equal(detail.requests.length, 2)
      }
    } finally {
      local.close()
    }
    assert.equal(ordinary.history.list().total, 1)
    assert.equal(ordinary.modelPreferences.get(), MODELS[1]!.id)
    const data = reportData(folder)
    assert.ok(
      data.data.summary.every((item) => item.succeeded === 2 && item.knownCostUsd === 0.0004),
    )
    assert.ok(data.html.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'))
    assert.ok(data.html.includes('@media(max-width:720px)'))
  } finally {
    ordinary.close()
  }
})

test('first failed request stops every remaining comparison and preserves partial results without retries', async (t) => {
  let calls = 0
  const result = await runBenchmark({
    cases,
    models,
    outputRoot: directory(t),
    transport: mockOpenRouterTransport({
      async send() {
        calls++
        return calls === 1
          ? reply('Привет, мир!')
          : {
              status: 502,
              data: { error: { message: 'untrusted provider details' }, usage: { cost: 0.0001 } },
            }
      },
      async close() {},
    }),
  })
  assert.equal(calls, 2)
  assert.equal(result.run.status, 'failed')
  assert.equal(result.run.errorCode, 'UPSTREAM_ERROR')
  assert.deepEqual(
    saved(result.folder).attempts.map((item) => item.status),
    ['succeeded', 'failed', 'not-run', 'not-run'],
  )
  const report = reportData(result.folder)
  assert.equal(report.data.summary[1]!.knownCostUsd, 0.0001)
  assert.equal(
    Object.values(report.data.requests).filter((item) => item.status === 'failed').length,
    1,
  )
  assert.ok(!report.html.includes('untrusted provider details'))
  assert.ok(report.html.includes('This comparison was not run.'))
})

test('timeout aborts exactly one mocked call and stops all later comparisons', async (t) => {
  let calls = 0
  let aborted = false
  const result = await runBenchmark({
    cases,
    models,
    outputRoot: directory(t),
    timeoutMs: 10,
    transport: mockOpenRouterTransport({
      send(_body, signal) {
        calls++
        return new Promise((_resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
              reject(new Error('mock abort'))
            },
            { once: true },
          ),
        )
      },
      async close() {},
    }),
  })
  assert.equal(calls, 1)
  assert.equal(aborted, true)
  assert.equal(result.run.errorCode, 'TIMEOUT')
  assert.deepEqual(
    result.run.attempts.map((item) => item.status),
    ['failed', 'not-run', 'not-run', 'not-run'],
  )
  assert.equal(reportData(result.folder).data.summary[0]!.knownCostUsd, null)
  assert.equal(reportData(result.folder).data.summary[0]!.unknownCostCount, 1)
})

test('stop signal waits for the current mocked request to be saved then prevents further calls', async (t) => {
  let stopping = false
  let calls = 0
  const result = await runBenchmark({
    cases,
    models,
    outputRoot: directory(t),
    shouldStop: () => stopping,
    transport: mockOpenRouterTransport({
      async send() {
        calls++
        stopping = true
        return reply('Привет, мир!')
      },
      async close() {},
    }),
  })
  assert.equal(calls, 1)
  assert.equal(result.run.status, 'interrupted')
  assert.equal(result.run.attempts[0]!.status, 'succeeded')
  assert.equal(result.run.attempts[1]!.status, 'not-run')
  assert.equal(Object.keys(reportData(result.folder).data.requests).length, 1)
})

test('report embeds text safely, preserves whitespace, and distinguishes zero, unknown and not-run costs', async (t) => {
  const text =
    '  <script>alert("fictional")</script>\n\n</script><img src=x onerror=alert(1)> & 🙂\u2028\u2029'
  let calls = 0
  const root = directory(t)
  const result = await runBenchmark({
    cases: [{ id: '</script>case', text }],
    models,
    outputRoot: root,
    transport: mockOpenRouterTransport({
      async send() {
        calls++
        return reply(text, calls === 1 ? 0 : null)
      },
      async close() {},
    }),
  })
  const report = reportData(result.folder)
  assert.ok(!report.encoded.includes('<'))
  assert.ok(!report.html.includes('<img src=x'))
  assert.equal(report.data.run.cases[0]!.text, text)
  assert.ok(Object.values(report.data.requests).every((item) => item.correctedText === text))
  assert.equal(report.data.summary[0]!.knownCostUsd, 0)
  assert.equal(report.data.summary[1]!.knownCostUsd, null)
  assert.equal(report.data.summary[1]!.unknownCostCount, 1)
  const scripts = [...report.html.matchAll(/<script>([^]*?)<\/script>/g)]
  assert.equal(scripts.length, 1)
  assert.doesNotThrow(() => new Script(scripts[0]![1]!))
  assert.ok(report.html.includes('node.textContent = text'))
  assert.ok(!report.html.includes('innerHTML'))
  assert.ok(!report.html.includes('fetch('))
  const next = await runBenchmark({
    cases,
    models: [models[0]],
    outputRoot: root,
    shouldStop: () => true,
    transport: mockOpenRouterTransport({
      async send() {
        throw Error('No calls permitted')
      },
      async close() {},
    }),
  })
  assert.notEqual(next.folder, result.folder)
  assert.deepEqual(saved(result.folder).cases, [{ id: '</script>case', text }])
  assert.equal(reportData(next.folder).data.summary[0]!.unknownCostCount, 0)
  assert.equal(readdirSync(root).length, 2)
})

test('invalid input and repository initialization/finalization failures prevent subsequent calls', async (t) => {
  const root = directory(t)
  let calls = 0
  const transport: CorrectionTransport = mockOpenRouterTransport({
    async send() {
      calls++
      return reply('fictional')
    },
    async close() {},
  })
  await assert.rejects(
    runBenchmark({ cases: [], models, outputRoot: join(root, 'invalid'), transport }),
  )
  assert.equal(existsSync(join(root, 'invalid')), false)
  const initial = await runBenchmark({
    cases,
    models,
    outputRoot: root,
    transport,
    onCreated: (folder) => mkdirSync(join(folder, 'records.sqlite')),
  })
  assert.equal(initial.run.errorCode, 'STORAGE_ERROR')
  assert.equal(calls, 0)
  let folder = ''
  const final = await runBenchmark({
    cases,
    models,
    outputRoot: root,
    onCreated: (value) => {
      folder = value
    },
    transport: mockOpenRouterTransport({
      async send() {
        calls++
        const raw = new DatabaseSync(join(folder, 'records.sqlite'))
        try {
          raw.exec('DROP TABLE model_requests')
        } finally {
          raw.close()
        }
        return reply('Привет, мир!')
      },
      async close() {},
    }),
  })
  assert.equal(calls, 1)
  assert.equal(final.run.errorCode, 'STORAGE_ERROR')
  assert.deepEqual(
    final.run.attempts.map((item) => item.status),
    ['failed', 'not-run', 'not-run', 'not-run'],
  )
})

test('explicit variants validate model/mode pairs and preserve Strict-only legacy commands', () => {
  const variants = parseBenchmarkVariants(
    `${models[0]}:strict, ${models[0]}:gentle-rewrite, ${models[1]}:gentle-rewrite`,
  )
  const plan = prepareBenchmark(cases, undefined, variants)
  assert.equal(plan.maxRequests, 6)
  assert.equal(plan.models.length, 2)
  assert.equal(plan.variants.length, 3)
  assert.equal(new Set(plan.variants.map((variant) => variant.id)).size, 3)
  assert.deepEqual(
    prepareBenchmark(cases, models).variants.map((variant) => variant.mode),
    ['strict', 'strict'],
  )
  assert.equal(prepareBenchmark(cases, undefined, variants.slice(0, 2)).maxRequests, 4)
  assert.equal(prepareBenchmark(cases, undefined, variants.slice(1)).maxRequests, 4)
  assertBenchmarkPrompt('rewrite-v1', 'gentle-rewrite')
  assert.throws(() => assertBenchmarkPrompt('strict-v3', 'gentle-rewrite'))
  assert.throws(() => prepareBenchmark(cases, models, variants))
  for (const invalid of [
    [],
    null,
    [variants[0], variants[0]],
    [{ modelId: models[0], mode: 'unknown' }],
    [{ modelId: 'unknown/model', mode: 'strict' }],
    [{ modelId: models[0] }],
    [{ modelId: models[0], mode: 'strict', extra: true }],
    parseBenchmarkVariants(`${models[0]}:gentle-rewrite:strict`),
    parseBenchmarkVariants(`${models[0]}`),
    parseBenchmarkVariants(''),
  ])
    assert.throws(() => prepareBenchmark(cases, undefined, invalid))
})

class ReportNode {
  textContent = ''
  className = ''
  lang = ''
  tabIndex = 0
  selectedIndex = 0
  private optionValue = ''
  children: ReportNode[] = []
  events: Record<string, () => void> = {}
  constructor(readonly tag: string) {}
  get value(): string {
    return this.tag === 'select' ? this.children[this.selectedIndex].value : this.optionValue
  }
  set value(value: string) {
    this.optionValue = value
  }
  append(...nodes: ReportNode[]) {
    this.children.push(...nodes)
  }
  replaceChildren() {
    this.children = []
  }
  addEventListener(name: string, callback: () => void) {
    this.events[name] = callback
  }
}

test('three-variant mocked run preserves prompts, parameters, isolated mixed-mode records and offline selection', async (t) => {
  const variants = parseBenchmarkVariants(
    `${models[0]}:strict,${models[0]}:gentle-rewrite,${models[1]}:gentle-rewrite`,
  )
  const bodies: { model: string; messages: { role: string; content: string }[] }[] = []
  const result = await runBenchmark({
    cases,
    variants,
    outputRoot: directory(t),
    transport: mockOpenRouterTransport({
      async send(body) {
        const value = body as (typeof bodies)[number]
        const variant = variants[bodies.length % variants.length]
        const item = cases[Math.floor(bodies.length / variants.length)]
        bodies.push(value)
        assert.deepEqual(value, {
          ...OPENROUTER_REQUEST_DEFAULTS,
          model: variant.modelId,
          messages: [
            { role: 'system', content: variant.mode === 'strict' ? STRICT_PROMPT : REWRITE_PROMPT },
            { role: 'user', content: item.text },
          ],
        })
        return reply(`${variant.modelId}:${variant.mode}: ${item.text}`, bodies.length * 0.001)
      },
      async close() {},
    }),
  })
  assert.equal(bodies.length, 6)
  assert.equal(result.run.status, 'completed')
  assert.equal(result.run.schemaVersion, 2)
  assert.equal(result.run.prompts.strict?.text, STRICT_PROMPT)
  assert.equal(result.run.prompts['gentle-rewrite']?.text, REWRITE_PROMPT)
  assert.equal(result.run.prompts['gentle-rewrite']?.version, 'rewrite-v1')
  const report = reportData(result.folder)
  assert.equal(report.data.summary.length, 3)
  assert.deepEqual(
    report.data.summary.map((item) => item.knownCostUsd),
    [0.005, 0.007, 0.009000000000000001],
  )
  assert.ok(report.data.summary.every((item) => item.succeeded === 2))
  assert.equal(
    new Set(result.run.attempts.slice(0, 3).map((attempt) => attempt.correctionId)).size,
    1,
  )
  const database = new SqliteDatabase(join(result.folder, 'records.sqlite'))
  try {
    assert.equal(database.history.list().total, 2)
    for (const attempt of result.run.attempts) {
      const request = database.history
        .get(attempt.correctionId!)!
        .requests.find((request) => request.id === attempt.requestId)!
      assert.equal(request.mode, attempt.mode)
      assert.equal(request.promptVersion, attempt.mode === 'strict' ? 'strict-v3' : 'rewrite-v1')
    }
  } finally {
    database.close()
  }
  const nodes = Object.fromEntries(
    ['sentence', 'left', 'right'].map((id) => [id, new ReportNode('select')]),
  )
  for (const id of [
    'benchmark-data',
    'run-status',
    'summary',
    'original',
    'left-result',
    'right-result',
  ])
    nodes[id] = new ReportNode('div')
  nodes['benchmark-data'].textContent = JSON.stringify(report.data)
  const script = report.html.match(/<script>([^]*?)<\/script>/)![1]
  new Script(script).runInNewContext({
    document: {
      getElementById: (id: string) => nodes[id],
      createElement: (tag: string) => new ReportNode(tag),
    },
  })
  assert.equal(nodes.left.children.length, 3)
  assert.ok(nodes['left-result'].children[1].textContent.includes(`${models[0]}:strict`))
  assert.ok(nodes['right-result'].children[1].textContent.includes(`${models[0]}:gentle-rewrite`))
  nodes.right.selectedIndex = 2
  nodes.right.events.change()
  assert.ok(nodes['right-result'].children[1].textContent.includes(`${models[1]}:gentle-rewrite`))
  nodes.sentence.selectedIndex = 1
  nodes.sentence.events.change()
  assert.equal(nodes.original.textContent, cases[1].text)
  assert.ok(nodes['right-result'].children[1].textContent.includes(cases[1].text))
})

test('mixed-mode failure records Rewrite separately and stops remaining variants', async (t) => {
  let calls = 0
  const result = await runBenchmark({
    cases,
    variants: parseBenchmarkVariants(
      `${models[0]}:strict,${models[0]}:gentle-rewrite,${models[1]}:gentle-rewrite`,
    ),
    outputRoot: directory(t),
    transport: mockOpenRouterTransport({
      async send() {
        calls++
        return calls === 1 ? reply('Синтетический ответ.', 0) : { status: 502, data: {} }
      },
      async close() {},
    }),
  })
  assert.equal(calls, 2)
  assert.equal(result.run.status, 'failed')
  assert.deepEqual(
    result.run.attempts.map((item) => item.status),
    ['succeeded', 'failed', 'not-run', 'not-run', 'not-run', 'not-run'],
  )
  const report = reportData(result.folder)
  assert.equal(report.data.summary[0].knownCostUsd, 0)
  assert.equal(report.data.summary[1].failed, 1)
  assert.equal(report.data.summary[1].unknownCostCount, 1)
  assert.equal(report.data.summary[2].notRun, 2)
  const request = report.data.requests[result.run.attempts[1].requestId!]
  assert.equal(request.mode, 'gentle-rewrite')
  assert.equal(request.promptVersion, 'rewrite-v1')
})
