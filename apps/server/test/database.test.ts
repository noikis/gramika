import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CorrectionDatabase } from '../src/database'
import { DatabaseSync } from 'node:sqlite'

test('records exact originals, final outcomes and interrupted attempts across reopen', t => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-'))
  let reopened: CorrectionDatabase | undefined
  t.after(() => { reopened?.close(); rmSync(directory, { recursive: true, force: true }) })
  const path = join(directory, 'test.sqlite')
  const db = new CorrectionDatabase(path)
  const original = '  Привет 👋\n<script>text</script>\n'
  db.begin({ correctionId: 'c', requestId: 'r' }, original, 'model', 'v1', {}, '2026-10-17T00:00:00.000Z')
  db.finish('r', { status: 'succeeded', correctedText: original, endedAt: '2026-10-17T00:00:01.000Z',
    durationMs: 1000, errorCode: null, errorMessage: null })
  db.begin({ correctionId: 'c2', requestId: 'r2' }, original, 'model', 'v1', {}, '2026-10-17T00:00:00.000Z')
  assert.throws(() => db.begin({ correctionId: 'c3', requestId: 'r' }, 'text', 'model', 'v1', {}, 'now'))
  assert.equal(db.db.prepare("SELECT id FROM corrections WHERE id='c3'").get(), undefined)
  db.close()
  reopened = new CorrectionDatabase(path)
  assert.equal(reopened.db.prepare("SELECT original_text FROM corrections WHERE id='c'").get()?.original_text, original)
  assert.equal(reopened.db.prepare("SELECT corrected_text FROM model_requests WHERE id='r'").get()?.corrected_text, original)
  const interrupted = reopened.db.prepare("SELECT * FROM model_requests WHERE id='r2'").get()
  assert.equal(interrupted?.error_code, 'INTERRUPTED')
  assert.equal(interrupted?.duration_ms, null)
  assert.equal(interrupted?.cost_usd, null)
  assert.throws(() => reopened.finish('r', { status: 'failed', correctedText: null, endedAt: 'now',
    durationMs: 1, errorCode: 'ERROR', errorMessage: 'Error' }))
})

test('newer database version is rejected without replacing its contents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gramota-version-'))
  const path = join(directory, 'test.sqlite')
  const raw = new DatabaseSync(path)
  raw.exec('PRAGMA user_version=2; CREATE TABLE existing(value TEXT);')
  raw.close()
  try {
    assert.throws(() => new CorrectionDatabase(path), /Unsupported database version/)
    const check = new DatabaseSync(path)
    try { assert.equal(check.prepare('PRAGMA user_version').get()?.user_version, 2) }
    finally { check.close() }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
