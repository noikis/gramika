import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import Fastify from 'fastify'
import { HistoryDetail, HistoryList } from '@gramota/contracts'
import { CorrectionDatabase } from '../src/database'
import { createCorrectionService } from '../src/correction-service'
import { correctionApi } from '../src/correction-api'

const date = '2026-10-18T01:00:00.000Z'
function begin(db: CorrectionDatabase, text = 'Привет мир!', at = date) {
  const ids = { correctionId: randomUUID(), requestId: randomUUID() }
  db.begin(ids, text, 'fictional/model-a', 'strict-v2', { reasoning: { enabled: false } }, at)
  return ids
}

test('v1 migration preserves saved text, outcomes and generation IDs; new metrics stay null', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-history-'))
  const file = join(directory, 'v1.sqlite')
  const raw = new DatabaseSync(file)
  const correctionId = randomUUID(), requestId = randomUUID()
  raw.exec(`CREATE TABLE corrections (id TEXT PRIMARY KEY, created_at TEXT, original_text TEXT, language TEXT, mode TEXT);
    CREATE TABLE model_requests (id TEXT PRIMARY KEY, correction_id TEXT, requested_model TEXT, returned_model TEXT,
      provider TEXT, provider_request_id TEXT, prompt_version TEXT, parameters_json TEXT, corrected_text TEXT,
      started_at TEXT, ended_at TEXT, duration_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER,
      reasoning_tokens INTEGER, cached_input_tokens INTEGER, cost_usd REAL, finish_reason TEXT,
      status TEXT, error_code TEXT, error_message TEXT);
    PRAGMA user_version=1;`)
  raw.prepare('INSERT INTO corrections VALUES(?,?,?,?,?)').run(correctionId, date, '  Старый текст 👋\n', 'ru', 'strict')
  raw.prepare('INSERT INTO model_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    requestId, correctionId, 'fictional/model-a', 'fictional/model-a', 'Reported provider', 'gen-old',
    'strict-v1', '{}', '  Старый текст 👋\n', date, date, 100, 12, 4, 0, null, 0.00001, 'stop', 'succeeded', null, null)
  raw.close()
  let db: CorrectionDatabase | undefined
  try {
    db = new CorrectionDatabase(file)
    const detail = db.getHistory(correctionId)!
    assert.equal(detail.originalText, '  Старый текст 👋\n')
    assert.equal(detail.requests[0].openrouterGenerationId, 'gen-old')
    assert.equal(detail.requests[0].correctedText, detail.originalText)
    assert.equal(detail.requests[0].totalTokens, null)
    assert.equal(detail.requests[0].generationTimeMs, null)
    assert.equal(detail.requests[0].appRequestTimeMs, 100)
    db.close(); db = undefined
    db = new CorrectionDatabase(file)
    assert.equal(db.db.prepare('PRAGMA user_version').get()?.user_version, 3)
    assert.equal(db.getHistory(correctionId)?.requests.length, 1)
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('reported metrics survive exactly, without deriving totals or rounding generation time', async () => {
  const db = new CorrectionDatabase(':memory:')
  try {
    const result = await createCorrectionService({ database: db, available: true, transport: {
      async send() { return { status: 200, data: {
        id: 'gen-reported', model: 'fictional/model-returned', provider: 'Top-level provider',
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Привет, мир!' } }],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 99, cost: 0.000000001, is_byok: false,
          prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 3 },
          cost_details: { upstream_inference_cost: 0, upstream_inference_prompt_cost: 0.0000000001,
            upstream_inference_completions_cost: -4 } },
        openrouter_metadata: { generation_time: 123.75, attempt: 1, strategy: 'direct', region: 'example',
          endpoints: { available: [{ provider: 'Unselected', selected: false },
            { provider: 'Selected provider', selected: true }] } },
      } } }, async close() {},
    } })('Привет мир!')
    const request = db.getHistory(result.correctionId)!.requests[0]
    assert.equal(request.provider, 'Selected provider')
    assert.equal(request.openrouterGenerationId, 'gen-reported')
    assert.equal(request.totalTokens, 99)
    assert.equal(request.generationTimeMs, 123.75)
    assert.equal(request.cacheWriteTokens, 3)
    assert.equal(request.cachedInputTokens, 0)
    assert.equal(request.costUsd, 0.000000001)
    assert.equal(request.upstreamInferenceCostUsd, 0)
    assert.equal(request.upstreamCompletionCostUsd, null)
    assert.equal(request.isByok, false)
    assert.equal(request.routingRegion, 'example')
  } finally { db.close() }
})

test('metadata on failed attempts and ambiguous selected providers remain truthful', async () => {
  const db = new CorrectionDatabase(':memory:')
  try {
    for (const endpoints of [{ available: [{ provider: 'A', selected: true }, { provider: 'B', selected: true }] },
      { available: [{ provider: 42, selected: true }] }, null]) {
      await assert.rejects(createCorrectionService({ database: db, available: true, transport: {
        async send() { return { status: 502, data: { error: { message: 'private upstream text' },
          usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 'bad', cost: 0 },
          openrouter_metadata: { attempt: 0, generation_time: -1, endpoints },
        } } }, async close() {},
      } })('fictional text'))
    }
    for (const item of db.listHistory().items) {
      const request = db.getHistory(item.id)!.requests[0]
      assert.equal(request.status, 'failed')
      assert.equal(request.provider, null)
      assert.equal(request.totalTokens, null)
      assert.equal(request.generationTimeMs, null)
      assert.equal(request.inputTokens, 4)
      assert.equal(request.routingAttempt, 0)
      assert.equal(request.costUsd, 0)
      assert.equal(JSON.stringify(request).includes('private upstream text'), false)
    }
  } finally { db.close() }
})

test('History works without a key or upstream calls; orders summaries and all requests', async t => {
  const db = new CorrectionDatabase(':memory:')
  const app = Fastify()
  let calls = 0
  await correctionApi(app, { environment: {}, database: db, transport: {
    async send() { calls++; throw Error('No upstream calls allowed') }, async close() {},
  } })
  t.after(() => app.close())
  assert.deepEqual((await app.inject('/api/history')).json(), { items: [] })
  const original = '👩‍💻'.repeat(121) + '\n<script>fictional</script>'
  const older = begin(db, original)
  db.finish(older.requestId, { status: 'succeeded', correctedText: original, endedAt: date,
    durationMs: 42, errorCode: null, errorMessage: null })
  const nextId = randomUUID()
  db.db.prepare(`INSERT INTO model_requests(id,correction_id,requested_model,prompt_version,parameters_json,started_at,status)
    VALUES(?,?,?,'strict-v2','{}',?,'pending')`).run(nextId, older.correctionId, 'fictional/model-b', '2026-10-18T02:00:00.000Z')
  const newer = begin(db, 'newer', '2026-10-18T03:00:00.000Z')
  db.finish(newer.requestId, { status: 'failed', correctedText: null, endedAt: '2026-10-18T03:00:01.000Z',
    durationMs: 1000, errorCode: 'TIMEOUT', errorMessage: 'Correction timed out.' })
  const list = HistoryList.parse((await app.inject('/api/history')).json())
  assert.equal(list.items[0].id, newer.correctionId)
  assert.equal(list.items[1].preview, '👩‍💻'.repeat(120))
  assert.deepEqual(list.items[1].models, ['fictional/model-a', 'fictional/model-b'])
  assert.equal(JSON.stringify(list).includes('correctedText'), false)
  const detail = HistoryDetail.parse((await app.inject('/api/history/' + older.correctionId)).json())
  assert.equal(detail.originalText, original)
  assert.deepEqual(detail.requests.map(request => request.status), ['succeeded', 'pending'])
  assert.equal(detail.requests[1].correctedText, null)
  assert.equal((await app.inject('/api/history/not-a-uuid')).statusCode, 400)
  assert.equal((await app.inject('/api/history/' + randomUUID())).statusCode, 404)
  assert.equal(calls, 0)
})

test('missing or failed storage returns safe History errors', async t => {
  for (const database of [null, new CorrectionDatabase(':memory:')]) {
    const app = Fastify()
    await correctionApi(app, { environment: {}, database })
    await app.ready()
    const id = database ? begin(database).correctionId : randomUUID()
    if (database) database.db.exec('DROP TABLE model_requests')
    const response = await app.inject('/api/history')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { error: { code: 'HISTORY_UNAVAILABLE',
      message: 'Could not load history. Please try again later.' } })
    const detail = await app.inject('/api/history/' + id)
    assert.equal(detail.statusCode, 503)
    assert.equal(detail.json().error.code, 'HISTORY_UNAVAILABLE')
    t.after(() => app.close())
  }
})

