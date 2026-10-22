import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { migrateDatabase } from '../src/database/migrations'
import { DEFAULT_MODEL_ID, HistorySearchQuery } from '@gramota/contracts'
import { SqliteDatabase } from '../src/database'
import { historyRoutes } from '../src/routes/history'
import { AttemptError, createCorrectionService } from '../src/correction'
import { mockOpenRouterTransport } from './mock-transport'

const at = '2026-10-21T00:00:00.000Z'
function begin(db: SqliteDatabase, correctionId = randomUUID(), isRepeat = false) {
  const requestId = randomUUID()
  db.corrections.beginAttempt({
    ids: { correctionId, requestId },
    originalText: 'Synthetic original',
    modelId: 'fictional/deleted-model',
    mode: isRepeat ? 'gentle-rewrite' : 'strict',
    promptVersion: isRepeat ? 'rewrite-v1' : 'strict-v3',
    parameters: {},
    startedAt: at,
    isRepeat,
  })
  return { correctionId, requestId }
}
function finish(db: SqliteDatabase, requestId: string) {
  db.corrections.finishAttempt(requestId, {
    status: 'succeeded',
    correctedText: 'Synthetic result',
    endedAt: at,
    durationMs: 1,
    errorCode: null,
    errorMessage: null,
    costUsd: 0.00001,
  })
}

test('DELETE hides the whole mixed-mode group and preserves originals, requests and metrics', async (t) => {
  const db = new SqliteDatabase(':memory:')
  const app = Fastify()
  await historyRoutes(app, db.history)
  t.after(async () => {
    await app.close()
    db.close()
  })
  const first = begin(db)
  finish(db, first.requestId)
  const pending = begin(db, first.correctionId, true)
  const requests = db.db.prepare('SELECT * FROM model_requests ORDER BY id').all()
  const group = db.db.prepare('SELECT * FROM corrections').get() as Record<string, unknown>
  const response = await app.inject({ method: 'DELETE', url: '/api/history/' + first.correctionId })
  assert.equal(response.statusCode, 204)
  assert.equal(response.body, '')
  assert.deepEqual(db.db.prepare('SELECT * FROM model_requests ORDER BY id').all(), requests)
  const retained = db.db.prepare('SELECT * FROM corrections').get() as Record<string, unknown>
  assert.equal(typeof retained.deleted_at, 'string')
  assert.deepEqual({ ...retained, deleted_at: null }, group)
  assert.equal((await app.inject('/api/history/' + first.correctionId)).statusCode, 404)
  assert.equal((await app.inject('/api/history')).json().total, 0)
  for (const criteria of [
    {},
    { search: 'original' },
    { search: 'result' },
    { model: 'fictional/deleted-model' },
    { result: 'corrected' },
    { result: 'pending' },
    { from: at, to: '2026-10-22T00:00:00.000Z' },
  ]) {
    const list = db.history.list(HistorySearchQuery.parse(criteria))
    assert.equal(list.total, 0)
    assert.deepEqual(list.items, [])
    assert.deepEqual(list.models, [])
  }
  assert.equal(
    (await app.inject({ method: 'DELETE', url: '/api/history/' + first.correctionId })).statusCode,
    404,
  )
  finish(db, pending.requestId)
  assert.equal(db.history.get(first.correctionId), null)
  assert.equal(db.history.list().total, 0)
  assert.equal(
    db.db
      .prepare<unknown[], { total: number }>('SELECT count(*) AS total FROM model_requests')
      .get()!.total,
    2,
  )
})

test('deletion clamps an emptied last page and retains visible model filters', () => {
  const db = new SqliteDatabase(':memory:')
  try {
    for (let i = 0; i < 11; i++) begin(db)
    const query = HistorySearchQuery.parse({ page: 2, sort: 'oldest' })
    const last = db.history.list(query)
    assert.equal(last.items.length, 1)
    db.history.softDelete(last.items[0].id)
    const refreshed = db.history.list(query)
    assert.equal(refreshed.total, 10)
    assert.equal(refreshed.page, 1)
    assert.equal(refreshed.items.length, 10)
    assert.deepEqual(refreshed.models, ['fictional/deleted-model'])
  } finally {
    db.close()
  }
})

test('deleted references are rejected before transport; new correction groups still work', async () => {
  const db = new SqliteDatabase(':memory:')
  try {
    const { correctionId } = begin(db)
    db.history.softDelete(correctionId)
    let calls = 0
    const service = createCorrectionService({
      repository: db.corrections,
      isAvailable: true,
      transport: mockOpenRouterTransport({
        async send() {
          calls++
          throw Error('fictional failure')
        },
        async close() {},
      }),
    })
    await assert.rejects(
      service('Synthetic original', DEFAULT_MODEL_ID, correctionId),
      (error: unknown) => error instanceof AttemptError && error.code === 'INVALID_INPUT',
    )
    assert.equal(calls, 0)
    assert.equal(
      db.db
        .prepare<unknown[], { total: number }>('SELECT count(*) AS total FROM model_requests')
        .get()!.total,
      1,
    )
    const fresh = begin(db)
    assert.notEqual(fresh.correctionId, correctionId)
    assert.equal(db.history.list().total, 1)
  } finally {
    db.close()
  }
})

test('DELETE validates IDs and returns safe missing/unavailable/storage-failure responses', async (t) => {
  for (const isMissing of [false, true]) {
    const db = new SqliteDatabase(':memory:')
    const app = Fastify()
    await historyRoutes(app, isMissing ? null : db.history)
    t.after(async () => {
      await app.close()
      db.close()
    })
    const invalid = await app.inject({ method: 'DELETE', url: '/api/history/invalid' })
    assert.equal(invalid.statusCode, 400)
    assert.equal(invalid.json().error.code, 'INVALID_HISTORY_ID')
    const missing = await app.inject({ method: 'DELETE', url: '/api/history/' + randomUUID() })
    assert.equal(missing.statusCode, isMissing ? 503 : 404)
    if (!isMissing) {
      const { correctionId } = begin(db)
      db.db.exec('DROP TABLE model_requests; DROP TABLE corrections')
      const failed = await app.inject({ method: 'DELETE', url: '/api/history/' + correctionId })
      assert.equal(failed.statusCode, 503)
      assert.equal(failed.json().error.code, 'HISTORY_UNAVAILABLE')
      assert.equal(failed.body.includes('SQLITE'), false)
    }
  }
})

test('deletion persists across reopening without removing stored outcomes', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-delete-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'test.sqlite')
  const db = new SqliteDatabase(path)
  const { correctionId, requestId } = begin(db)
  finish(db, requestId)
  db.history.softDelete(correctionId)
  const requests = db.db.prepare('SELECT * FROM model_requests').all()
  db.close()
  const reopened = new SqliteDatabase(path)
  try {
    assert.equal(reopened.history.get(correctionId), null)
    assert.equal(reopened.history.list().total, 0)
    assert.deepEqual(reopened.db.prepare('SELECT * FROM model_requests').all(), requests)
    assert.equal(
      reopened.db
        .prepare<unknown[], { total: number }>('SELECT count(*) AS total FROM corrections')
        .get()!.total,
      1,
    )
  } finally {
    reopened.close()
  }
})

test('soft-delete migration preserves populated V2.2 records and defaults to visible', () => {
  const raw = new Database(':memory:')
  try {
    raw.pragma('foreign_keys = ON')
    raw.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)',
    )
    const migrations = readMigrationFiles({ migrationsFolder: join(__dirname, '../drizzle') })
    for (const migration of migrations.slice(0, 2)) {
      raw.transaction(() => {
        for (const statement of migration.sql) raw.exec(statement)
        raw
          .prepare('INSERT INTO __drizzle_migrations(hash, created_at) VALUES (?, ?)')
          .run(migration.hash, migration.folderMillis)
      })()
    }
    raw
      .prepare(
        'INSERT INTO corrections(id, created_at, original_text, language) VALUES (?, ?, ?, ?)',
      )
      .run(randomUUID(), at, 'Synthetic saved original', 'ru')
    const original = raw.prepare('SELECT * FROM corrections').get() as Record<string, unknown>
    raw
      .prepare(
        `INSERT INTO model_requests(id, correction_id, requested_model, mode, prompt_version, parameters_json, started_at, status)
      VALUES (?, ?, 'fictional/model', 'gentle-rewrite', 'rewrite-v1', '{}', ?, 'pending')`,
      )
      .run(randomUUID(), original.id, at)
    const requests = raw.prepare('SELECT * FROM model_requests').all()
    migrateDatabase(drizzle(raw))
    assert.deepEqual(raw.prepare('SELECT * FROM corrections').get(), {
      ...original,
      last_used_at: at,
      deleted_at: null,
    })
    assert.deepEqual(raw.prepare('SELECT * FROM model_requests').all(), requests)
    assert.deepEqual(raw.pragma('foreign_key_check'), [])
    migrateDatabase(drizzle(raw))
    assert.equal(raw.prepare('SELECT * FROM __drizzle_migrations').all().length, migrations.length)
  } finally {
    raw.close()
  }
})
