CREATE TABLE `player_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`target_id` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `block_owner_target` ON `player_blocks` (`player_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `api_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`map_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`duration` integer NOT NULL,
	`digest` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_results` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`kills` integer NOT NULL,
	`deaths` integer NOT NULL,
	`headshots` integer NOT NULL,
	`max_streak` integer NOT NULL,
	`seconds` integer NOT NULL,
	`won` integer NOT NULL,
	`completed` integer NOT NULL,
	`xp` integer NOT NULL,
	`finished_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `live_matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `live_result_player_time` ON `live_results` (`player_id`,`finished_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_result_participant` ON `live_results` (`match_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `message_inbox_time` ON `messages` (`receiver_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `message_sender_time` ON `messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`report_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presence` (
	`player_id` text PRIMARY KEY NOT NULL,
	`activity` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `player_sanctions` (
	`player_id` text PRIMARY KEY NOT NULL,
	`until_at` integer NOT NULL,
	`reason` text NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
