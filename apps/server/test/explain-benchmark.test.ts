import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Script } from 'node:vm'
import { MODELS } from '@gramota/contracts'
import { runBenchmark, BenchmarkInputError } from '../src/benchmark'
import { prepareExplanationBenchmark, runExplanationBenchmark } from '../src/benchmark/explain-run'
import { STRICT_EXPLAIN_PROMPT, REWRITE_EXPLAIN_PROMPT } from '../src/explanation/prompt'
import { mockOpenRouterTransport } from './mock-transport'

function directory(t: TestContext) {
  const path = mkdtempSync(join(tmpdir(), 'gramota-explain-benchmark-'))
  t.after(() => rmSync(path, { recursive: true, force: true }))
  return path
}
async function source(t: TestContext) {
  return runBenchmark({
    cases: [
      { id: 'changes', text: 'Превет, мир! Нужна помощ.' },
      { id: 'unchanged', text: 'Спасибо.' },
    ],
    variants: [
      { modelId: MODELS[0].id, mode: 'strict' },
      { modelId: MODELS[1].id, mode: 'strict' },
      { modelId: MODELS[0].id, mode: 'gentle-rewrite' },
      { modelId: MODELS[1].id, mode: 'gentle-rewrite' },
    ],
    outputRoot: directory(t),
    transport: {
      async send(body) {
        const text = (body as { messages: { content: string }[] }).messages[1].content
        return {
          correctedText: text.replace('Превет', 'Привет').replace('помощ.', 'помощь.'),
          errorCode: null,
          details: {},
        }
      },
      async close() {},
    },
  })
}
function snapshot(folder: string) {
  return Object.fromEntries(
    readdirSync(folder).map((name) => [name, readFileSync(join(folder, name))]),
  )
}

test('default preview stays Strict, Rewrite preview selects both models, and source files never change', async (t) => {
  const saved = await source(t)
  const before = snapshot(saved.folder)
  const plan = prepareExplanationBenchmark(saved.folder)
  assert.equal(plan.maxRequests, 4)
  assert.equal(plan.results.length, 8)
  assert.equal(plan.results.filter((result) => result.skipped).length, 4)
  assert.equal(
    plan.results.filter((result) => !result.skipped && result.changes.length === 0).length,
    2,
  )
  assert.deepEqual(
    plan.results[0].changes.map((change) => [change.original, change.corrected]),
    [
      ['Превет,', 'Привет,'],
      ['помощ.', 'помощь.'],
    ],
  )
  const rewrite = prepareExplanationBenchmark(saved.folder, 'gentle-rewrite')
  assert.equal(plan.mode, 'strict')
  assert.equal(rewrite.mode, 'gentle-rewrite')
  assert.equal(rewrite.maxRequests, 4)
  assert.equal(rewrite.results.filter((result) => result.skipped).length, 4)
  assert.deepEqual(
    rewrite.results.filter((result) => result.changes.length).map((result) => result.modelId),
    MODELS.map((model) => model.id),
  )
  assert.deepEqual(snapshot(saved.folder), before)
})

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`all changes use the original model, exact production Explain prompt/context and offline report (${mode})`, async (t) => {
    const saved = await source(t)
    const before = snapshot(saved.folder)
    const plan = prepareExplanationBenchmark(saved.folder, mode)
    const expected = plan.results.flatMap((result) =>
      result.changes.map((change) => ({ result, change })),
    )
    let calls = 0
    let closed = 0
    const outcome = await runExplanationBenchmark({
      plan,
      outputRoot: directory(t),
      transport: {
        async send(body, _signal, isRejectReasoning) {
          const { result, change } = expected[calls++]
          const request = body as { model: string; messages: { content: string }[] }
          assert.equal(request.model, result.modelId)
          assert.equal(
            request.messages[0].content,
            mode === 'strict' ? STRICT_EXPLAIN_PROMPT : REWRITE_EXPLAIN_PROMPT,
          )
          assert.equal(isRejectReasoning, false)
          const context = JSON.parse(request.messages[1].content)
          assert.equal(context.mode, mode)
          assert.equal(context.originalText, result.originalText)
          assert.equal(context.editedText, result.correctedText)
          assert.equal(context.selectedChange.originalFragment, change.original)
          assert.equal(context.selectedChange.editedFragment, change.corrected)
          assert.deepEqual(context.selectedChange.originalRange, change.selection.originalRange)
          return {
            correctedText: 'Синтетическое объяснение </script><img src=x onerror=alert(1)>.',
            errorCode: null,
            details: { costUsd: calls === 1 ? null : 0, inputTokens: 12, outputTokens: 5 },
          }
        },
        async close() {
          closed++
        },
      },
    })
    assert.equal(calls, 4)
    assert.equal(closed, 1)
    assert.equal(outcome.run.status, 'completed')
    assert.ok(
      outcome.run.results
        .flatMap((result) => result.changes)
        .every((change) => change.status === 'succeeded'),
    )
    assert.equal(
      outcome.run.prompt.text,
      mode === 'strict' ? STRICT_EXPLAIN_PROMPT : REWRITE_EXPLAIN_PROMPT,
    )
    assert.equal(
      outcome.run.prompt.version,
      mode === 'strict' ? 'explain-v1' : 'explain-rewrite-v1',
    )
    assert.equal(outcome.run.mode, mode)
    assert.equal(outcome.run.parameters[MODELS[1].id].model, MODELS[1].id)
    assert.deepEqual(outcome.run.parameters[MODELS[1].id].reasoning, { effort: 'minimal' })
    assert.deepEqual(snapshot(saved.folder), before)
    const manifest = JSON.parse(readFileSync(join(outcome.folder, 'run.json'), 'utf8'))
    const explained = manifest.results.find(
      (result: { changes: unknown[] }) => result.changes.length > 0,
    )
    assert.equal(explained.changes[0].details.costUsd, null)
    assert.equal(explained.changes[1].details.costUsd, 0)
    const html = readFileSync(join(outcome.folder, 'report.html'), 'utf8')
    assert.equal(html.includes('</script><img'), false)
    const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    assert.equal(scripts.length, 2)
    assert.equal(JSON.parse(scripts[0][1]).maxRequests, 4)
    class ReportNode {
      textContent = ''
      className = ''
      lang = ''
      tabIndex = 0
      value = '0'
      children: ReportNode[] = []
      events: Record<string, () => void> = {}
      append(...nodes: ReportNode[]) {
        this.children.push(...nodes)
      }
      replaceChildren() {
        this.children = []
      }
      addEventListener(name: string, listener: () => void) {
        this.events[name] = listener
      }
    }
    const nodes: Record<string, ReportNode> = {}
    for (const id of ['benchmark-data', 'status', 'summary', 'result', 'content'])
      nodes[id] = new ReportNode()
    nodes['benchmark-data'].textContent = scripts[0][1]
    nodes.result.value = mode === 'strict' ? '0' : '2'
    new Script(scripts[1][1]).runInNewContext({
      document: {
        getElementById: (id: string) => nodes[id],
        createElement: () => new ReportNode(),
      },
    })
    assert.equal(nodes.content.children.filter((node) => node.children.length > 0).length, 2)
    assert.match(nodes.summary.textContent, /4 explained \/ 4 changes/)
    nodes.result.value = mode === 'strict' ? '2' : '0'
    nodes.result.events.change()
    assert.match(nodes.content.children.at(-1)!.textContent, /Not selected for this/)
    nodes.result.value = mode === 'strict' ? '4' : '6'
    nodes.result.events.change()
    assert.match(nodes.content.children.at(-1)!.textContent, /No changes/)
    assert.match(html, /node.textContent = text/)
    assert.equal(html.includes('fetch('), false)
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`failure and interruption save current work and leave all remaining changes Not run (${mode})`, async (t) => {
    const saved = await source(t)
    for (const isFailure of [true, false]) {
      let calls = 0
      const result = await runExplanationBenchmark({
        plan: prepareExplanationBenchmark(saved.folder, mode),
        outputRoot: directory(t),
        shouldStop: () => !isFailure && calls > 0,
        transport: {
          async send() {
            calls++
            return isFailure
              ? { correctedText: null, errorCode: 'UPSTREAM_ERROR', details: { costUsd: 0.01 } }
              : { correctedText: 'Синтетическое объяснение.', errorCode: null, details: {} }
          },
          async close() {},
        },
      })
      assert.equal(calls, 1)
      assert.equal(result.run.status, isFailure ? 'failed' : 'interrupted')
      const changes = result.run.results.flatMap((item) => item.changes)
      assert.equal(changes[0].status, isFailure ? 'failed' : 'succeeded')
      assert.ok(changes.slice(1).every((change) => change.status === 'not-run'))
      assert.equal(existsSync(join(result.folder, 'report.html')), true)
    }
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`timeouts and incomplete answers stop the Explain benchmark without retries (${mode})`, async (t) => {
    const saved = await source(t)
    for (const code of ['TIMEOUT', 'INVALID_RESPONSE'] as const) {
      let calls = 0
      let signal: AbortSignal | undefined
      const result = await runExplanationBenchmark({
        plan: prepareExplanationBenchmark(saved.folder, mode),
        outputRoot: directory(t),
        timeoutMs: 5,
        transport: mockOpenRouterTransport({
          async send(_body, requestSignal) {
            calls++
            signal = requestSignal
            if (code === 'TIMEOUT') return new Promise(() => {})
            return {
              status: 200,
              data: {
                choices: [
                  {
                    finish_reason: 'length',
                    message: {
                      role: 'assistant',
                      content: 'Объяснение.',
                      reasoning: 'synthetic reasoning',
                    },
                  },
                ],
              },
            }
          },
          async close() {},
        }),
      })
      assert.equal(calls, 1)
      assert.equal(result.run.errorCode, code)
      if (code === 'TIMEOUT') assert.equal(signal?.aborted, true)
    }
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`invalid source files fail before outputs or transport; source metadata must match SQLite (${mode})`, async (t) => {
    const folder = directory(t)
    assert.throws(() => prepareExplanationBenchmark(folder), BenchmarkInputError)
    assert.deepEqual(readdirSync(folder), [])
    const saved = await source(t)
    const path = join(saved.folder, 'run.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    manifest.cases[0].text = 'Different synthetic text'
    writeFileSync(path, JSON.stringify(manifest))
    const before = snapshot(saved.folder)
    assert.throws(() => prepareExplanationBenchmark(saved.folder, mode), BenchmarkInputError)
    assert.deepEqual(snapshot(saved.folder), before)
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`unwritable report stops before any paid request and always closes transport (${mode})`, async (t) => {
    const saved = await source(t)
    let calls = 0
    let closed = 0
    await assert.rejects(
      runExplanationBenchmark({
        plan: prepareExplanationBenchmark(saved.folder, mode),
        outputRoot: directory(t),
        onCreated: (folder) => mkdirSync(join(folder, 'report.html')),
        transport: {
          async send() {
            calls++
            throw Error('unexpected')
          },
          async close() {
            closed++
          },
        },
      }),
    )
    assert.equal(calls, 0)
    assert.equal(closed, 1)
  })
}

for (const mode of ['strict', 'gentle-rewrite'] as const) {
  test(`Explain benchmarks accept Gemini reasoning metadata and preserve reported usage (${mode})`, async (t) => {
    const saved = await source(t)
    for (const reasoningTokens of [0, 7]) {
      let calls = 0
      const result = await runExplanationBenchmark({
        plan: prepareExplanationBenchmark(saved.folder, mode),
        outputRoot: directory(t),
        transport: mockOpenRouterTransport({
          async send(body) {
            calls++
            assert.deepEqual(
              (body as { reasoning: object }).reasoning,
              (body as { model: string }).model === MODELS[1].id
                ? { effort: 'minimal' }
                : { enabled: false },
            )
            return {
              status: 200,
              data: {
                model: (body as { model: string }).model,
                choices: [
                  {
                    finish_reason: 'stop',
                    message: {
                      role: 'assistant',
                      content: 'Синтетическое объяснение.',
                      reasoning: 'synthetic reasoning',
                      reasoning_content: 'synthetic reasoning',
                      reasoning_details: [{ type: 'reasoning.text', text: 'synthetic reasoning' }],
                    },
                  },
                ],
                usage: {
                  prompt_tokens: 12,
                  completion_tokens: 8,
                  cost: 0.001,
                  completion_tokens_details: { reasoning_tokens: reasoningTokens },
                },
              },
            }
          },
          async close() {},
        }),
      })
      assert.equal(calls, 4)
      assert.equal(result.run.status, 'completed')
      assert.equal(result.run.isRejectReasoning, false)
      for (const change of result.run.results.flatMap((item) => item.changes)) {
        assert.equal(change.status, 'succeeded')
        assert.equal(change.details.reasoningTokens, reasoningTokens)
        assert.equal(change.details.costUsd, 0.001)
      }
    }
  })
}
