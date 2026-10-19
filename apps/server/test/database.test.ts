import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteDatabase } from '../src/database'
import { DatabaseSync } from 'node:sqlite'

test('records exact originals, final outcomes and interrupted attempts across reopen', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-'))
  const path = join(directory, 'test.sqlite')
  const db = new SqliteDatabase(path)
  const original = '  Привет 👋\n<script>text</script>\n'
  db.corrections.beginAttempt({
    ids: { correctionId: 'c', requestId: 'r' },
    originalText: original,
    modelId: 'model',
    promptVersion: 'v1',
    parameters: {},
    startedAt: '2026-10-17T00:00:00.000Z',
  })
  db.corrections.finishAttempt('r', {
    status: 'succeeded',
    correctedText: original,
    endedAt: '2026-10-17T00:00:01.000Z',
    durationMs: 1000,
    errorCode: null,
    errorMessage: null,
  })
  db.corrections.beginAttempt({
    ids: { correctionId: 'c2', requestId: 'r2' },
    originalText: original,
    modelId: 'model',
    promptVersion: 'v1',
    parameters: {},
    startedAt: '2026-10-17T00:00:00.000Z',
  })
  assert.throws(() =>
    db.corrections.beginAttempt({
      ids: { correctionId: 'c3', requestId: 'r' },
      originalText: 'text',
      modelId: 'model',
      promptVersion: 'v1',
      parameters: {},
      startedAt: 'now',
    }),
  )
  assert.equal(
    db.db
      .prepare<unknown[], Record<string, unknown>>("SELECT id FROM corrections WHERE id='c3'")
      .get(),
    undefined,
  )
  db.close()
  const reopened = new SqliteDatabase(path)
  t.after(() => {
    reopened.close()
    rmSync(directory, { recursive: true, force: true })
  })
  assert.equal(
    reopened.db
      .prepare<unknown[], Record<string, unknown>>(
        "SELECT original_text FROM corrections WHERE id='c'",
      )
      .get()?.original_text,
    original,
  )
  assert.equal(
    reopened.db
      .prepare<unknown[], Record<string, unknown>>(
        "SELECT corrected_text FROM model_requests WHERE id='r'",
      )
      .get()?.corrected_text,
    original,
  )
  const interrupted = reopened.db
    .prepare<unknown[], Record<string, unknown>>("SELECT * FROM model_requests WHERE id='r2'")
    .get()
  assert.equal(interrupted?.error_code, 'INTERRUPTED')
  assert.equal(interrupted?.duration_ms, null)
  assert.equal(interrupted?.cost_usd, null)
  assert.throws(() =>
    reopened.corrections.finishAttempt('r', {
      status: 'failed',
      correctedText: null,
      endedAt: 'now',
      durationMs: 1,
      errorCode: 'ERROR',
      errorMessage: 'Error',
    }),
  )
})

test('existing application tables require explicit baseline registration', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-version-'))
  const path = join(directory, 'test.sqlite')
  const raw = new DatabaseSync(path)
  raw.exec(`PRAGMA user_version=3; CREATE TABLE corrections(value TEXT);
    INSERT INTO corrections VALUES ('fictional saved value');`)
  raw.close()
  try {
    assert.throws(() => new SqliteDatabase(path))
    const check = new DatabaseSync(path)
    try {
      assert.equal(check.prepare('PRAGMA user_version').get()?.user_version, 3)
      assert.equal(
        check.prepare('SELECT value FROM corrections').get()?.value,
        'fictional saved value',
      )
      assert.equal(
        check.prepare('SELECT count(*) AS total FROM __drizzle_migrations').get()?.total,
        0,
      )
    } finally {
      check.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a schema collision rolls back migration changes and preserves existing records', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-migration-'))
  const path = join(directory, 'test.sqlite')
  t.after(() => rmSync(directory, { recursive: true, force: true }))

  const raw = new DatabaseSync(path)
  raw.exec(`
    CREATE TABLE model_requests (
      id TEXT PRIMARY KEY,
      provider_request_id TEXT,
      total_tokens INTEGER
    );
    INSERT INTO model_requests VALUES ('existing', 'generation-test', 0);
    PRAGMA user_version=1;
  `)
  raw.close()

  assert.throws(() => new SqliteDatabase(path))

  const reopened = new DatabaseSync(path)
  try {
    assert.equal(reopened.prepare('PRAGMA user_version').get()?.user_version, 1)
    assert.deepEqual(
      reopened
        .prepare('PRAGMA table_info(model_requests)')
        .all()
        .map((row) => row.name),
      ['id', 'provider_request_id', 'total_tokens'],
    )
    assert.deepEqual(
      { ...reopened.prepare('SELECT * FROM model_requests').get() },
      { id: 'existing', provider_request_id: 'generation-test', total_tokens: 0 },
    )
  } finally {
    reopened.close()
  }
})
