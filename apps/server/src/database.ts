import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  HISTORY_PAGE_SIZE,
  HistoryDetail,
  HistoryList,
  HistorySearchQuery,
  MODEL_ID,
  type ModelId,
} from '@gramota/contracts'

export class InvalidCorrectionReference extends Error {}

export type Attempt = { correctionId: string; requestId: string }
export function storageDiagnostic(error: unknown, stage: 'initialize' | 'begin' | 'finish') {
  const allowed = [
    'ERR_SQLITE_ERROR',
    'ERR_INVALID_STATE',
    'ERR_INVALID_ARG_TYPE',
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'EACCES',
    'EPERM',
    'ENOENT',
    'ATTEMPT_NOT_PENDING',
  ]
  const code =
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    allowed.includes(error.code)
      ? error.code
      : 'UNKNOWN_STORAGE_ERROR'
  const sqliteCode =
    error instanceof Error &&
    'errcode' in error &&
    typeof error.errcode === 'number' &&
    Number.isSafeInteger(error.errcode) &&
    error.errcode >= 0
      ? error.errcode
      : undefined
  return { code: 'STORAGE_ERROR', stage, driverCode: code, sqliteCode }
}
export type Outcome = {
  status: 'succeeded' | 'failed'
  correctedText: string | null
  endedAt: string
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
  returnedModel?: string | null
  provider?: string | null
  openrouterGenerationId?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  reasoningTokens?: number | null
  cachedInputTokens?: number | null
  costUsd?: number | null
  finishReason?: string | null
  totalTokens?: number | null
  cacheWriteTokens?: number | null
  generationTimeMs?: number | null
  upstreamInferenceCostUsd?: number | null
  upstreamPromptCostUsd?: number | null
  upstreamCompletionCostUsd?: number | null
  routingStrategy?: string | null
  routingRegion?: string | null
  routingAttempt?: number | null
  isByok?: boolean | null
}

const requestColumns = {
  id: 'id',
  requestedModel: 'requested_model',
  returnedModel: 'returned_model',
  provider: 'provider',
  openrouterGenerationId: 'openrouter_generation_id',
  promptVersion: 'prompt_version',
  correctedText: 'corrected_text',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  appRequestTimeMs: 'duration_ms',
  inputTokens: 'input_tokens',
  outputTokens: 'output_tokens',
  totalTokens: 'total_tokens',
  reasoningTokens: 'reasoning_tokens',
  cachedInputTokens: 'cached_input_tokens',
  cacheWriteTokens: 'cache_write_tokens',
  costUsd: 'cost_usd',
  generationTimeMs: 'generation_time_ms',
  upstreamInferenceCostUsd: 'upstream_inference_cost_usd',
  upstreamPromptCostUsd: 'upstream_prompt_cost_usd',
  upstreamCompletionCostUsd: 'upstream_completion_cost_usd',
  routingStrategy: 'routing_strategy',
  routingRegion: 'routing_region',
  routingAttempt: 'routing_attempt',
  finishReason: 'finish_reason',
  status: 'status',
  errorCode: 'error_code',
  errorMessage: 'error_message',
} as const

export class CorrectionDatabase {
  readonly db: DatabaseSync

  constructor(path: string, now = new Date().toISOString()) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    try {
      this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
      this.db.function('history_contains', { deterministic: true }, (text, phrase) =>
        typeof text === 'string' &&
        typeof phrase === 'string' &&
        text.toLowerCase().includes(phrase.toLowerCase())
          ? 1
          : 0,
      )
      this.migrate()
      this.db
        .prepare(
          `UPDATE model_requests SET status='failed', ended_at=?,
        error_code='INTERRUPTED', error_message='The server stopped before recording an outcome.'
        WHERE status='pending'`,
        )
        .run(now)
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  private migrate() {
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version
    if (typeof version !== 'number' || version > 3) throw new Error('Unsupported database version')
    if (version === 0)
      this.transaction(() =>
        this.db.exec(`
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
    `),
      )
    if (version < 2)
      this.transaction(() =>
        this.db.exec(`
      ALTER TABLE model_requests RENAME COLUMN provider_request_id TO openrouter_generation_id;
      ALTER TABLE model_requests ADD COLUMN total_tokens INTEGER CHECK(total_tokens>=0);
      ALTER TABLE model_requests ADD COLUMN cache_write_tokens INTEGER CHECK(cache_write_tokens>=0);
      ALTER TABLE model_requests ADD COLUMN generation_time_ms REAL CHECK(generation_time_ms>=0);
      ALTER TABLE model_requests ADD COLUMN upstream_inference_cost_usd REAL CHECK(upstream_inference_cost_usd>=0);
      ALTER TABLE model_requests ADD COLUMN upstream_prompt_cost_usd REAL CHECK(upstream_prompt_cost_usd>=0);
      ALTER TABLE model_requests ADD COLUMN upstream_completion_cost_usd REAL CHECK(upstream_completion_cost_usd>=0);
      ALTER TABLE model_requests ADD COLUMN routing_strategy TEXT;
      ALTER TABLE model_requests ADD COLUMN routing_region TEXT;
      ALTER TABLE model_requests ADD COLUMN routing_attempt INTEGER CHECK(routing_attempt>=0);
      ALTER TABLE model_requests ADD COLUMN is_byok INTEGER CHECK(is_byok IN (0,1));
      PRAGMA user_version = 2;
    `),
      )
    if (version < 3)
      this.transaction(() => {
        this.db.exec(`CREATE TABLE model_preference (
        id INTEGER PRIMARY KEY CHECK(id=1), model_id TEXT NOT NULL
      ); PRAGMA user_version = 3;`)
        this.db.prepare('INSERT INTO model_preference VALUES(1, ?)').run(MODEL_ID)
      })
  }

  private transaction(action: () => void) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      action()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  getModelPreference() {
    const row = this.db.prepare('SELECT model_id FROM model_preference WHERE id=1').get()
    if (!row) throw new Error('Missing model preference')
    return String(row.model_id)
  }

  setModelPreference(modelId: ModelId) {
    const result = this.db.prepare('UPDATE model_preference SET model_id=? WHERE id=1').run(modelId)
    if (result.changes !== 1) throw new Error('Missing model preference')
  }

  begin(
    ids: Attempt,
    text: string,
    model: string,
    prompt: string,
    parameters: object,
    startedAt: string,
    repeat = false,
  ) {
    this.transaction(() => {
      if (repeat) {
        const row = this.db
          .prepare('SELECT original_text FROM corrections WHERE id=?')
          .get(ids.correctionId)
        if (!row || row.original_text !== text) throw new InvalidCorrectionReference()
      } else {
        this.db
          .prepare('INSERT INTO corrections VALUES (?, ?, ?, ?, ?)')
          .run(ids.correctionId, startedAt, text, 'ru', 'strict')
      }
      this.db
        .prepare(
          `INSERT INTO model_requests
        (id, correction_id, requested_model, prompt_version, parameters_json, started_at, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        )
        .run(ids.requestId, ids.correctionId, model, prompt, JSON.stringify(parameters), startedAt)
    })
  }

  finish(requestId: string, outcome: Outcome) {
    const result = this.db
      .prepare(
        `UPDATE model_requests SET status=?, corrected_text=?, ended_at=?,
      duration_ms=?, error_code=?, error_message=?, returned_model=?, provider=?, openrouter_generation_id=?,
      input_tokens=?, output_tokens=?, reasoning_tokens=?, cached_input_tokens=?, cost_usd=?, finish_reason=?,
      total_tokens=?, cache_write_tokens=?, generation_time_ms=?, upstream_inference_cost_usd=?,
      upstream_prompt_cost_usd=?, upstream_completion_cost_usd=?, routing_strategy=?, routing_region=?, routing_attempt=?, is_byok=?
      WHERE id=? AND status='pending'`,
      )
      .run(
        outcome.status,
        outcome.correctedText,
        outcome.endedAt,
        outcome.durationMs,
        outcome.errorCode,
        outcome.errorMessage,
        outcome.returnedModel ?? null,
        outcome.provider ?? null,
        outcome.openrouterGenerationId ?? null,
        outcome.inputTokens ?? null,
        outcome.outputTokens ?? null,
        outcome.reasoningTokens ?? null,
        outcome.cachedInputTokens ?? null,
        outcome.costUsd ?? null,
        outcome.finishReason ?? null,
        outcome.totalTokens ?? null,
        outcome.cacheWriteTokens ?? null,
        outcome.generationTimeMs ?? null,
        outcome.upstreamInferenceCostUsd ?? null,
        outcome.upstreamPromptCostUsd ?? null,
        outcome.upstreamCompletionCostUsd ?? null,
        outcome.routingStrategy ?? null,
        outcome.routingRegion ?? null,
        outcome.routingAttempt ?? null,
        outcome.isByok == null ? null : Number(outcome.isByok),
        requestId,
      )
    if (result.changes !== 1)
      throw Object.assign(new Error('Attempt is not pending'), {
        code: 'ATTEMPT_NOT_PENDING',
      })
  }

  listHistory(query: HistorySearchQuery = HistorySearchQuery.parse({})) {
    const segmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' })
    const where = `(:search = '' OR history_contains(c.original_text, :search) OR EXISTS (
      SELECT 1 FROM model_requests s WHERE s.correction_id = c.id AND s.status = 'succeeded'
      AND history_contains(s.corrected_text, :search)))
      AND ((:model = '' AND :result = 'all') OR EXISTS (
        SELECT 1 FROM model_requests r WHERE r.correction_id = c.id
        AND (:model = '' OR r.requested_model = :model)
        AND (:result = 'all'
          OR (:result = 'corrected' AND r.status = 'succeeded' AND r.corrected_text <> c.original_text)
          OR (:result = 'unchanged' AND r.status = 'succeeded' AND r.corrected_text = c.original_text)
          OR (:result = 'failed' AND r.status = 'failed')
          OR (:result = 'pending' AND r.status = 'pending'))))
      AND (:from IS NULL OR c.created_at >= :from)
      AND (:to IS NULL OR c.created_at < :to)`
    const parameters = {
      search: query.search,
      model: query.model,
      result: query.result,
      from: query.from,
      to: query.to,
    }
    const total = Number(
      this.db.prepare(`SELECT count(*) AS total FROM corrections c WHERE ${where}`).get(parameters)!
        .total,
    )
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)))
    const direction = query.sort === 'oldest' ? 'ASC' : 'DESC'
    const rows = this.db
      .prepare(
        `SELECT c.id, c.created_at, c.original_text FROM corrections c WHERE ${where}
        ORDER BY c.created_at ${direction}, c.id ${direction} LIMIT ${HISTORY_PAGE_SIZE} OFFSET :offset`,
      )
      .all({ ...parameters, offset: (page - 1) * HISTORY_PAGE_SIZE })
    const requestModels = this.db.prepare(
      'SELECT requested_model FROM model_requests WHERE correction_id = ? ORDER BY started_at, id',
    )
    return HistoryList.parse({
      total,
      page,
      models: this.db
        .prepare('SELECT DISTINCT requested_model FROM model_requests ORDER BY requested_model')
        .all()
        .map((row) => row.requested_model),
      items: rows.map((row) => {
        let preview = '',
          count = 0
        for (const part of segmenter.segment(String(row.original_text))) {
          if (count++ === 120) break
          preview += part.segment
        }
        return {
          id: row.id,
          createdAt: row.created_at,
          preview,
          models: [
            ...new Set(requestModels.all(row.id!).map((request) => request.requested_model)),
          ],
        }
      }),
    })
  }

  getHistory(id: string) {
    const correction = this.db.prepare('SELECT * FROM corrections WHERE id=?').get(id)
    if (!correction) return null
    const rows = this.db
      .prepare('SELECT * FROM model_requests WHERE correction_id=? ORDER BY started_at, id')
      .all(id)
    return HistoryDetail.parse({
      id: correction.id,
      createdAt: correction.created_at,
      originalText: correction.original_text,
      language: correction.language,
      mode: correction.mode,
      requests: rows.map((row) => ({
        ...Object.fromEntries(
          Object.entries(requestColumns).map(([field, column]) => [field, row[column] ?? null]),
        ),
        parameters: JSON.parse(String(row.parameters_json)),
        isByok: row.is_byok == null ? null : row.is_byok === 1,
      })),
    })
  }

  close() {
    this.db.close()
  }
}
