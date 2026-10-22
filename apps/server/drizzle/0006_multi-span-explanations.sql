PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_explanations` (
	`request_id` text NOT NULL,
	`original_start` integer NOT NULL,
	`original_end` integer NOT NULL,
	`corrected_start` integer NOT NULL,
	`corrected_end` integer NOT NULL,
	`explanation` text NOT NULL,
	`deleted_at` text,
	`selection_key` text DEFAULT 'legacy' NOT NULL,
	`selection_json` text,
	PRIMARY KEY(`request_id`, `original_start`, `original_end`, `corrected_start`, `corrected_end`, `selection_key`),
	FOREIGN KEY (`request_id`) REFERENCES `model_requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "explanation_original_range" CHECK("__new_explanations"."original_start" >= 0 AND "__new_explanations"."original_end" >= "__new_explanations"."original_start"),
	CONSTRAINT "explanation_corrected_range" CHECK("__new_explanations"."corrected_start" >= 0 AND "__new_explanations"."corrected_end" >= "__new_explanations"."corrected_start"),
	CONSTRAINT "explanation_nonempty" CHECK(length(trim("__new_explanations"."explanation")) > 0),
	CONSTRAINT "explanation_selection_json" CHECK("__new_explanations"."selection_json" IS NULL OR json_valid("__new_explanations"."selection_json"))
);
--> statement-breakpoint
INSERT INTO `__new_explanations`("request_id", "original_start", "original_end", "corrected_start", "corrected_end", "explanation", "deleted_at", "selection_key", "selection_json") SELECT "request_id", "original_start", "original_end", "corrected_start", "corrected_end", "explanation", strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'legacy', NULL FROM `explanations`;--> statement-breakpoint
DROP TABLE `explanations`;--> statement-breakpoint
ALTER TABLE `__new_explanations` RENAME TO `explanations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
