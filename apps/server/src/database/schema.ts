import { sql } from 'drizzle-orm'
import { check, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { HistoryDetail, HistoryRequest } from '@gramota/contracts'

export const corrections = sqliteTable(
  'corrections',
  {
    id: text('id').primaryKey().notNull(),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
    originalText: text('original_text').notNull(),
    language: text('language').$type<HistoryDetail['language']>().notNull(),
  },
  (table) => [check('corrections_language', sql`${table.language} = 'ru'`)],
)

export const modelRequests = sqliteTable(
  'model_requests',
  {
    id: text('id').primaryKey().notNull(),
    correctionId: text('correction_id')
      .notNull()
      .references(() => corrections.id),
    requestedModel: text('requested_model').notNull(),
    mode: text('mode').$type<HistoryRequest['mode']>().notNull().default('strict'),
    returnedModel: text('returned_model'),
    provider: text('provider'),
    openrouterGenerationId: text('openrouter_generation_id'),
    promptVersion: text('prompt_version').notNull(),
    parameters: text('parameters_json', { mode: 'json' }).$type<object>().notNull(),
    correctedText: text('corrected_text'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    appRequestTimeMs: integer('duration_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    reasoningTokens: integer('reasoning_tokens'),
    cachedInputTokens: integer('cached_input_tokens'),
    cacheWriteTokens: integer('cache_write_tokens'),
    costUsd: real('cost_usd'),
    generationTimeMs: real('generation_time_ms'),
    upstreamInferenceCostUsd: real('upstream_inference_cost_usd'),
    upstreamPromptCostUsd: real('upstream_prompt_cost_usd'),
    upstreamCompletionCostUsd: real('upstream_completion_cost_usd'),
    routingStrategy: text('routing_strategy'),
    routingRegion: text('routing_region'),
    routingAttempt: integer('routing_attempt'),
    isByok: integer('is_byok', { mode: 'boolean' }),
    finishReason: text('finish_reason'),
    status: text('status').$type<HistoryRequest['status']>().notNull(),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
  },
  (table) => [
    check('requests_mode', sql`${table.mode} IN ('strict', 'gentle-rewrite')`),
    check('requests_parameters_json', sql`json_valid(${table.parameters})`),
    ...[
      table.appRequestTimeMs,
      table.inputTokens,
      table.outputTokens,
      table.totalTokens,
      table.reasoningTokens,
      table.cachedInputTokens,
      table.cacheWriteTokens,
      table.costUsd,
      table.generationTimeMs,
      table.upstreamInferenceCostUsd,
      table.upstreamPromptCostUsd,
      table.upstreamCompletionCostUsd,
      table.routingAttempt,
    ].map((column) => check(`${column.name}_nonnegative`, sql`${column} >= 0`)),
    check('requests_is_byok', sql`${table.isByok} IN (0, 1)`),
    check('requests_status', sql`${table.status} IN ('pending', 'succeeded', 'failed')`),
    check(
      'requests_outcome',
      sql`
    (${table.status} = 'pending'
      AND ${table.correctedText} IS NULL AND ${table.endedAt} IS NULL
      AND ${table.appRequestTimeMs} IS NULL AND ${table.errorCode} IS NULL
      AND ${table.errorMessage} IS NULL)
    OR (${table.status} = 'succeeded'
      AND length(${table.correctedText}) > 0 AND ${table.correctedText} IS NOT NULL
      AND ${table.endedAt} IS NOT NULL AND ${table.appRequestTimeMs} IS NOT NULL
      AND ${table.errorCode} IS NULL AND ${table.errorMessage} IS NULL)
    OR (${table.status} = 'failed'
      AND ${table.correctedText} IS NULL AND ${table.endedAt} IS NOT NULL
      AND ${table.errorCode} IS NOT NULL AND ${table.errorMessage} IS NOT NULL)`,
    ),
  ],
)

export const modelPreference = sqliteTable(
  'model_preference',
  {
    id: integer('id').primaryKey(),
    modelId: text('model_id').notNull(),
  },
  (table) => [check('model_preference_singleton', sql`${table.id} = 1`)],
)
