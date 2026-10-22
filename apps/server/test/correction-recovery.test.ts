import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { CorrectionSuccess, HistorySearchQuery, MODELS } from '@gramota/contracts'
import application, { options } from '../src/app'
import { SqliteDatabase } from '../src/database'
import { parseOpenRouterReply } from '../src/openrouter'
import { mockOpenRouterTransport } from './mock-transport'

const original = 'Синтетический пример'
const corrected = 'Синтетический пример!'
const reasoning = 'Synthetic private reasoning, never store or display.'

function output(message: object = {}, choice: object = {}) {
  return {
    choices: [
      {
        finish_reason: 'stop',
        message: { role: 'assistant', content: corrected, ...message },
        ...choice,
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.00002 },
  }
}

test('complete output survives every reasoning signal without exposing reasoning text', () => {
  for (const data of [
    output({ reasoning }),
    output({ reasoning_content: reasoning }),
    output({ reasoning_details: [{ text: reasoning }] }),
    { ...output(), usage: { completion_tokens_details: { reasoning_tokens: 2 } } },
  ]) {
    const reply = parseOpenRouterReply({ status: 200, data })
    assert.equal(reply.correctedText, corrected)
    assert.equal(reply.errorCode, 'REASONING_NOT_DISABLED')
    assert.equal(JSON.stringify(reply).includes(reasoning), false)
    assert.equal(parseOpenRouterReply({ status: 200, data }, false).errorCode, null)
  }
})

test('missing, malformed, truncated and refused output remain failures even with reasoning', () => {
  for (const data of [
    output({ content: '', reasoning }),
    output({ content: ' \n ', reasoning }),
    output({ content: null, reasoning }),
    output({ content: [{ text: corrected }], reasoning }),
    output({ reasoning }, { finish_reason: 'length' }),
    output({ reasoning }, { finish_reason: 'error' }),
    output({ refusal: 'refused', reasoning }),
    output({ role: 'user', reasoning }),
    { ...output({ reasoning }), error: { message: reasoning } },
    { ...output({ reasoning }), choices: [...output().choices, ...output().choices] },
    { usage: { cost: 0.01 } },
  ]) {
    const reply = parseOpenRouterReply({ status: 200, data })
    assert.equal(reply.errorCode, 'INVALID_RESPONSE')
    assert.equal(reply.correctedText, null)
    assert.equal(JSON.stringify(reply).includes(reasoning), false)
  }
  assert.equal(
    parseOpenRouterReply({ status: 502, data: output({ reasoning }) }).correctedText,
    null,
  )
})

test('application returns normal success and logs metadata only for both models and modes', async (t) => {
  const logs: string[] = []
  const db = new SqliteDatabase(':memory:')
  const app = Fastify({
    ...options,
    logger: {
      ...(typeof options.logger === 'object' ? options.logger : {}),
      stream: { write: (line: string) => logs.push(line) },
    },
  })
  await application(app, {
    correction: {
      database: db,
      transport: mockOpenRouterTransport({
        async send() {
          return { status: 200, data: output({ reasoning }) }
        },
        async close() {},
      }),
      environment: { NODE_ENV: 'development', OPENROUTER_API_KEY: 'synthetic-test-key' },
    },
  })
  t.after(() => app.close())
  for (const model of MODELS)
    for (const mode of ['strict', 'gentle-rewrite']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/corrections',
        payload: { text: original, modelId: model.id, mode },
      })
      assert.equal(response.statusCode, 200)
      const result = CorrectionSuccess.parse(response.json())
      assert.equal(result.correctedText, corrected)
      assert.equal(result.mode, mode)
      assert.equal(result.modelId, model.id)
      assert.equal('warning' in result, false)
      assert.equal('error' in result, false)
      const request = db.history.get(result.correctionId)!.requests[0]
      assert.equal(request.status, 'succeeded')
      assert.equal(request.correctedText, corrected)
      assert.equal(request.costUsd, 0.00002)
      assert.equal(request.inputTokens, 10)
      assert.equal(request.outputTokens, 5)
      assert.equal(request.errorCode, null)
      assert.equal(request.errorMessage, null)
      assert.equal(db.explanations.getSource(result.requestId)?.correctedText, corrected)
      assert.equal(JSON.stringify(request).includes(reasoning), false)
      assert.equal(response.body.includes(reasoning), false)
      const recorded = logs
        .map((line) => JSON.parse(line))
        .filter((line) => line.attemptId === result.requestId)
      assert.equal(recorded.length, 1)
      assert.equal(recorded[0].code, 'REASONING_NOT_DISABLED')
      assert.equal(recorded[0].modelId, model.id)
      assert.equal(recorded[0].level, 40)
    }
  const search = (query: object) => db.history.list(HistorySearchQuery.parse(query))
  assert.equal(search({ result: 'failed' }).total, 0)
  assert.equal(search({ result: 'corrected' }).total, 4)
  assert.equal(search({ model: MODELS[1].id, result: 'corrected', search: 'пример!' }).total, 2)
  assert.equal(logs.join('').includes(reasoning), false)
  assert.equal(logs.join('').includes(original), false)
  assert.equal(logs.join('').includes(corrected), false)
})
