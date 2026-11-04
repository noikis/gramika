import { sql } from 'drizzle-orm'
import { check, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  ExplanationAttempt,
  ExplanationRequest,
  HistoryDetail,
  HistoryRequest,
} from '@gramota/contracts'

export const user = sqliteTable('user', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey().notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey().notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey().notNull(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const corrections = sqliteTable(
  'corrections',
  {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    lastUsedAt: text('last_used_at').notNull().default(''),
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
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
  },
  (table) => [check('model_preference_singleton', sql`${table.id} = 1`)],
)

export const userModelPreference = sqliteTable('user_model_preference', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  modelId: text('model_id').notNull(),
})

export const explanations = sqliteTable(
  'explanations',
  {
    requestId: text('request_id')
      .notNull()
      .references(() => modelRequests.id),
    originalStart: integer('original_start').notNull(),
    originalEnd: integer('original_end').notNull(),
    correctedStart: integer('corrected_start').notNull(),
    correctedEnd: integer('corrected_end').notNull(),
    explanation: text('explanation').notNull(),
    deletedAt: text('deleted_at'),
    selectionKey: text('selection_key').notNull().default('legacy'),
    selection: text('selection_json', { mode: 'json' }).$type<ExplanationRequest>(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.requestId,
        table.originalStart,
        table.originalEnd,
        table.correctedStart,
        table.correctedEnd,
        table.selectionKey,
      ],
    }),
    check(
      'explanation_original_range',
      sql`${table.originalStart} >= 0 AND ${table.originalEnd} >= ${table.originalStart}`,
    ),
    check(
      'explanation_corrected_range',
      sql`${table.correctedStart} >= 0 AND ${table.correctedEnd} >= ${table.correctedStart}`,
    ),
    check('explanation_nonempty', sql`length(trim(${table.explanation})) > 0`),
    check(
      'explanation_selection_json',
      sql`${table.selection} IS NULL OR json_valid(${table.selection})`,
    ),
  ],
)

export const explanationAttempts = sqliteTable(
  'explanation_attempts',
  {
    id: text('id').primaryKey().notNull(),
    requestId: text('request_id')
      .notNull()
      .references(() => modelRequests.id),
    record: text('record_json', { mode: 'json' }).$type<ExplanationAttempt>().notNull(),
  },
  (table) => [check('explanation_attempt_record_json', sql`json_valid(${table.record})`)],
)
