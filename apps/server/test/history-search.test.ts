import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { HistorySearchQuery, HistoryList, HistoryDetail } from '@gramota/contracts'
import { SqliteDatabase } from '../src/database'
import { historyRoutes } from '../src/routes/history'

const at = '2026-10-18T01:00:00.000Z'
function record(
  db: SqliteDatabase,
  original: string,
  options: {
    model?: string
    status?: 'succeeded' | 'failed' | 'pending'
    result?: string
    createdAt?: string
    correctionId?: string
  } = {},
) {
  const correctionId = options.correctionId ?? randomUUID()
  const requestId = randomUUID()
  const status = options.status ?? 'succeeded'
  db.corrections.beginAttempt({
    ids: { correctionId, requestId },
    originalText: original,
    modelId: options.model ?? 'fictional/model-a',
    promptVersion: 'strict-v2',
    parameters: {},
    startedAt: options.createdAt ?? at,
    isRepeat: Boolean(options.correctionId),
  })
  if (status !== 'pending')
    db.corrections.finishAttempt(requestId, {
      status,
      correctedText: status === 'succeeded' ? (options.result ?? original) : null,
      endedAt: options.createdAt ?? at,
      durationMs: 1,
      errorCode: status === 'failed' ? 'TIMEOUT' : null,
      errorMessage: status === 'failed' ? 'Correction timed out.' : null,
    })
  return correctionId
}
function search(db: SqliteDatabase, criteria: object = {}) {
  return db.history.list(HistorySearchQuery.parse(criteria))
}

test('phrase search covers full originals and successful results with Russian case folding and literal wildcards', () => {
  const db = new SqliteDatabase(':memory:')
  try {
    const originalMatch = record(db, 'Начало '.repeat(30) + 'ПРИВЕТ МИР!')
    const resultMatch = record(db, 'Другая фраза', { result: 'Привет мир!' })
    record(db, 'Привет большой мир!')
    record(db, 'Совсем другой текст', { status: 'failed' })
    assert.deepEqual(
      new Set(search(db, { search: 'привет мир' }).items.map((item) => item.id)),
      new Set([originalMatch, resultMatch]),
    )
    assert.equal(search(db, { search: 'привет мир' }).total, 2)
    assert.equal(search(db, { search: '  ПрИвЕт МиР  ' }).total, 2)
    const literal = record(db, 'Скидка 50% на файл_1 \\ пример')
    record(db, 'Скидка 500 на файлX1')
    for (const phrase of ['50%', 'файл_1', '\\', "' OR 1=1 --"]) {
      const expected = phrase.startsWith("'") ? [] : [literal]
      assert.deepEqual(
        search(db, { search: phrase }).items.map((item) => item.id),
        expected,
      )
    }
    const failed = record(db, 'Поиск исходника неуспешной попытки', { status: 'failed' })
    assert.deepEqual(
      search(db, { search: 'НЕУСПЕШНОЙ' }).items.map((item) => item.id),
      [failed],
    )
  } finally {
    db.close()
  }
})

test('model and result filters must match one attempt, retain all details, and never duplicate corrections', () => {
  const db = new SqliteDatabase(':memory:')
  try {
    const original = 'Привет мир!'
    const id = record(db, original, { model: 'fictional/model-a' })
    record(db, original, { correctionId: id, model: 'fictional/model-b', result: 'Привет, мир!' })
    record(db, original, { correctionId: id, model: 'fictional/model-b', result: 'Привет, мир!' })
    record(db, original, { correctionId: id, model: 'fictional/model-a', status: 'failed' })
    record(db, original, { correctionId: id, model: 'fictional/model-c', status: 'pending' })
    const whitespace = record(db, 'Одинаково', { result: 'Одинаково ' })
    assert.equal(
      search(db, { search: 'Привет', model: 'fictional/model-a', result: 'corrected' }).total,
      0,
    )
    assert.deepEqual(
      search(db, { model: 'fictional/model-b', result: 'corrected' }).items.map((item) => item.id),
      [id],
    )
    assert.deepEqual(
      search(db, { result: 'unchanged' }).items.map((item) => item.id),
      [id],
    )
    assert.deepEqual(
      new Set(search(db, { result: 'corrected' }).items.map((item) => item.id)),
      new Set([id, whitespace]),
    )
    assert.equal(search(db, { model: 'fictional/model-a', result: 'failed' }).total, 1)
    assert.equal(search(db, { model: 'fictional/model-c', result: 'pending' }).total, 1)
    assert.equal(search(db, { model: 'missing' }).total, 0)
    const detail = HistoryDetail.parse(db.history.get(id))
    assert.equal(detail.requests.length, 5)
    assert.deepEqual(search(db, { model: 'missing' }).models, [
      'fictional/model-a',
      'fictional/model-b',
      'fictional/model-c',
    ])
    assert.equal(
      search(db, { search: 'Привет,', model: 'fictional/model-a', result: 'failed' }).total,
      1,
    )
  } finally {
    db.close()
  }
})

test('last-used boundaries include the local day and move repeated entries to their latest use', () => {
  const db = new SqliteDatabase(':memory:')
  try {
    record(db, 'Перед началом', { createdAt: '2026-10-17T16:59:59.999Z' })
    const first = record(db, 'Начало', { createdAt: '2026-10-17T17:00:00.000Z' })
    const last = record(db, 'Конец', { createdAt: '2026-10-18T16:59:59.999Z' })
    record(db, 'Следующий день', { createdAt: '2026-10-18T17:00:00.000Z' })
    record(db, 'Начало', {
      correctionId: first,
      createdAt: '2026-10-20T00:00:00.000Z',
      status: 'failed',
    })
    const result = search(db, {
      from: '2026-10-17T17:00:00.000Z',
      to: '2026-10-18T17:00:00.000Z',
      sort: 'oldest',
    })
    assert.deepEqual(
      result.items.map((item) => item.id),
      [last],
    )
    assert.equal(search(db, { from: '2026-10-18T17:00:00.000Z' }).total, 2)
    assert.equal(search(db, { to: '2026-10-17T17:00:00.000Z' }).total, 1)
  } finally {
    db.close()
  }
})

test('server pages have stable timestamp/ID ordering, matching totals, and full-history model choices', () => {
  const db = new SqliteDatabase(':memory:')
  try {
    const ids = Array.from({ length: 24 }, (_, index) =>
      record(db, `Пример ${index}`, { model: index === 0 ? 'fictional/rare' : 'fictional/common' }),
    ).sort()
    const newest = [...ids].reverse()
    for (const sort of ['oldest', 'newest']) {
      const pages = [1, 2, 3].map((page) => search(db, { sort, page }))
      assert.deepEqual(
        pages.map((page) => page.items.length),
        [10, 10, 4],
      )
      assert.deepEqual(
        pages.flatMap((page) => page.items.map((item) => item.id)),
        sort === 'oldest' ? ids : newest,
      )
      assert.ok(pages.every((page) => page.total === 24 && page.models.length === 2))
    }
    assert.equal(search(db, { page: Number.MAX_SAFE_INTEGER }).page, 3)
    const one = search(db, { model: 'fictional/rare', page: 3 })
    assert.equal(one.page, 1)
    assert.equal(one.total, 1)
    assert.equal(one.items.length, 1)
    const empty = search(db, { search: 'Нет совпадений', page: 8 })
    assert.equal(empty.page, 1)
    assert.equal(empty.total, 0)
    assert.deepEqual(empty.items, [])
  } finally {
    db.close()
  }
})

test('search API validates criteria, returns safe errors, and does not log search text', async (t) => {
  const logs: string[] = []
  const app = Fastify({
    logger: {
      level: 'info',
      stream: {
        write: (chunk: string) => {
          logs.push(chunk)
        },
      },
    },
  })
  const db = new SqliteDatabase(':memory:')
  await historyRoutes(app, db.history)
  t.after(async () => {
    await app.close()
    db.close()
  })
  record(db, 'Синтетическая секретная фраза')
  const response = await app.inject({
    method: 'POST',
    url: '/api/history/search',
    payload: { search: 'СЕКРЕТНАЯ ФРАЗА' },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(HistoryList.parse(response.json()).total, 1)
  for (const payload of [
    null,
    [],
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { page: '2' },
    { page: Number.MAX_SAFE_INTEGER + 1 },
    { search: ['text'] },
    { search: 'x'.repeat(5001) },
    { model: 'x'.repeat(501) },
    { sort: 'random' },
    { result: 'success' },
    { from: 'not-a-date' },
    { from: at, to: at },
    { from: '2026-10-19T00:00:00.000Z', to: at },
    { unexpected: true },
  ]) {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/history/search',
      payload: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    })
    assert.equal(invalid.statusCode, 400)
    assert.deepEqual(invalid.json(), {
      error: { code: 'INVALID_HISTORY_QUERY', message: 'The history search criteria are invalid.' },
    })
  }
  const malformed = await app.inject({
    method: 'POST',
    url: '/api/history/search',
    payload: '{"search": "СЕКРЕТНАЯ ФРАЗА"',
    headers: { 'content-type': 'application/json' },
  })
  assert.equal(malformed.statusCode, 400)
  assert.equal(malformed.json().error.code, 'INVALID_HISTORY_QUERY')
  assert.ok(!logs.join('').includes('СЕКРЕТНАЯ ФРАЗА'))
  assert.ok(!logs.join('').includes('Синтетическая'))
  db.db.exec('DROP TABLE model_requests')
  const unavailable = await app.inject({ method: 'POST', url: '/api/history/search', payload: {} })
  assert.equal(unavailable.statusCode, 503)
  assert.equal(unavailable.json().error.code, 'HISTORY_UNAVAILABLE')
})
