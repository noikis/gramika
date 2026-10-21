import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import {
  CorrectionInput,
  CorrectionSuccess,
  DEFAULT_MODEL_ID,
  HistoryDetail,
  MODELS,
} from '@gramota/contracts'
import application from '../src/app'
import { SqliteDatabase } from '../src/database'
import {
  AttemptError,
  createCorrectionService,
  REWRITE_PROMPT,
  REWRITE_PROMPT_VERSION,
  STRICT_PROMPT,
  type CorrectionTransport,
} from '../src/correction'

const original = '  Пожалуйста, пришли макет завтра до 15:00.\n'
const rewrite = 'gentle-rewrite'
const environment = { NODE_ENV: 'development', OPENROUTER_API_KEY: 'fictional-test-key' }

test('mode contract defaults only omitted input and rejects unknown modes', () => {
  assert.equal(CorrectionInput.parse({ text: original, modelId: DEFAULT_MODEL_ID }).mode, 'strict')
  for (const mode of [null, '', 'rewrite', 'STRICT', {}, 1])
    assert.equal(
      CorrectionInput.safeParse({ text: original, modelId: DEFAULT_MODEL_ID, mode }).success,
      false,
    )
})

test('mixed modes and models keep exact original, pending metadata and immutable outcomes', async (t) => {
  const database = new SqliteDatabase(':memory:')
  const app = Fastify()
  let calls = 0
  let shouldFail = false
  const sent: { model: string; messages: { role: string; content: string }[] }[] = []
  const transport: CorrectionTransport = {
    async send(body, _signal, isRejectReasoning) {
      calls++
      const value = body as (typeof sent)[number]
      sent.push(value)
      const pending = database.db
        .prepare<unknown[], { mode: string; prompt_version: string }>(
          "SELECT mode, prompt_version FROM model_requests WHERE status = 'pending'",
        )
        .get()!
      assert.equal(pending.mode, calls === 1 ? 'strict' : rewrite)
      assert.equal(pending.prompt_version, calls === 1 ? 'strict-v3' : REWRITE_PROMPT_VERSION)
      assert.deepEqual(value.messages, [
        { role: 'system', content: calls === 1 ? STRICT_PROMPT : REWRITE_PROMPT },
        { role: 'user', content: original },
      ])
      assert.deepEqual((body as { reasoning: object }).reasoning, { enabled: false })
      assert.deepEqual((body as { provider: object }).provider, {
        require_parameters: true,
        allow_fallbacks: false,
      })
      assert.notEqual(isRejectReasoning, false)
      if (shouldFail)
        return { correctedText: null, errorCode: 'UPSTREAM_ERROR', details: { costUsd: 0 } }
      return {
        correctedText: calls === 1 ? 'Синтетический результат.' : original,
        errorCode: null,
        details: { inputTokens: 42, outputTokens: 8, costUsd: 0.00001 },
      }
    },
    async close() {},
  }
  await application(app, { correction: { environment, database, transport } })
  t.after(() => app.close())
  const run = (payload: object) => app.inject({ method: 'POST', url: '/api/corrections', payload })
  const first = CorrectionSuccess.parse(
    (await run({ text: original, modelId: MODELS[0].id })).json(),
  )
  assert.equal(first.mode, 'strict')
  for (const model of MODELS) {
    const response = await run({
      text: original,
      modelId: model.id,
      mode: rewrite,
      correctionId: first.correctionId,
    })
    assert.equal(response.statusCode, 200)
    const result = CorrectionSuccess.parse(response.json())
    assert.equal(result.mode, rewrite)
    assert.equal(result.correctedText, original)
    assert.equal(result.correctionId, first.correctionId)
  }
  shouldFail = true
  const failed = await run({
    text: original,
    modelId: DEFAULT_MODEL_ID,
    mode: rewrite,
    correctionId: first.correctionId,
  })
  assert.equal(failed.statusCode, 502)
  assert.equal(failed.json().correctionId, first.correctionId)
  const detail = HistoryDetail.parse(
    (await app.inject('/api/history/' + first.correctionId)).json(),
  )
  assert.equal('mode' in detail, false)
  assert.deepEqual(
    detail.requests.map((request) => request.mode),
    ['strict', rewrite, rewrite, rewrite],
  )
  assert.deepEqual(
    detail.requests.map((request) => request.status),
    ['succeeded', 'succeeded', 'succeeded', 'failed'],
  )
  assert.equal(detail.requests[0].correctedText, 'Синтетический результат.')
  assert.equal(detail.requests[detail.requests.length - 1]?.promptVersion, 'rewrite-v1')
  assert.equal(detail.requests[detail.requests.length - 1]?.costUsd, 0)
  assert.equal(database.history.list().total, 1)
  assert.equal(calls, 4)
  assert.equal(sent.filter((body) => body.messages[0].content === REWRITE_PROMPT).length, 3)

  for (const payload of [
    { text: original, modelId: DEFAULT_MODEL_ID, mode: 'unknown' },
    { text: original, modelId: DEFAULT_MODEL_ID, mode: null },
    { text: original, modelId: DEFAULT_MODEL_ID, mode: rewrite, correctionId: randomUUID() },
    {
      text: 'Changed original',
      modelId: DEFAULT_MODEL_ID,
      mode: rewrite,
      correctionId: first.correctionId,
    },
  ]) {
    const rejected = await run(payload)
    assert.equal(rejected.statusCode, 400)
    assert.equal(rejected.json().error.code, 'INVALID_INPUT')
  }
  assert.equal(calls, 4)
  assert.equal(database.history.get(first.correctionId)?.requests.length, 4)
})

test('legacy service callers stay Strict and invalid modes stop before transport', async (t) => {
  const database = new SqliteDatabase(':memory:')
  t.after(() => database.close())
  let calls = 0
  const correct = createCorrectionService({
    repository: database.corrections,
    isAvailable: true,
    transport: {
      async send(body) {
        calls++
        assert.equal(
          (body as { messages: { content: string }[] }).messages[0].content,
          STRICT_PROMPT,
        )
        return { correctedText: original, errorCode: null, details: {} }
      },
      async close() {},
    },
  })
  const result = await correct(original)
  assert.equal(result.mode, 'strict')
  assert.equal(database.history.get(result.correctionId)?.requests[0].mode, 'strict')
  await assert.rejects(
    correct(original, DEFAULT_MODEL_ID, undefined, undefined, 'unknown' as typeof rewrite),
    (error: unknown) => error instanceof AttemptError && error.code === 'INVALID_INPUT',
  )
  assert.equal(calls, 1)
})
