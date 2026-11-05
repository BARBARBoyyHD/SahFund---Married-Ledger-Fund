CREATE TABLE `rate_limits` (
	`key` text NOT NULL,
	`windowStart` integer NOT NULL,
	`count` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	PRIMARY KEY(`key`, `windowStart`)
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expires_idx` ON `rate_limits` (`expiresAt`);