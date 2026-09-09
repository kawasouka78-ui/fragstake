CREATE TABLE `duel_lobbies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`rules` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_open_lobbies` ON `duel_lobbies` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_hosted_lobby` ON `duel_lobbies` (`owner_id`) WHERE "duel_lobbies"."status" = 'open';--> statement-breakpoint
CREATE TABLE `duel_lobby_members` (
	`id` text PRIMARY KEY NOT NULL,
	`lobby_id` text NOT NULL,
	`player_id` text NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`lobby_id`) REFERENCES `duel_lobbies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lobby_member` ON `duel_lobby_members` (`lobby_id`,`player_id`);