CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`budgetMinor` numeric,
	`sort` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_workspace_name_unique` ON `categories` (`workspaceId`,`name`);--> statement-breakpoint
CREATE TABLE `commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`vendor` text NOT NULL,
	`categoryId` text,
	`totalMinor` numeric NOT NULL,
	`paidMinor` numeric NOT NULL,
	`dueOn` text,
	`status` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `commitments_workspace_due_idx` ON `commitments` (`workspaceId`,`dueOn`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`sourceId` text NOT NULL,
	`period` text,
	`pocketName` text NOT NULL,
	`txCount` integer NOT NULL,
	`reconciled` integer NOT NULL,
	`issues` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `imports_workspace_created_idx` ON `imports` (`workspaceId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `members` (
	`workspaceId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`workspaceId`, `userId`),
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "members_role_check" CHECK("members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_unique` ON `members` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_workspace_role_unique` ON `members` (`workspaceId`,`role`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`memberId` text,
	`categoryId` text,
	`importId` text,
	`occurredOn` text NOT NULL,
	`description` text NOT NULL,
	`amountMinor` numeric NOT NULL,
	`balanceMinor` numeric NOT NULL,
	`direction` text NOT NULL,
	`ref` text,
	`source` text NOT NULL,
	`dedupeHash` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`importId`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `transactions_workspace_occurred_idx` ON `transactions` (`workspaceId`,`occurredOn`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_workspace_dedupe_unique` ON `transactions` (`workspaceId`,`dedupeHash`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`weddingDate` text,
	`budgetTargetMinor` numeric,
	`inviteCode` text NOT NULL,
	`plan` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_ownerId_unique` ON `workspaces` (`ownerId`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_inviteCode_unique` ON `workspaces` (`inviteCode`);