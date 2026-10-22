import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import { DEFAULT_MODEL_ID, MODELS, HistorySearchQuery } from '@gramota/contracts'
import { SqliteDatabase } from '../src/database'
import { createCorrectionService, AttemptError, type CorrectionTransport } from '../src/correction'
import { OPENROUTER_REQUEST_DEFAULTS, STRICT_PROMPT_VERSION } from '../src/correction/constants'
import application from '../src/app'

const original = 'Синтетический пример'
const firstDate = '2026-10-20T00:00:00.000Z'
const reusedDate = '2026-10-22T00:00:00.000Z'

function fixture(database: SqliteDatabase) {
  let calls = 0
  let isFailing = false
  let date = firstDate
  const transport: CorrectionTransport = {
    async send() {
      calls++
      if (isFailing) return { correctedText: null, errorCode: 'UPSTREAM_ERROR', details: {} }
      return {
        correctedText: `${original}. ${calls}`,
        errorCode: null,
        details: { costUsd: 0.00001, inputTokens: 20, outputTokens: 5 },
      }
    },
    async close() {},
  }
  const correct = createCorrectionService({
    repository: database.corrections,
    transport,
    isAvailable: true,
    now: () => date,
  })
  return {
    correct,
    transport,
    calls: () => calls,
    fail: () => {
      isFailing = true
    },
    useDate: (value: string) => {
      date = value
    },
  }
}

test('reuses persisted success without another attempt or cost; touches only last-used date', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'gramota-cache-'))
  const path = join(folder, 'db.sqlite')
  let db = new SqliteDatabase(path)
  t.after(() => {
    db.close()
    rmSync(folder, { recursive: true, force: true })
  })
  const f = fixture(db)
  const result = await f.correct(original)
  const before = db.history.get(result.correctionId)!
  const selection = {
    requestId: result.requestId,
    originalRange: { start: 0, end: 1 },
    correctedRange: { start: 0, end: 1 },
  }
  db.explanations.save(selection, 'Синтетическое объяснение.')
  db.close()
  db = new SqliteDatabase(path)
  const unavailable = createCorrectionService({
    repository: db.corrections,
    transport: null,
    isAvailable: false,
    now: () => reusedDate,
  })
  const saved = await unavailable(original)
  assert.deepEqual(saved, { ...result, isCached: true })
  const after = db.history.get(result.correctionId)!
  assert.equal(after.lastUsedAt, reusedDate)
  assert.equal(after.createdAt, before.createdAt)
  assert.deepEqual(after.requests, before.requests)
  assert.equal(db.explanations.get(selection), 'Синтетическое объяснение.')
  assert.equal(db.explanations.getSource(result.requestId)?.correctedText, result.correctedText)
  assert.equal(db.history.list(HistorySearchQuery.parse({ from: reusedDate })).total, 1)
  assert.equal(db.history.list(HistorySearchQuery.parse({ to: reusedDate })).total, 0)
  assert.equal(f.calls(), 1)
})

test('refresh bypasses reuse, newest generation wins, failure keeps the previous successful result', async (t) => {
  const db = new SqliteDatabase(':memory:')
  t.after(() => db.close())
  const f = fixture(db)
  const first = await f.correct(original)
  f.useDate(reusedDate)
  const fresh = await f.correct(
    original,
    DEFAULT_MODEL_ID,
    first.correctionId,
    undefined,
    'strict',
    true,
  )
  assert.equal(fresh.isCached, false)
  assert.notEqual(first.requestId, fresh.requestId)
  assert.equal((await f.correct(original)).requestId, fresh.requestId)
  f.fail()
  await assert.rejects(
    f.correct(original, DEFAULT_MODEL_ID, first.correctionId, undefined, 'strict', true),
  )
  assert.equal((await f.correct(original)).requestId, fresh.requestId)
  assert.equal(db.history.get(first.correctionId)!.requests.length, 3)
})

test('Gemma searches globally but validates references; Gemini stays with its displayed Gemma entry', async (t) => {
  const db = new SqliteDatabase(':memory:')
  t.after(() => db.close())
  const f = fixture(db)
  const first = await f.correct(original)
  const gemini = await f.correct(original, MODELS[1].id, first.correctionId)
  f.useDate(reusedDate)
  const other = await f.correct(original, DEFAULT_MODEL_ID, undefined, undefined, 'strict', true)
  const second = await f.correct(original, MODELS[1].id, other.correctionId)
  assert.notEqual(gemini.requestId, second.requestId)
  assert.equal(
    (await f.correct(original, MODELS[1].id, first.correctionId)).requestId,
    gemini.requestId,
  )
  assert.equal(
    (await f.correct(original, DEFAULT_MODEL_ID, first.correctionId)).requestId,
    other.requestId,
  )
  for (const id of [randomUUID(), (await f.correct('Другой текст')).correctionId]) {
    await assert.rejects(
      f.correct(original, DEFAULT_MODEL_ID, id),
      (error: unknown) => error instanceof AttemptError && error.code === 'INVALID_INPUT',
    )
  }
  db.history.softDelete(first.correctionId)
  await assert.rejects(f.correct(original, MODELS[1].id, first.correctionId))
  assert.equal(
    db.corrections.findReusable({
      originalText: original,
      modelId: MODELS[1].id,
      mode: 'strict',
      promptVersion: STRICT_PROMPT_VERSION,
      parameters: { ...OPENROUTER_REQUEST_DEFAULTS, model: MODELS[1].id },
      forceRefresh: false,
      usedAt: reusedDate,
    })?.requestId,
    second.requestId,
  )
})

test('lookup identity is exact and ignores failed, pending, deleted and incompatible historical requests', async (t) => {
  const db = new SqliteDatabase(':memory:')
  t.after(() => db.close())
  const f = fixture(db)
  const initial = await f.correct(original)
  const lookup = (changes = {}) =>
    db.corrections.findReusable({
      originalText: original,
      modelId: DEFAULT_MODEL_ID,
      mode: 'strict',
      promptVersion: STRICT_PROMPT_VERSION,
      parameters: OPENROUTER_REQUEST_DEFAULTS,
      usedAt: reusedDate,
      forceRefresh: false,
      ...changes,
    })
  assert.equal(lookup()?.requestId, initial.requestId)
  assert.equal(
    lookup({
      parameters: {
        provider: { allow_fallbacks: false, require_parameters: true },
        max_tokens: 8192,
        reasoning: { enabled: false },
        stream: false,
        model: DEFAULT_MODEL_ID,
      },
    })?.requestId,
    initial.requestId,
  )
  for (const changes of [
    { originalText: original + ' ' },
    { originalText: original.replace(' ', '  ') },
    { modelId: MODELS[1].id },
    { mode: 'gentle-rewrite' },
    { promptVersion: 'strict-v0' },
    { parameters: { ...OPENROUTER_REQUEST_DEFAULTS, max_tokens: 100 } },
  ])
    assert.equal(lookup(changes), null)
  db.history.softDelete(initial.correctionId)
  assert.equal(lookup(), null)
  const pending = { correctionId: randomUUID(), requestId: randomUUID() }
  db.corrections.beginAttempt({
    ids: pending,
    originalText: original,
    modelId: DEFAULT_MODEL_ID,
    mode: 'strict',
    promptVersion: STRICT_PROMPT_VERSION,
    parameters: OPENROUTER_REQUEST_DEFAULTS,
    startedAt: reusedDate,
  })
  assert.equal(lookup(), null)
  db.corrections.finishAttempt(pending.requestId, {
    status: 'failed',
    correctedText: null,
    endedAt: reusedDate,
    durationMs: 1,
    errorCode: 'UPSTREAM_ERROR',
    errorMessage: 'Synthetic failure',
  })
  assert.equal(lookup(), null)
  const unchanged = fixture(db)
  unchanged.transport.send = async () => ({ correctedText: original, errorCode: null, details: {} })
  const noChange = await unchanged.correct(original)
  assert.equal((await unchanged.correct(original)).requestId, noChange.requestId)
})

test('API validates cache controls and storage lookup failures never call transport', async (t) => {
  const db = new SqliteDatabase(':memory:')
  const f = fixture(db)
  const app = Fastify()
  await application(app, {
    correction: {
      database: db,
      transport: f.transport,
      environment: { NODE_ENV: 'development', OPENROUTER_API_KEY: 'fictional-key' },
    },
  })
  t.after(() => app.close())
  const post = (extra = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/corrections',
      payload: { text: original, modelId: DEFAULT_MODEL_ID, ...extra },
    })
  assert.equal((await post({ forceRefresh: 'true' })).statusCode, 400)
  const first = (await post()).json()
  assert.equal(first.isCached, false)
  assert.deepEqual((await post()).json(), { ...first, isCached: true })
  assert.equal((await post({ forceRefresh: true })).json().isCached, false)
  db.corrections.findReusable = () => {
    throw new Error('Synthetic storage failure')
  }
  assert.equal((await post()).json().error.code, 'STORAGE_ERROR')
  assert.equal(f.calls(), 2)
})

test('both modes and models reuse independently; last-used sorting moves reused entries', async (t) => {
  const db = new SqliteDatabase(':memory:')
  t.after(() => db.close())
  const f = fixture(db)
  const first = await f.correct(original)
  for (const mode of ['strict', 'gentle-rewrite'] as const) {
    for (const model of MODELS) {
      const result = await f.correct(original, model.id, first.correctionId, undefined, mode)
      const cached = await f.correct(original, model.id, first.correctionId, undefined, mode)
      assert.equal(cached.requestId, result.requestId)
      assert.equal(cached.isCached, true)
    }
  }
  assert.equal(f.calls(), 4)
  f.useDate('2026-10-21T00:00:00.000Z')
  const other = await f.correct('Другой синтетический пример')
  assert.equal(db.history.list().items[0].id, other.correctionId)
  f.useDate(reusedDate)
  await f.correct(original)
  assert.equal(db.history.list().items[0].id, first.correctionId)
  assert.equal(
    db.history.list(HistorySearchQuery.parse({ sort: 'oldest' })).items[0].id,
    other.correctionId,
  )
  const detail = db.history.get(first.correctionId)!
  assert.equal(detail.createdAt, firstDate)
  assert.equal(detail.lastUsedAt, reusedDate)
  assert.equal(detail.requests.length, 4)
})
