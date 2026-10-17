import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type Attempt = { correctionId: string; requestId: string }
export function storageDiagnostic(error: unknown, stage: 'initialize' | 'begin' | 'finish') {
  const allowed = ['ERR_SQLITE_ERROR', 'ERR_INVALID_STATE', 'ERR_INVALID_ARG_TYPE',
    'SQLITE_BUSY', 'SQLITE_LOCKED', 'EACCES', 'EPERM', 'ENOENT', 'ATTEMPT_NOT_PENDING']
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
    && allowed.includes(error.code) ? error.code : 'UNKNOWN_STORAGE_ERROR'
  const sqliteCode = error instanceof Error && 'errcode' in error && typeof error.errcode === 'number'
    && Number.isSafeInteger(error.errcode) && error.errcode >= 0 ? error.errcode : undefined
  return { code: 'STORAGE_ERROR', stage, driverCode: code, sqliteCode }
}
export type Outcome = {
  status: 'succeeded' | 'failed'; correctedText: string | null; endedAt: string; durationMs: number
  errorCode: string | null; errorMessage: string | null
  returnedModel?: string | null; provider?: string | null; providerRequestId?: string | null
  inputTokens?: number | null; outputTokens?: number | null; reasoningTokens?: number | null
  cachedInputTokens?: number | null; costUsd?: number | null; finishReason?: string | null
}

export class CorrectionDatabase {
  readonly db: DatabaseSync

  constructor(path: string, now = new Date().toISOString()) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
      this.migrate()
      this.db.prepare(`UPDATE model_requests SET status='failed', ended_at=?,
        error_code='INTERRUPTED', error_message='The server stopped before recording an outcome.'
        WHERE status='pending'`).run(now)
    } catch (error) { this.db.close(); throw error }
  }

  private migrate() {
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version
    if (typeof version !== 'number' || version > 1) throw new Error('Unsupported database version')
    if (version === 1) return
    this.transaction(() => this.db.exec(`
      CREATE TABLE corrections (
        id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, original_text TEXT NOT NULL,
        language TEXT NOT NULL CHECK(language='ru'), mode TEXT NOT NULL CHECK(mode='strict')
      );
      CREATE TABLE model_requests (
        id TEXT PRIMARY KEY NOT NULL, correction_id TEXT NOT NULL REFERENCES corrections(id),
        requested_model TEXT NOT NULL, returned_model TEXT, provider TEXT, provider_request_id TEXT,
        prompt_version TEXT NOT NULL, parameters_json TEXT NOT NULL CHECK(json_valid(parameters_json)),
        corrected_text TEXT, started_at TEXT NOT NULL, ended_at TEXT,
        duration_ms INTEGER CHECK(duration_ms>=0),
        input_tokens INTEGER CHECK(input_tokens>=0), output_tokens INTEGER CHECK(output_tokens>=0),
        reasoning_tokens INTEGER CHECK(reasoning_tokens>=0), cached_input_tokens INTEGER CHECK(cached_input_tokens>=0),
        cost_usd REAL CHECK(cost_usd>=0), finish_reason TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed')),
        error_code TEXT, error_message TEXT,
        CHECK((status='pending' AND corrected_text IS NULL AND ended_at IS NULL AND duration_ms IS NULL AND error_code IS NULL AND error_message IS NULL)
          OR (status='succeeded' AND length(corrected_text)>0 AND corrected_text IS NOT NULL AND ended_at IS NOT NULL AND duration_ms IS NOT NULL AND error_code IS NULL AND error_message IS NULL)
          OR (status='failed' AND corrected_text IS NULL AND ended_at IS NOT NULL AND error_code IS NOT NULL AND error_message IS NOT NULL))
      );
      PRAGMA user_version = 1;
    `))
  }

  private transaction(action: () => void) {
    this.db.exec('BEGIN IMMEDIATE')
    try { action(); this.db.exec('COMMIT') }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }

  begin(ids: Attempt, text: string, model: string, prompt: string, parameters: object, startedAt: string) {
    this.transaction(() => {
      this.db.prepare('INSERT INTO corrections VALUES (?, ?, ?, ?, ?)')
        .run(ids.correctionId, startedAt, text, 'ru', 'strict')
      this.db.prepare(`INSERT INTO model_requests
        (id, correction_id, requested_model, prompt_version, parameters_json, started_at, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`)
        .run(ids.requestId, ids.correctionId, model, prompt, JSON.stringify(parameters), startedAt)
    })
  }

  finish(requestId: string, outcome: Outcome) {
    const result = this.db.prepare(`UPDATE model_requests SET status=?, corrected_text=?, ended_at=?,
      duration_ms=?, error_code=?, error_message=?, returned_model=?, provider=?, provider_request_id=?,
      input_tokens=?, output_tokens=?, reasoning_tokens=?, cached_input_tokens=?, cost_usd=?, finish_reason=?
      WHERE id=? AND status='pending'`).run(
      outcome.status, outcome.correctedText, outcome.endedAt, outcome.durationMs,
      outcome.errorCode, outcome.errorMessage, outcome.returnedModel ?? null, outcome.provider ?? null,
      outcome.providerRequestId ?? null, outcome.inputTokens ?? null, outcome.outputTokens ?? null,
      outcome.reasoningTokens ?? null, outcome.cachedInputTokens ?? null, outcome.costUsd ?? null,
      outcome.finishReason ?? null, requestId)
    if (result.changes !== 1) throw Object.assign(new Error('Attempt is not pending'), { code: 'ATTEMPT_NOT_PENDING' })
  }

  close() { this.db.close() }
}
