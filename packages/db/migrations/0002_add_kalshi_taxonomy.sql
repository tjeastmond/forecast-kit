ALTER TABLE `markets` ADD `series_tags_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE TABLE `provider_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`synced_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_categories_provider_category_unique` ON `provider_categories` (`provider`,`category`);
--> statement-breakpoint
CREATE TABLE `provider_category_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`category` text NOT NULL,
	`tag` text NOT NULL,
	`synced_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_category_tags_provider_category_tag_unique` ON `provider_category_tags` (`provider`,`category`,`tag`);
--> statement-breakpoint
CREATE INDEX `provider_category_tags_tag_idx` ON `provider_category_tags` (`tag`);
--> statement-breakpoint
CREATE TABLE `provider_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`series_ticker` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`last_updated_ts` text,
	`raw_json` text NOT NULL,
	`synced_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_series_provider_series_ticker_unique` ON `provider_series` (`provider`,`series_ticker`);
--> statement-breakpoint
CREATE INDEX `provider_series_category_idx` ON `provider_series` (`category`);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
