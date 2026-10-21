CREATE TABLE `__new_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`original_text` text NOT NULL,
	`language` text NOT NULL,
	CONSTRAINT "corrections_language" CHECK("__new_corrections"."language" = 'ru')
);
--> statement-breakpoint
INSERT INTO `__new_corrections`("id", "created_at", "original_text", "language") SELECT "id", "created_at", "original_text", "language" FROM `corrections`;--> statement-breakpoint
CREATE TABLE `__new_model_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`correction_id` text NOT NULL,
	`requested_model` text NOT NULL,
	`mode` text DEFAULT 'strict' NOT NULL,
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
	FOREIGN KEY (`correction_id`) REFERENCES `__new_corrections`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "requests_mode" CHECK("__new_model_requests"."mode" IN ('strict', 'gentle-rewrite')),
	CONSTRAINT "requests_parameters_json" CHECK(json_valid("__new_model_requests"."parameters_json")),
	CONSTRAINT "duration_ms_nonnegative" CHECK("__new_model_requests"."duration_ms" >= 0),
	CONSTRAINT "input_tokens_nonnegative" CHECK("__new_model_requests"."input_tokens" >= 0),
	CONSTRAINT "output_tokens_nonnegative" CHECK("__new_model_requests"."output_tokens" >= 0),
	CONSTRAINT "total_tokens_nonnegative" CHECK("__new_model_requests"."total_tokens" >= 0),
	CONSTRAINT "reasoning_tokens_nonnegative" CHECK("__new_model_requests"."reasoning_tokens" >= 0),
	CONSTRAINT "cached_input_tokens_nonnegative" CHECK("__new_model_requests"."cached_input_tokens" >= 0),
	CONSTRAINT "cache_write_tokens_nonnegative" CHECK("__new_model_requests"."cache_write_tokens" >= 0),
	CONSTRAINT "cost_usd_nonnegative" CHECK("__new_model_requests"."cost_usd" >= 0),
	CONSTRAINT "generation_time_ms_nonnegative" CHECK("__new_model_requests"."generation_time_ms" >= 0),
	CONSTRAINT "upstream_inference_cost_usd_nonnegative" CHECK("__new_model_requests"."upstream_inference_cost_usd" >= 0),
	CONSTRAINT "upstream_prompt_cost_usd_nonnegative" CHECK("__new_model_requests"."upstream_prompt_cost_usd" >= 0),
	CONSTRAINT "upstream_completion_cost_usd_nonnegative" CHECK("__new_model_requests"."upstream_completion_cost_usd" >= 0),
	CONSTRAINT "routing_attempt_nonnegative" CHECK("__new_model_requests"."routing_attempt" >= 0),
	CONSTRAINT "requests_is_byok" CHECK("__new_model_requests"."is_byok" IN (0, 1)),
	CONSTRAINT "requests_status" CHECK("__new_model_requests"."status" IN ('pending', 'succeeded', 'failed')),
	CONSTRAINT "requests_outcome" CHECK(
    ("__new_model_requests"."status" = 'pending'
      AND "__new_model_requests"."corrected_text" IS NULL AND "__new_model_requests"."ended_at" IS NULL
      AND "__new_model_requests"."duration_ms" IS NULL AND "__new_model_requests"."error_code" IS NULL
      AND "__new_model_requests"."error_message" IS NULL)
    OR ("__new_model_requests"."status" = 'succeeded'
      AND length("__new_model_requests"."corrected_text") > 0 AND "__new_model_requests"."corrected_text" IS NOT NULL
      AND "__new_model_requests"."ended_at" IS NOT NULL AND "__new_model_requests"."duration_ms" IS NOT NULL
      AND "__new_model_requests"."error_code" IS NULL AND "__new_model_requests"."error_message" IS NULL)
    OR ("__new_model_requests"."status" = 'failed'
      AND "__new_model_requests"."corrected_text" IS NULL AND "__new_model_requests"."ended_at" IS NOT NULL
      AND "__new_model_requests"."error_code" IS NOT NULL AND "__new_model_requests"."error_message" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_model_requests`("id", "correction_id", "requested_model", "mode", "returned_model", "provider", "openrouter_generation_id", "prompt_version", "parameters_json", "corrected_text", "started_at", "ended_at", "duration_ms", "input_tokens", "output_tokens", "total_tokens", "reasoning_tokens", "cached_input_tokens", "cache_write_tokens", "cost_usd", "generation_time_ms", "upstream_inference_cost_usd", "upstream_prompt_cost_usd", "upstream_completion_cost_usd", "routing_strategy", "routing_region", "routing_attempt", "is_byok", "finish_reason", "status", "error_code", "error_message") SELECT "id", "correction_id", "requested_model", 'strict', "returned_model", "provider", "openrouter_generation_id", "prompt_version", "parameters_json", "corrected_text", "started_at", "ended_at", "duration_ms", "input_tokens", "output_tokens", "total_tokens", "reasoning_tokens", "cached_input_tokens", "cache_write_tokens", "cost_usd", "generation_time_ms", "upstream_inference_cost_usd", "upstream_prompt_cost_usd", "upstream_completion_cost_usd", "routing_strategy", "routing_region", "routing_attempt", "is_byok", "finish_reason", "status", "error_code", "error_message" FROM `model_requests`;--> statement-breakpoint
DROP TABLE `model_requests`;--> statement-breakpoint
DROP TABLE `corrections`;--> statement-breakpoint
ALTER TABLE `__new_corrections` RENAME TO `corrections`;--> statement-breakpoint
ALTER TABLE `__new_model_requests` RENAME TO `model_requests`;