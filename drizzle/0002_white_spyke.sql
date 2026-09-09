CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`rules` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_challenge_receiver` ON `challenges` (`receiver_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_challenge_sender` ON `challenges` (`sender_id`,`status`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`sku` text NOT NULL,
	`equipped` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inventory_player_sku` ON `inventory` (`player_id`,`sku`);--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `party_members` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`player_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_party_player` ON `party_members` (`party_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_joined_party` ON `party_members` (`player_id`) WHERE "party_members"."status" = 'joined';--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`match_id` text,
	`category` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reports_player` ON `reports` (`player_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `matches` ADD `stake` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `target` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `best_of` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `weapon_rule` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `entry` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `headshots` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `max_streak` integer DEFAULT 0 NOT NULL;