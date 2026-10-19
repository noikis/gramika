import { mockOpenRouterTransport } from './mock-transport'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { HistoryDetail, HistoryList } from '@gramota/contracts'
import { SqliteDatabase } from '../src/database'
import { createCorrectionService } from '../src/correction'
import application from '../src/app'

const date = '2026-10-18T01:00:00.000Z'
function begin(db: SqliteDatabase, text = 'Привет мир!', at = date) {
  const ids = { correctionId: randomUUID(), requestId: randomUUID() }
  db.corrections.beginAttempt({
    ids: ids,
    originalText: text,
    modelId: 'fictional/model-a',
    promptVersion: 'strict-v2',
    parameters: { reasoning: { enabled: false } },
    startedAt: at,
  })
  return ids
}

test('reported metrics survive exactly, without deriving totals or rounding generation time', async () => {
  const db = new SqliteDatabase(':memory:')
  try {
    const result = await createCorrectionService({
      repository: db.corrections,
      isAvailable: true,
      transport: mockOpenRouterTransport({
        async send() {
          return {
            status: 200,
            data: {
              id: 'gen-reported',
              model: 'fictional/model-returned',
              provider: 'Top-level provider',
              choices: [
                { finish_reason: 'stop', message: { role: 'assistant', content: 'Привет, мир!' } },
              ],
              usage: {
                prompt_tokens: 20,
                completion_tokens: 5,
                total_tokens: 99,
                cost: 0.000000001,
                is_byok: false,
                prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 3 },
                cost_details: {
                  upstream_inference_cost: 0,
                  upstream_inference_prompt_cost: 0.0000000001,
                  upstream_inference_completions_cost: -4,
                },
              },
              openrouter_metadata: {
                generation_time: 123.75,
                attempt: 1,
                strategy: 'direct',
                region: 'example',
                endpoints: {
                  available: [
                    { provider: 'Unselected', selected: false },
                    { provider: 'Selected provider', selected: true },
                  ],
                },
              },
            },
          }
        },
        async close() {},
      }),
    })('Привет мир!')
    const request = db.history.get(result.correctionId)!.requests[0]
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
  } finally {
    db.close()
  }
})

test('metadata on failed attempts and ambiguous selected providers remain truthful', async () => {
  const db = new SqliteDatabase(':memory:')
  try {
    for (const endpoints of [
      {
        available: [
          { provider: 'A', selected: true },
          { provider: 'B', selected: true },
        ],
      },
      { available: [{ provider: 42, selected: true }] },
      null,
    ]) {
      await assert.rejects(
        createCorrectionService({
          repository: db.corrections,
          isAvailable: true,
          transport: mockOpenRouterTransport({
            async send() {
              return {
                status: 502,
                data: {
                  error: { message: 'private upstream text' },
                  usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 'bad', cost: 0 },
                  openrouter_metadata: { attempt: 0, generation_time: -1, endpoints },
                },
              }
            },
            async close() {},
          }),
        })('fictional text'),
      )
    }
    for (const item of db.history.list().items) {
      const request = db.history.get(item.id)!.requests[0]
      assert.equal(request.status, 'failed')
      assert.equal(request.provider, null)
      assert.equal(request.totalTokens, null)
      assert.equal(request.generationTimeMs, null)
      assert.equal(request.inputTokens, 4)
      assert.equal(request.routingAttempt, 0)
      assert.equal(request.costUsd, 0)
      assert.equal(JSON.stringify(request).includes('private upstream text'), false)
    }
  } finally {
    db.close()
  }
})

test('History works without a key or upstream calls; orders summaries and all requests', async (t) => {
  const db = new SqliteDatabase(':memory:')
  const app = Fastify()
  let calls = 0
  await application(app, {
    correction: {
      environment: {},
      database: db,
      transport: mockOpenRouterTransport({
        async send() {
          calls++
          throw Error('No upstream calls allowed')
        },
        async close() {},
      }),
    },
  })
  t.after(() => app.close())
  assert.deepEqual((await app.inject('/api/history')).json(), {
    items: [],
    total: 0,
    page: 1,
    models: [],
  })
  const original = '👩‍💻'.repeat(121) + '\n<script>fictional</script>'
  const older = begin(db, original)
  db.corrections.finishAttempt(older.requestId, {
    status: 'succeeded',
    correctedText: original,
    endedAt: date,
    durationMs: 42,
    errorCode: null,
    errorMessage: null,
  })
  const nextId = randomUUID()
  db.db
    .prepare(
      `INSERT INTO model_requests(id,correction_id,requested_model,prompt_version,parameters_json,started_at,status)
    VALUES(?,?,?,'strict-v2','{}',?,'pending')`,
    )
    .run(nextId, older.correctionId, 'fictional/model-b', '2026-10-18T02:00:00.000Z')
  const newer = begin(db, 'newer', '2026-10-18T03:00:00.000Z')
  db.corrections.finishAttempt(newer.requestId, {
    status: 'failed',
    correctedText: null,
    endedAt: '2026-10-18T03:00:01.000Z',
    durationMs: 1000,
    errorCode: 'TIMEOUT',
    errorMessage: 'Correction timed out.',
  })
  const list = HistoryList.parse((await app.inject('/api/history')).json())
  assert.equal(list.items[0].id, newer.correctionId)
  assert.equal(list.items[1].preview, '👩‍💻'.repeat(120))
  assert.deepEqual(list.items[1].models, ['fictional/model-a', 'fictional/model-b'])
  assert.equal(JSON.stringify(list).includes('correctedText'), false)
  const detail = HistoryDetail.parse(
    (await app.inject('/api/history/' + older.correctionId)).json(),
  )
  assert.equal(detail.originalText, original)
  assert.deepEqual(
    detail.requests.map((request) => request.status),
    ['succeeded', 'pending'],
  )
  assert.equal(detail.requests[1].correctedText, null)
  assert.equal((await app.inject('/api/history/not-a-uuid')).statusCode, 400)
  assert.equal((await app.inject('/api/history/' + randomUUID())).statusCode, 404)
  assert.equal(calls, 0)
})

test('missing or failed repository returns safe History errors', async (t) => {
  for (const database of [null, new SqliteDatabase(':memory:')]) {
    const app = Fastify()
    await application(app, { correction: { environment: {}, database: database } })
    await app.ready()
    const id = database ? begin(database).correctionId : randomUUID()
    if (database) database.db.exec('DROP TABLE model_requests')
    const response = await app.inject('/api/history')
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), {
      error: {
        code: 'HISTORY_UNAVAILABLE',
        message: 'Could not load history. Please try again later.',
      },
    })
    const detail = await app.inject('/api/history/' + id)
    assert.equal(detail.statusCode, 503)
    assert.equal(detail.json().error.code, 'HISTORY_UNAVAILABLE')
    t.after(() => app.close())
  }
})
