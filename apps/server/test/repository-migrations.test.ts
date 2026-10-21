import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DrizzleQueryError } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { DEFAULT_MODEL_ID, MODELS } from '@gramota/contracts'
import { SqliteDatabase, databaseDiagnostic } from '../src/database'

const DATE = '2026-10-19T00:00:00.000Z'
const EXISTING_SCHEMA = readFileSync(join(__dirname, 'fixtures/existing-schema.sql'), 'utf8')

// Test setup mirrors the one-time registration performed outside the application.
function registerBaseline(path: string) {
  const [baseline] = readMigrationFiles({ migrationsFolder: join(__dirname, '../drizzle') })
  const db = new DatabaseSync(path)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC
    )`)
    if (!db.prepare('SELECT 1 FROM __drizzle_migrations LIMIT 1').get()) {
      db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
        baseline.hash,
        baseline.folderMillis,
      )
    }
  } finally {
    db.close()
  }
}

test('opens an explicitly registered baseline, preserving history, preferences, metrics and constraints', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-drizzle-baseline-'))
  const path = join(directory, 'existing.sqlite')
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const correctionId = randomUUID()
  const requestId = randomUUID()
  const original = '  Синтетический текст 👋\n'
  const raw = new DatabaseSync(path)
  raw.exec(EXISTING_SCHEMA)
  raw.prepare('INSERT INTO model_preference VALUES (1, ?)').run(MODELS[1].id)
  raw
    .prepare('INSERT INTO corrections VALUES (?, ?, ?, ?, ?)')
    .run(correctionId, DATE, original, 'ru', 'strict')
  raw
    .prepare(
      `INSERT INTO model_requests
    (id, correction_id, requested_model, prompt_version, parameters_json, started_at, ended_at,
      status, corrected_text, duration_ms, total_tokens, cost_usd, is_byok)
    VALUES (?, ?, 'old/model', 'strict-v1', '{}', ?, ?, 'succeeded', ?, 0, 0, 0, 0)`,
    )
    .run(requestId, correctionId, DATE, DATE, original)
  raw.close()

  registerBaseline(path)
  registerBaseline(path)
  let database = new SqliteDatabase(path)
  try {
    const first = database.history.get(correctionId)!
    assert.equal(first.originalText, original)
    assert.equal(first.requests[0].id, requestId)
    assert.equal(first.requests[0].correctedText, original)
    assert.equal(first.requests[0].totalTokens, 0)
    assert.equal(first.requests[0].costUsd, 0)
    assert.equal(first.requests[0].isByok, false)
    assert.equal(first.requests[0].inputTokens, null)
    assert.equal(database.modelPreferences.get(), MODELS[1].id)
    const journal = database.db.prepare('SELECT hash, created_at FROM __drizzle_migrations').all()
    assert.equal(journal.length, 2)
    database.close()
    database = new SqliteDatabase(path)
    assert.deepEqual(database.history.get(correctionId), first)
    assert.deepEqual(
      database.db.prepare('SELECT hash, created_at FROM __drizzle_migrations').all(),
      journal,
    )
    assert.equal(database.modelPreferences.get(), MODELS[1].id)
    assert.equal(database.history.list().total, 1)
  } finally {
    database.close()
  }
})

test('fresh migration and explicit baseline registration enforce the same repository integrity rules', async (t) => {
  for (const isExisting of [false, true]) {
    await t.test(isExisting ? 'existing database' : 'fresh database', () => {
      const directory = mkdtempSync(join(tmpdir(), 'gramota-drizzle-constraints-'))
      const path = join(directory, 'test.sqlite')
      if (isExisting) {
        const raw = new DatabaseSync(path)
        raw.exec(EXISTING_SCHEMA)
        raw.prepare('INSERT INTO model_preference VALUES (1, ?)').run(DEFAULT_MODEL_ID)
        raw.close()
        registerBaseline(path)
      }
      const database = new SqliteDatabase(path)
      try {
        assert.equal(database.modelPreferences.get(), DEFAULT_MODEL_ID)
        const correctionId = randomUUID()
        const requestId = randomUUID()
        database.corrections.beginAttempt({
          ids: { correctionId, requestId },
          originalText: 'Fictional text',
          modelId: 'old/model',
          promptVersion: 'v1',
          parameters: { reasoning: { enabled: false } },
          startedAt: DATE,
        })
        for (const invalidUpdate of [
          "parameters_json = 'invalid JSON'",
          "status = 'unknown'",
          "status = 'succeeded'",
          "status = 'failed'",
          'duration_ms = -1',
          'input_tokens = -1',
          'output_tokens = -1',
          'total_tokens = -1',
          'reasoning_tokens = -1',
          'cached_input_tokens = -1',
          'cache_write_tokens = -1',
          'cost_usd = -1',
          'generation_time_ms = -1',
          'upstream_inference_cost_usd = -1',
          'upstream_prompt_cost_usd = -1',
          'upstream_completion_cost_usd = -1',
          'routing_attempt = -1',
          'is_byok = 2',
          "correction_id = 'missing'",
        ]) {
          assert.throws(() =>
            database.db
              .prepare(`UPDATE model_requests SET ${invalidUpdate} WHERE id = ?`)
              .run(requestId),
          )
        }
        assert.throws(() => database.db.exec("UPDATE corrections SET language = 'en'"))
        assert.throws(() => database.db.exec("UPDATE model_requests SET mode = 'minimal'"))
        assert.throws(() => database.db.exec("INSERT INTO model_preference VALUES (2, 'other')"))
        assert.deepEqual(database.history.get(correctionId)?.requests[0].parameters, {
          reasoning: { enabled: false },
        })
        database.corrections.finishAttempt(requestId, {
          status: 'succeeded',
          correctedText: 'Fictional text',
          endedAt: DATE,
          durationMs: 0,
          errorCode: null,
          errorMessage: null,
          isByok: true,
        })
        assert.equal(database.history.get(correctionId)?.requests[0].isByok, true)
      } finally {
        database.close()
        rmSync(directory, { recursive: true, force: true })
      }
    })
  }
})

test('failed Drizzle migration rolls back tables, seed and version and can resume on reopen', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-drizzle-rollback-'))
  const path = join(directory, 'test.sqlite')
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const raw = new DatabaseSync(path)
  raw.exec(`CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC);
    CREATE TABLE existing (value TEXT);
    INSERT INTO existing VALUES ('fictional preserved value');
    CREATE TRIGGER deny_migration BEFORE INSERT ON __drizzle_migrations
    BEGIN SELECT RAISE(ABORT, 'fictional migration failure'); END;`)
  raw.close()
  assert.throws(() => new SqliteDatabase(path))
  const check = new DatabaseSync(path)
  try {
    assert.equal(check.prepare('PRAGMA user_version').get()?.user_version, 0)
    assert.equal(
      check.prepare("SELECT name FROM sqlite_master WHERE name='corrections'").get(),
      undefined,
    )
    assert.equal(
      check.prepare('SELECT count(*) AS total FROM __drizzle_migrations').get()?.total,
      0,
    )
    assert.equal(
      check.prepare('SELECT value FROM existing').get()?.value,
      'fictional preserved value',
    )
    check.exec('DROP TRIGGER deny_migration')
  } finally {
    check.close()
  }
  const resumed = new SqliteDatabase(path)
  try {
    assert.equal(resumed.modelPreferences.get(), DEFAULT_MODEL_ID)
    assert.equal(resumed.history.list().total, 0)
    assert.equal(resumed.db.prepare('SELECT * FROM __drizzle_migrations').all().length, 2)
  } finally {
    resumed.close()
  }
})

test('Drizzle diagnostics retain only allowed driver codes and never query parameters', () => {
  const cause = Object.assign(new Error('private database path'), {
    code: 'SQLITE_CONSTRAINT_CHECK',
  })
  const error = new DrizzleQueryError('INSERT private query', ['private original text'], cause)
  assert.deepEqual(databaseDiagnostic(error, 'begin'), {
    code: 'STORAGE_ERROR',
    stage: 'begin',
    driverCode: 'SQLITE_CONSTRAINT_CHECK',
  })
  assert.equal(JSON.stringify(databaseDiagnostic(error, 'begin')).includes('private'), false)
})
