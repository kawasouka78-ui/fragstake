CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "no_self_friend" CHECK("friendships"."sender_id" != "friendships"."receiver_id")
);
--> statement-breakpoint
CREATE INDEX `idx_friends_sender` ON `friendships` (`sender_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_friends_receiver` ON `friendships` (`receiver_id`,`status`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`mode` text NOT NULL,
	`rate` integer NOT NULL,
	`team` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`kills` integer DEFAULT 0 NOT NULL,
	`deaths` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`enemy_score` integer DEFAULT 0 NOT NULL,
	`won` integer DEFAULT 0 NOT NULL,
	`delta` integer DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_player_time` ON `matches` (`player_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_matches_status_time` ON `matches` (`status`,`finished_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_active_match` ON `matches` (`player_id`) WHERE "matches"."status" = 'active';--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'orange' NOT NULL,
	`balance` integer DEFAULT 10000 NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	CONSTRAINT "balance_nonnegative" CHECK("players"."balance" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_handle_unique` ON `players` (`handle`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`label` text NOT NULL,
	`match_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_player_time` ON `transactions` (`player_id`,`created_at`);