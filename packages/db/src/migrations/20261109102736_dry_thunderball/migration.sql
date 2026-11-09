CREATE TABLE `cohort` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`start_year` integer NOT NULL,
	`end_year` integer NOT NULL,
	`social_url` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_cohort_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE `announcement` ADD `audience` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `announcement` ADD `cover_image_url` text;--> statement-breakpoint
ALTER TABLE `announcement` ADD `related_event_id` text REFERENCES event(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `related_announcement_id` text REFERENCES announcement(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `audience` text DEFAULT 'all' NOT NULL;