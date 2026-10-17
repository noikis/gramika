import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { MODEL_ID, MODELS, CorrectionConfig, CorrectionSuccess, ModelPreference } from '@gramota/contracts'
import { CorrectionDatabase } from '../src/database'
import { correctionApi } from '../src/correction-api'
import { createCorrectionService, AttemptError, STRICT_PROMPT } from '../src/correction-service'

const environment = { GRAMOTA_ENV: 'development', OPENROUTER_API_KEY: 'fictional-test-key' }
const date = '2026-10-18T00:00:00.000Z'
function output(model: string, content = 'Привет, мир!') {
  return { model, choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
    usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 99, cost: 0.000000001,
      completion_tokens_details: { reasoning_tokens: 0 } } }
}

test('model preference migrates v2 history and persists after reopening', t => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-models-'))
  const file = join(directory, 'test.sqlite')
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  let database = new CorrectionDatabase(file)
  const ids = { correctionId: randomUUID(), requestId: randomUUID() }
  database.begin(ids, '  Fictional text 👋\n', 'old/model', 'strict-v2', {}, date)
  database.finish(ids.requestId, { status: 'succeeded', correctedText: '  Fictional text 👋\n',
    endedAt: date, durationMs: 0, errorCode: null, errorMessage: null })
  database.db.exec('DROP TABLE model_preference; PRAGMA user_version=2;')
  database.close()
  database = new CorrectionDatabase(file)
  assert.equal(database.getModelPreference(), MODEL_ID)
  assert.equal(database.getHistory(ids.correctionId)?.originalText, '  Fictional text 👋\n')
  database.setModelPreference(MODELS[0].id)
  database.close()
  database = new CorrectionDatabase(file)
  try {
    assert.equal(database.getModelPreference(), MODELS[0].id)
    assert.equal(database.db.prepare('PRAGMA user_version').get()?.user_version, 3)
    assert.equal(database.getHistory(ids.correctionId)?.requests[0].correctedText, '  Fictional text 👋\n')
  } finally { database.close() }
})

test('preference routes validate, expose unsupported selection and handle save failure without inference', async t => {
  const database = new CorrectionDatabase(':memory:')
  const app = Fastify()
  let calls = 0
  await correctionApi(app, { environment: {}, database, transport: {
    async send() { calls++; throw Error('Must not invoke transport') }, async close() {},
  } })
  t.after(() => app.close())
  let config = CorrectionConfig.parse((await app.inject('/api/correction-config')).json())
  assert.equal(config.modelId, MODEL_ID)
  assert.deepEqual(config.models, MODELS)
  assert.equal(config.available, false)
  const save = (payload: object) => app.inject({ method: 'PUT', url: '/api/model-preference', payload })
  assert.equal((await save({ modelId: MODELS[1].id })).statusCode, 200)
  assert.equal(database.getModelPreference(), MODELS[1].id)
  for (const payload of [{}, { modelId: 'unknown' }, { modelId: MODEL_ID, reasoning: true }]) {
    assert.equal((await save(payload)).statusCode, 400)
    assert.equal(database.getModelPreference(), MODELS[1].id)
  }
  database.db.prepare('UPDATE model_preference SET model_id=?').run('removed/model')
  config = CorrectionConfig.parse((await app.inject('/api/correction-config')).json())
  assert.equal(config.modelId, null)
  assert.equal((await save({ modelId: MODEL_ID })).statusCode, 200)
  database.db.exec(`CREATE TRIGGER deny_preference BEFORE UPDATE ON model_preference
    BEGIN SELECT RAISE(ABORT, 'private storage detail'); END;`)
  const failed = await save({ modelId: MODELS[0].id })
  assert.equal(failed.statusCode, 503)
  assert.equal(failed.json().error.code, 'STORAGE_ERROR')
  assert.equal(failed.body.includes('private'), false)
  assert.equal(database.getModelPreference(), MODEL_ID)
  assert.equal(calls, 0)
})

test('config and preference writes fail safely without storage', async t => {
  const app = Fastify()
  await correctionApi(app, { environment: {}, database: null })
  t.after(() => app.close())
  assert.equal((await app.inject('/api/correction-config')).statusCode, 503)
  assert.equal((await app.inject({ method: 'PUT', url: '/api/model-preference',
    payload: { modelId: MODEL_ID } })).statusCode, 503)
  assert.equal(ModelPreference.safeParse({ modelId: 'openai/gpt-5-nano' }).success, false)
})

test('all models repeat one original with independent immutable outcomes and no reasoning', async t => {
  const database = new CorrectionDatabase(':memory:')
  const app = Fastify()
  const original = '  Привет мир! 👋\n'
  let calls = 0
  await correctionApi(app, { environment, database, transport: {
    async send(body) {
      const value = body as { model: string; reasoning: { enabled: boolean }; messages: unknown[] }
      assert.deepEqual(value.reasoning, { enabled: false })
      assert.deepEqual(value.messages, [{ role: 'system', content: STRICT_PROMPT }, { role: 'user', content: original }])
      calls++
      if (calls === 2) return { status: 502, data: { error: 'fictional failure' } }
      return { status: 200, data: output(value.model, original + calls) }
    }, async close() {},
  } })
  t.after(() => app.close())
  let correctionId: string | undefined
  for (const model of MODELS) {
    const response = await app.inject({ method: 'POST', url: '/api/corrections',
      payload: { text: original, modelId: model.id, correctionId } })
    if (calls === 2) {
      assert.equal(response.statusCode, 502)
      assert.equal(response.json().correctionId, correctionId)
      continue
    }
    assert.equal(response.statusCode, 200)
    const result = CorrectionSuccess.parse(response.json())
    correctionId ??= result.correctionId
    assert.equal(result.correctionId, correctionId)
    assert.equal(result.modelId, model.id)
  }
  const detail = database.getHistory(correctionId!)!
  assert.equal(detail.originalText, original)
  assert.equal(detail.requests.length, MODELS.length)
  assert.equal(new Set(detail.requests.map(request => request.id)).size, MODELS.length)
  assert.deepEqual(new Set(detail.requests.map(request => request.requestedModel)), new Set(MODELS.map(model => model.id)))
  assert.equal(detail.requests.filter(request => request.status === 'failed').length, 1)
  for (const request of detail.requests) {
    assert.equal(request.parameters.model, request.requestedModel)
    assert.deepEqual(request.parameters.reasoning, { enabled: false })
    if (request.status === 'succeeded') {
      assert.equal(request.totalTokens, 99)
      assert.equal(request.costUsd, 0.000000001)
    }
  }
  assert.equal(database.listHistory().items.length, 1)
  assert.equal(database.getModelPreference(), MODEL_ID)
  assert.equal(calls, MODELS.length)
})

test('invalid models and repeat references make no paid calls or new records; changed text starts fresh', async t => {
  const database = new CorrectionDatabase(':memory:')
  const app = Fastify()
  let calls = 0
  await correctionApi(app, { environment, database, transport: {
    async send() { calls++; return { status: 200, data: output(MODEL_ID) } }, async close() {},
  } })
  t.after(() => app.close())
  const run = (payload: object) => app.inject({ method: 'POST', url: '/api/corrections', payload })
  const first = (await run({ text: 'Original', modelId: MODEL_ID })).json()
  for (const payload of [
    { text: 'Original', modelId: 'unknown' }, { text: 'Original' },
    { text: 'Original', modelId: MODEL_ID, correctionId: 'invalid' },
    { text: 'Original', modelId: MODEL_ID, correctionId: randomUUID() },
    { text: 'Original ', modelId: MODEL_ID, correctionId: first.correctionId },
  ]) {
    const response = await run(payload)
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'INVALID_INPUT')
    assert.equal(calls, 1)
    assert.equal(database.getHistory(first.correctionId)?.requests.length, 1)
  }
  const next = (await run({ text: 'Different', modelId: MODEL_ID })).json()
  assert.notEqual(next.correctionId, first.correctionId)
  assert.equal(database.listHistory().items.length, 2)
})

test('concurrent models keep their own parameters even when preference changes', async t => {
  const database = new CorrectionDatabase(':memory:')
  t.after(() => database.close())
  const sent: { model: string; reasoning: { enabled: boolean } }[] = []
  const releases: (() => void)[] = []
  const correct = createCorrectionService({ database, available: true, transport: {
    async send(body) {
      const value = body as typeof sent[number]
      sent.push(value)
      await new Promise<void>(resolve => releases.push(resolve))
      return { status: 200, data: output(value.model) }
    }, async close() {},
  } })
  const first = correct('First', MODELS[0].id)
  const second = correct('Second', MODELS[1].id)
  database.setModelPreference(MODELS[3].id)
  releases.forEach(release => release())
  const results = await Promise.all([first, second])
  assert.deepEqual(results.map(result => result.modelId), [MODELS[0].id, MODELS[1].id])
  assert.notEqual(sent[0].reasoning, sent[1].reasoning)
  for (const result of results) {
    assert.equal(database.getHistory(result.correctionId)?.requests[0].parameters.model, result.modelId)
  }
  await assert.rejects(correct('text', 'unknown'), (error: unknown) =>
    error instanceof AttemptError && error.code === 'INVALID_INPUT')
})
