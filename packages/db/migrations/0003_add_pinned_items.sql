CREATE TABLE `pinned_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`target_type` text NOT NULL,
	`target_ticker` text NOT NULL,
	`pinned_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pinned_items_provider_target_unique` ON `pinned_items` (`provider`,`target_type`,`target_ticker`);
--> statement-breakpoint
CREATE INDEX `pinned_items_pinned_at_idx` ON `pinned_items` (`pinned_at`);
