ALTER TABLE `corrections` ADD `last_used_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `corrections` SET `last_used_at` = `created_at`;
