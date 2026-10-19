import type { DatabaseSync } from 'node:sqlite'
import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import { withTransaction } from './sqlite'

const METRICS_SCHEMA_VERSION = 2
const MODEL_PREFERENCE_SCHEMA_VERSION = 3
const SCHEMA_VERSION = MODEL_PREFERENCE_SCHEMA_VERSION

export function migrateDatabase(db: DatabaseSync) {
  const version = db.prepare('PRAGMA user_version').get()?.user_version
  if (typeof version !== 'number' || version > SCHEMA_VERSION)
    throw new Error('Unsupported database version')

  if (version === 0)
    withTransaction(db, () =>
      db.exec(`
      CREATE TABLE corrections (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        original_text TEXT NOT NULL,
        language TEXT NOT NULL CHECK(language='ru'),
        mode TEXT NOT NULL CHECK(mode='strict')
      );

      CREATE TABLE model_requests (
        id TEXT PRIMARY KEY NOT NULL,
        correction_id TEXT NOT NULL REFERENCES corrections(id),
        requested_model TEXT NOT NULL,
        returned_model TEXT,
        provider TEXT,
        provider_request_id TEXT,
        prompt_version TEXT NOT NULL,
        parameters_json TEXT NOT NULL CHECK(json_valid(parameters_json)),
        corrected_text TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_ms INTEGER CHECK(duration_ms>=0),
        input_tokens INTEGER CHECK(input_tokens>=0),
        output_tokens INTEGER CHECK(output_tokens>=0),
        reasoning_tokens INTEGER CHECK(reasoning_tokens>=0),
        cached_input_tokens INTEGER CHECK(cached_input_tokens>=0),
        cost_usd REAL CHECK(cost_usd>=0),
        finish_reason TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed')),
        error_code TEXT,
        error_message TEXT,
        CHECK(
          (status='pending'
            AND corrected_text IS NULL AND ended_at IS NULL AND duration_ms IS NULL
            AND error_code IS NULL AND error_message IS NULL)
          OR (status='succeeded'
            AND length(corrected_text)>0 AND corrected_text IS NOT NULL
            AND ended_at IS NOT NULL AND duration_ms IS NOT NULL
            AND error_code IS NULL AND error_message IS NULL)
          OR (status='failed'
            AND corrected_text IS NULL AND ended_at IS NOT NULL
            AND error_code IS NOT NULL AND error_message IS NOT NULL)
        )
      );
      PRAGMA user_version = 1;
    `),
    )

  if (version < METRICS_SCHEMA_VERSION)
    withTransaction(db, () =>
      db.exec(`
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

  if (version < MODEL_PREFERENCE_SCHEMA_VERSION)
    withTransaction(db, () => {
      db.exec(`CREATE TABLE model_preference (
        id INTEGER PRIMARY KEY CHECK(id=1), model_id TEXT NOT NULL
      ); PRAGMA user_version = 3;`)
      db.prepare('INSERT INTO model_preference VALUES(1, ?)').run(DEFAULT_MODEL_ID)
    })
}
