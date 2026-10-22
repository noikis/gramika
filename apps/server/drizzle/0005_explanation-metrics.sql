CREATE TABLE `explanation_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`record_json` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `model_requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "explanation_attempt_record_json" CHECK(json_valid("explanation_attempts"."record_json"))
);
