CREATE TABLE `payee_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`payee` text NOT NULL,
	`categoryId` text,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payee_rules_workspace_payee_unique` ON `payee_rules` (`workspaceId`,`payee`);--> statement-breakpoint
CREATE TABLE `share_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`revokedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_tokens_token_unique` ON `share_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `share_tokens_workspace_idx` ON `share_tokens` (`workspaceId`);