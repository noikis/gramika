import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'
import {
  HISTORY_PAGE_SIZE,
  HistoryDetail,
  HistoryList,
  HistorySearchQuery,
} from '@gramota/contracts'

const MAX_PREVIEW_GRAPHEMES = 120

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

const HISTORY_FILTER = `(:search = '' OR history_contains(c.original_text, :search) OR EXISTS (
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

function createHistoryPreview(text: string) {
  const segmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' })
  let preview = ''
  let count = 0

  for (const part of segmenter.segment(text)) {
    if (count++ === MAX_PREVIEW_GRAPHEMES) break
    preview += part.segment
  }

  return preview
}

function mapHistoryRequest(row: Record<string, SQLOutputValue>) {
  return {
    ...Object.fromEntries(
      Object.entries(requestColumns).map(([field, column]) => [field, row[column] ?? null]),
    ),
    parameters: JSON.parse(String(row.parameters_json)),
    isByok: row.is_byok == null ? null : row.is_byok === 1,
  }
}

export function registerHistorySearch(db: DatabaseSync) {
  db.function('history_contains', { deterministic: true }, (text, phrase) =>
    typeof text === 'string' &&
    typeof phrase === 'string' &&
    text.toLowerCase().includes(phrase.toLowerCase())
      ? 1
      : 0,
  )
}

function selectHistoryPage(db: DatabaseSync, query: HistorySearchQuery) {
  const parameters = {
    search: query.search,
    model: query.model,
    result: query.result,
    from: query.from,
    to: query.to,
  }

  const total = Number(
    db
      .prepare(`SELECT count(*) AS total FROM corrections c WHERE ${HISTORY_FILTER}`)
      .get(parameters)!.total,
  )

  const page = Math.min(query.page, Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)))
  const direction = query.sort === 'oldest' ? 'ASC' : 'DESC'

  const rows = db
    .prepare(
      `SELECT c.id, c.created_at, c.original_text FROM corrections c WHERE ${HISTORY_FILTER}
        ORDER BY c.created_at ${direction}, c.id ${direction} LIMIT ${HISTORY_PAGE_SIZE} OFFSET :offset`,
    )
    .all({ ...parameters, offset: (page - 1) * HISTORY_PAGE_SIZE })

  return { total, page, rows }
}

export function createHistoryStore(db: DatabaseSync) {
  return {
    list(query: HistorySearchQuery = HistorySearchQuery.parse({})) {
      const { total, page, rows } = selectHistoryPage(db, query)

      const requestModels = db.prepare(
        'SELECT requested_model FROM model_requests WHERE correction_id = :correctionId ORDER BY started_at, id',
      )

      return HistoryList.parse({
        total,
        page,
        models: db
          .prepare('SELECT DISTINCT requested_model FROM model_requests ORDER BY requested_model')
          .all()
          .map((row) => row.requested_model),
        items: rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          preview: createHistoryPreview(String(row.original_text)),
          models: [
            ...new Set(
              requestModels
                .all({ correctionId: row.id! })
                .map((request) => request.requested_model),
            ),
          ],
        })),
      })
    },

    get(id: string) {
      const correction = db.prepare('SELECT * FROM corrections WHERE id=:id').get({ id })
      if (!correction) return null

      const rows = db
        .prepare('SELECT * FROM model_requests WHERE correction_id=:id ORDER BY started_at, id')
        .all({ id })

      return HistoryDetail.parse({
        id: correction.id,
        createdAt: correction.created_at,
        originalText: correction.original_text,
        language: correction.language,
        mode: correction.mode,
        requests: rows.map(mapHistoryRequest),
      })
    },
  }
}
