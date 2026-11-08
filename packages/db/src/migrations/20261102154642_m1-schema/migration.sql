-- Legacy domain rows need an explicit mapping before this schema change can proceed.
CREATE TEMP TABLE `__m1_legacy_data_guard` (
	`legacy_rows` integer NOT NULL CHECK (`legacy_rows` = 0)
);
--> statement-breakpoint
INSERT INTO `__m1_legacy_data_guard`
SELECT
	(SELECT count(*) FROM `alumni_profile`) +
	(SELECT count(*) FROM `duty`) +
	(SELECT count(*) FROM `education`);
--> statement-breakpoint
DROP TABLE `__m1_legacy_data_guard`;
--> statement-breakpoint
ALTER TABLE `alumni_profile` RENAME TO `alumnus_profile`;--> statement-breakpoint
ALTER TABLE `duty` RENAME COLUMN `duty_type` TO `type`;--> statement-breakpoint
ALTER TABLE `duty` RENAME COLUMN `role` TO `title`;--> statement-breakpoint
ALTER TABLE `education` RENAME COLUMN `degree` TO `level`;--> statement-breakpoint
ALTER TABLE `education` RENAME COLUMN `field_of_study` TO `program`;--> statement-breakpoint
ALTER TABLE `alumnus_profile` ADD `full_name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `alumnus_profile` ADD `country_code` text;--> statement-breakpoint
ALTER TABLE `duty` ADD `profile_id` text NOT NULL REFERENCES alumnus_profile(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `duty` ADD `description` text;--> statement-breakpoint
ALTER TABLE `duty` ADD `sort_order` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `education` ADD `profile_id` text NOT NULL REFERENCES alumnus_profile(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `education` ADD `year_completed` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `education` ADD `description` text;--> statement-breakpoint
ALTER TABLE `education` ADD `sort_order` integer NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_duty` (
	`id` text PRIMARY KEY,
	`profile_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`organization` text NOT NULL,
	`start_year` integer NOT NULL,
	`end_year` integer,
	`description` text,
	`sort_order` integer NOT NULL,
	CONSTRAINT `fk_duty_profile_id_alumnus_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `alumnus_profile`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_duty`(`id`, `type`, `organization`, `title`, `start_year`, `end_year`) SELECT `id`, `type`, `organization`, `title`, `start_year`, `end_year` FROM `duty`;--> statement-breakpoint
DROP TABLE `duty`;--> statement-breakpoint
ALTER TABLE `__new_duty` RENAME TO `duty`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_education` (
	`id` text PRIMARY KEY,
	`profile_id` text NOT NULL,
	`level` text NOT NULL,
	`program` text NOT NULL,
	`institution` text NOT NULL,
	`year_completed` integer NOT NULL,
	`description` text,
	`sort_order` integer NOT NULL,
	CONSTRAINT `fk_education_profile_id_alumnus_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `alumnus_profile`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_education`(`id`, `institution`, `level`, `program`) SELECT `id`, `institution`, `level`, `program` FROM `education`;--> statement-breakpoint
DROP TABLE `education`;--> statement-breakpoint
ALTER TABLE `__new_education` RENAME TO `education`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `duty_profile_id_idx` ON `duty` (`profile_id`);--> statement-breakpoint
CREATE INDEX `duty_type_idx` ON `duty` (`type`);--> statement-breakpoint
CREATE INDEX `education_profile_id_idx` ON `education` (`profile_id`);--> statement-breakpoint
CREATE INDEX `education_level_idx` ON `education` (`level`);--> statement-breakpoint
CREATE INDEX `alumnus_profile_country_code_idx` ON `alumnus_profile` (`country_code`);--> statement-breakpoint
CREATE INDEX `alumnus_profile_work_status_idx` ON `alumnus_profile` (`work_status`);--> statement-breakpoint
CREATE INDEX `alumnus_profile_campus_end_year_idx` ON `alumnus_profile` (`campus_end_year`);--> statement-breakpoint
CREATE INDEX `alumnus_profile_updated_at_idx` ON `alumnus_profile` (`updated_at`);--> statement-breakpoint
ALTER TABLE `alumnus_profile` DROP COLUMN `country`;--> statement-breakpoint
ALTER TABLE `alumnus_profile` DROP COLUMN `onboarding_step`;
