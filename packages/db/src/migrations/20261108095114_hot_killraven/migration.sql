CREATE TABLE `announcement` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`published_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_announcement_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`location` text,
	`is_online` integer DEFAULT false NOT NULL,
	`cover_image_url` text,
	`status` text NOT NULL,
	`published_at` integer,
	`series_id` text,
	`recurrence_freq` text,
	`recurrence_interval` integer,
	`recurrence_end` integer,
	`exception_dates` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_event_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `permissions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `announcement_seen_at` integer;--> statement-breakpoint
CREATE INDEX `announcement_status_published_at_idx` ON `announcement` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `event_status_starts_at_idx` ON `event` (`status`,`starts_at`);