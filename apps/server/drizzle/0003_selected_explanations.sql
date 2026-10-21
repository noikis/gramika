CREATE TABLE `explanations` (
	`request_id` text NOT NULL,
	`original_start` integer NOT NULL,
	`original_end` integer NOT NULL,
	`corrected_start` integer NOT NULL,
	`corrected_end` integer NOT NULL,
	`explanation` text NOT NULL,
	PRIMARY KEY(`request_id`, `original_start`, `original_end`, `corrected_start`, `corrected_end`),
	FOREIGN KEY (`request_id`) REFERENCES `model_requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "explanation_original_range" CHECK("explanations"."original_start" >= 0 AND "explanations"."original_end" >= "explanations"."original_start"),
	CONSTRAINT "explanation_corrected_range" CHECK("explanations"."corrected_start" >= 0 AND "explanations"."corrected_end" >= "explanations"."corrected_start"),
	CONSTRAINT "explanation_nonempty" CHECK(length(trim("explanations"."explanation")) > 0)
);
