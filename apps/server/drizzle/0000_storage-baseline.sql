CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`original_text` text NOT NULL,
	`language` text NOT NULL,
	`mode` text NOT NULL,
	CONSTRAINT "corrections_language" CHECK("corrections"."language" = 'ru'),
	CONSTRAINT "corrections_mode" CHECK("corrections"."mode" = 'strict')
);
--> statement-breakpoint
CREATE TABLE `model_preference` (
	`id` integer PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	CONSTRAINT "model_preference_singleton" CHECK("model_preference"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `model_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`correction_id` text NOT NULL,
	`requested_model` text NOT NULL,
	`returned_model` text,
	`provider` text,
	`openrouter_generation_id` text,
	`prompt_version` text NOT NULL,
	`parameters_json` text NOT NULL,
	`corrected_text` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_ms` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`reasoning_tokens` integer,
	`cached_input_tokens` integer,
	`cache_write_tokens` integer,
	`cost_usd` real,
	`generation_time_ms` real,
	`upstream_inference_cost_usd` real,
	`upstream_prompt_cost_usd` real,
	`upstream_completion_cost_usd` real,
	`routing_strategy` text,
	`routing_region` text,
	`routing_attempt` integer,
	`is_byok` integer,
	`finish_reason` text,
	`status` text NOT NULL,
	`error_code` text,
	`error_message` text,
	FOREIGN KEY (`correction_id`) REFERENCES `corrections`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requests_parameters_json" CHECK(json_valid("model_requests"."parameters_json")),
	CONSTRAINT "duration_ms_nonnegative" CHECK("model_requests"."duration_ms" >= 0),
	CONSTRAINT "input_tokens_nonnegative" CHECK("model_requests"."input_tokens" >= 0),
	CONSTRAINT "output_tokens_nonnegative" CHECK("model_requests"."output_tokens" >= 0),
	CONSTRAINT "total_tokens_nonnegative" CHECK("model_requests"."total_tokens" >= 0),
	CONSTRAINT "reasoning_tokens_nonnegative" CHECK("model_requests"."reasoning_tokens" >= 0),
	CONSTRAINT "cached_input_tokens_nonnegative" CHECK("model_requests"."cached_input_tokens" >= 0),
	CONSTRAINT "cache_write_tokens_nonnegative" CHECK("model_requests"."cache_write_tokens" >= 0),
	CONSTRAINT "cost_usd_nonnegative" CHECK("model_requests"."cost_usd" >= 0),
	CONSTRAINT "generation_time_ms_nonnegative" CHECK("model_requests"."generation_time_ms" >= 0),
	CONSTRAINT "upstream_inference_cost_usd_nonnegative" CHECK("model_requests"."upstream_inference_cost_usd" >= 0),
	CONSTRAINT "upstream_prompt_cost_usd_nonnegative" CHECK("model_requests"."upstream_prompt_cost_usd" >= 0),
	CONSTRAINT "upstream_completion_cost_usd_nonnegative" CHECK("model_requests"."upstream_completion_cost_usd" >= 0),
	CONSTRAINT "routing_attempt_nonnegative" CHECK("model_requests"."routing_attempt" >= 0),
	CONSTRAINT "requests_is_byok" CHECK("model_requests"."is_byok" IN (0, 1)),
	CONSTRAINT "requests_status" CHECK("model_requests"."status" IN ('pending', 'succeeded', 'failed')),
	CONSTRAINT "requests_outcome" CHECK(
    ("model_requests"."status" = 'pending'
      AND "model_requests"."corrected_text" IS NULL AND "model_requests"."ended_at" IS NULL
      AND "model_requests"."duration_ms" IS NULL AND "model_requests"."error_code" IS NULL
      AND "model_requests"."error_message" IS NULL)
    OR ("model_requests"."status" = 'succeeded'
      AND length("model_requests"."corrected_text") > 0 AND "model_requests"."corrected_text" IS NOT NULL
      AND "model_requests"."ended_at" IS NOT NULL AND "model_requests"."duration_ms" IS NOT NULL
      AND "model_requests"."error_code" IS NULL AND "model_requests"."error_message" IS NULL)
    OR ("model_requests"."status" = 'failed'
      AND "model_requests"."corrected_text" IS NULL AND "model_requests"."ended_at" IS NOT NULL
      AND "model_requests"."error_code" IS NOT NULL AND "model_requests"."error_message" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO model_preference (id, model_id) VALUES (1, 'google/gemma-4-26b-a4b-it');
--> statement-breakpoint
PRAGMA user_version = 3;
