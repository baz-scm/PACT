CREATE TABLE `comments` (
	`id` text PRIMARY KEY,
	`series_id` text NOT NULL,
	`body` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_comments_series_id_plan_series_id_fk` FOREIGN KEY (`series_id`) REFERENCES `plan_series`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `plan_series` (
	`id` text PRIMARY KEY,
	`series_key` text NOT NULL UNIQUE,
	`share_token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`delisted` integer DEFAULT false NOT NULL,
	`creator_token` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_versions` (
	`id` text PRIMARY KEY,
	`series_id` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`author_kind` text NOT NULL,
	`source_tool` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_plan_versions_series_id_plan_series_id_fk` FOREIGN KEY (`series_id`) REFERENCES `plan_series`(`id`) ON DELETE CASCADE
);
