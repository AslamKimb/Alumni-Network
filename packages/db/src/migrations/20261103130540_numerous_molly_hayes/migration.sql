CREATE TABLE `app_setting` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_by` text
);
