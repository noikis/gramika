CREATE TABLE `user_model_preference` (
	`user_id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
