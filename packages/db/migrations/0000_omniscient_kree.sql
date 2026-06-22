CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`external_event_id` text NOT NULL,
	`event_ticker` text NOT NULL,
	`series_ticker` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`category` text,
	`settlement_sources_json` text DEFAULT '[]' NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_provider_event_ticker_unique` ON `events` (`provider`,`event_ticker`);--> statement-breakpoint
CREATE INDEX `events_category_idx` ON `events` (`category`);--> statement-breakpoint
CREATE TABLE `market_focus_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`market_id` integer NOT NULL,
	`focus` text NOT NULL,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_focus_tags_market_id_focus_unique` ON `market_focus_tags` (`market_id`,`focus`);--> statement-breakpoint
CREATE INDEX `market_focus_tags_focus_idx` ON `market_focus_tags` (`focus`);--> statement-breakpoint
CREATE TABLE `market_sides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`market_id` integer NOT NULL,
	`label` text NOT NULL,
	`side` text NOT NULL,
	`bid` real,
	`ask` real,
	`price` real,
	`investable` integer DEFAULT false NOT NULL,
	`raw_json` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_sides_market_id_side_unique` ON `market_sides` (`market_id`,`side`);--> statement-breakpoint
CREATE TABLE `markets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`external_market_id` text NOT NULL,
	`ticker` text NOT NULL,
	`event_ticker` text NOT NULL,
	`series_ticker` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`category` text,
	`market_type` text NOT NULL,
	`status` text NOT NULL,
	`close_time` text NOT NULL,
	`expiration_time` text,
	`open_time` text NOT NULL,
	`volume` real DEFAULT 0 NOT NULL,
	`volume_24h` real DEFAULT 0 NOT NULL,
	`liquidity` real DEFAULT 0 NOT NULL,
	`open_interest` real DEFAULT 0 NOT NULL,
	`yes_bid` real,
	`yes_ask` real,
	`no_bid` real,
	`no_ask` real,
	`last_price` real,
	`rules_primary` text,
	`rules_secondary` text,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_provider_ticker_unique` ON `markets` (`provider`,`ticker`);--> statement-breakpoint
CREATE INDEX `markets_status_close_time_idx` ON `markets` (`status`,`close_time`);--> statement-breakpoint
CREATE INDEX `markets_event_ticker_idx` ON `markets` (`event_ticker`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`events_upserted` integer DEFAULT 0 NOT NULL,
	`markets_upserted` integer DEFAULT 0 NOT NULL,
	`errors_count` integer DEFAULT 0 NOT NULL,
	`focus_filter_json` text,
	`error_summary` text
);
