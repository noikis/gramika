ALTER TABLE `corrections` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `model_preference` ADD `user_id` text REFERENCES user(id);