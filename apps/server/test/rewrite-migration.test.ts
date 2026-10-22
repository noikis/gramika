import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { migrateDatabase } from '../src/database/migrations'

const migrationsFolder = join(__dirname, '../drizzle')
const baselineSql = readFileSync(join(migrationsFolder, '0000_storage-baseline.sql'), 'utf8')
const [baseline] = readMigrationFiles({ migrationsFolder })

function oldDatabase() {
  const raw = new Database(':memory:')
  raw.pragma('foreign_keys = ON')
  raw.exec(baselineSql)
  raw.exec(
    'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)',
  )
  raw
    .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run(baseline.hash, baseline.folderMillis)
  raw
    .prepare('INSERT INTO corrections VALUES (?, ?, ?, ?, ?)')
    .run('original-id', '2026-10-20T00:00:00.000Z', '  Синтетический текст 👋\n', 'ru', 'strict')
  for (const status of ['succeeded', 'pending', 'failed']) {
    raw
      .prepare(
        `INSERT INTO model_requests
      (id, correction_id, requested_model, prompt_version, parameters_json, started_at, ended_at,
      duration_ms, status, corrected_text, error_code, error_message, returned_model, provider,
      openrouter_generation_id, input_tokens, output_tokens, total_tokens, reasoning_tokens,
      cached_input_tokens, cache_write_tokens, cost_usd, generation_time_ms,
      upstream_inference_cost_usd, upstream_prompt_cost_usd, upstream_completion_cost_usd,
      routing_strategy, routing_region, routing_attempt, is_byok, finish_reason)
      VALUES (@id, 'original-id', 'old/model', 'strict-v2', '{"reasoning":{"enabled":false}}',
      '2026-10-20T00:00:00.000Z', @ended, @duration, @status, @text, @code, @error,
      'returned/model', 'fictional provider', 'generation-id', 42, 8, 50, 0, 3, 1,
      0.00001, 123.75, 0.000008, 0.000005, 0.000003, 'direct', 'example', 1, 0, 'stop')`,
      )
      .run({
        id: status,
        status,
        ended: status === 'pending' ? null : '2026-10-20T00:00:01.000Z',
        duration: status === 'pending' ? null : 1000,
        text: status === 'succeeded' ? 'Синтетический результат.' : null,
        code: status === 'failed' ? 'TIMEOUT' : null,
        error: status === 'failed' ? 'Correction timed out.' : null,
      })
  }
  return raw
}

test('mode migration preserves every old request field, status and relation transactionally', () => {
  const raw = oldDatabase()
  try {
    const requests = raw.prepare('SELECT * FROM model_requests ORDER BY id').all()
    const group = raw
      .prepare<unknown[], Record<string, unknown>>(
        'SELECT id, created_at, original_text, language FROM corrections',
      )
      .get()
    const preference = raw.prepare('SELECT * FROM model_preference').get()
    migrateDatabase(drizzle(raw))
    const migrated = raw
      .prepare<unknown[], { mode: string }>('SELECT * FROM model_requests ORDER BY id')
      .all()
    assert.deepEqual(
      migrated.map(({ mode, ...fields }) => {
        assert.equal(mode, 'strict')
        return fields
      }),
      requests,
    )
    assert.deepEqual(raw.prepare('SELECT * FROM corrections').get(), {
      ...group,
      deleted_at: null,
      last_used_at: group!.created_at,
    })
    assert.deepEqual(raw.prepare('SELECT * FROM model_preference').get(), preference)
    assert.deepEqual(raw.pragma('foreign_key_check'), [])
    assert.equal(raw.pragma('foreign_keys', { simple: true }), 1)
    assert.equal(
      raw.prepare('SELECT * FROM __drizzle_migrations').all().length,
      readMigrationFiles({ migrationsFolder }).length,
    )
    raw.exec("UPDATE model_requests SET mode = 'gentle-rewrite' WHERE id = 'pending'")
    assert.throws(() => raw.exec("UPDATE model_requests SET mode = 'unknown'"))
    migrateDatabase(drizzle(raw))
    assert.equal(
      raw.prepare('SELECT * FROM __drizzle_migrations').all().length,
      readMigrationFiles({ migrationsFolder }).length,
    )
  } finally {
    raw.close()
  }
})

test('mode migration failure rolls back populated tables and journal, then resumes', () => {
  const raw = oldDatabase()
  try {
    const requests = raw.prepare('SELECT * FROM model_requests ORDER BY id').all()
    const corrections = raw.prepare('SELECT * FROM corrections').all()
    raw.exec(`CREATE TRIGGER deny_mode_migration BEFORE INSERT ON __drizzle_migrations
      BEGIN SELECT RAISE(ABORT, 'fictional migration failure'); END`)
    assert.throws(() => migrateDatabase(drizzle(raw)))
    assert.deepEqual(raw.prepare('SELECT * FROM model_requests ORDER BY id').all(), requests)
    assert.deepEqual(raw.prepare('SELECT * FROM corrections').all(), corrections)
    assert.equal(raw.prepare('SELECT * FROM __drizzle_migrations').all().length, 1)
    assert.deepEqual(
      raw.prepare("SELECT name FROM sqlite_master WHERE name LIKE '__new_%'").all(),
      [],
    )
    assert.deepEqual(raw.pragma('foreign_key_check'), [])
    raw.exec('DROP TRIGGER deny_mode_migration')
    migrateDatabase(drizzle(raw))
    assert.equal(
      raw.prepare('SELECT * FROM __drizzle_migrations').all().length,
      readMigrationFiles({ migrationsFolder }).length,
    )
  } finally {
    raw.close()
  }
})
