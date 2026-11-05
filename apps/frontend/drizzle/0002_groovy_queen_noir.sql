-- 0002: the three FKs deferred for the auth tables (ERD §4 #4, #5, #13).
-- SQLite cannot ADD a foreign key, and D1 always enforces them (PRAGMA foreign_keys
-- is not switchable), so `DROP TABLE workspaces` would cascade-delete every child
-- row. Hence: rename all six domain tables first (children's REFERENCES follow the
-- rename), rebuild, copy, then drop the _old tables child-to-parent — by then
-- nothing references them, so the implicit delete fires no action.
ALTER TABLE `workspaces` RENAME TO `workspaces_old`;--> statement-breakpoint
ALTER TABLE `members` RENAME TO `members_old`;--> statement-breakpoint
ALTER TABLE `categories` RENAME TO `categories_old`;--> statement-breakpoint
ALTER TABLE `imports` RENAME TO `imports_old`;--> statement-breakpoint
ALTER TABLE `transactions` RENAME TO `transactions_old`;--> statement-breakpoint
ALTER TABLE `commitments` RENAME TO `commitments_old`;--> statement-breakpoint
DROP INDEX IF EXISTS `workspaces_ownerId_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `workspaces_inviteCode_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `members_user_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `members_workspace_role_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `categories_workspace_name_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `imports_workspace_created_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `transactions_workspace_occurred_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `transactions_category_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `transactions_workspace_dedupe_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `commitments_workspace_due_idx`;--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`name` text NOT NULL,
	`weddingDate` text,
	`budgetTargetMinor` numeric,
	`inviteCode` text NOT NULL,
	`plan` text,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_ownerId_unique` ON `workspaces` (`ownerId`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_inviteCode_unique` ON `workspaces` (`inviteCode`);--> statement-breakpoint
CREATE TABLE `members` (
	`workspaceId` text NOT NULL,
	`userId` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`workspaceId`, `userId`),
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "members_role_check" CHECK("members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_unique` ON `members` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_workspace_role_unique` ON `members` (`workspaceId`,`role`);--> statement-breakpoint
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
	FOREIGN KEY (`memberId`) REFERENCES `members`(`userId`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`importId`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `transactions_workspace_occurred_idx` ON `transactions` (`workspaceId`,`occurredOn`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_workspace_dedupe_unique` ON `transactions` (`workspaceId`,`dedupeHash`);--> statement-breakpoint
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
INSERT INTO `workspaces`(`id`, `ownerId`, `name`, `weddingDate`, `budgetTargetMinor`, `inviteCode`, `plan`) SELECT `id`, `ownerId`, `name`, `weddingDate`, `budgetTargetMinor`, `inviteCode`, `plan` FROM `workspaces_old`;--> statement-breakpoint
INSERT INTO `members`(`workspaceId`, `userId`, `role`) SELECT `workspaceId`, `userId`, `role` FROM `members_old`;--> statement-breakpoint
INSERT INTO `categories`(`id`, `workspaceId`, `name`, `kind`, `budgetMinor`, `sort`) SELECT `id`, `workspaceId`, `name`, `kind`, `budgetMinor`, `sort` FROM `categories_old`;--> statement-breakpoint
INSERT INTO `imports`(`id`, `workspaceId`, `sourceId`, `period`, `pocketName`, `txCount`, `reconciled`, `issues`, `createdAt`) SELECT `id`, `workspaceId`, `sourceId`, `period`, `pocketName`, `txCount`, `reconciled`, `issues`, `createdAt` FROM `imports_old`;--> statement-breakpoint
INSERT INTO `transactions`(`id`, `workspaceId`, `memberId`, `categoryId`, `importId`, `occurredOn`, `description`, `amountMinor`, `balanceMinor`, `direction`, `ref`, `source`, `dedupeHash`) SELECT `id`, `workspaceId`, `memberId`, `categoryId`, `importId`, `occurredOn`, `description`, `amountMinor`, `balanceMinor`, `direction`, `ref`, `source`, `dedupeHash` FROM `transactions_old`;--> statement-breakpoint
INSERT INTO `commitments`(`id`, `workspaceId`, `vendor`, `categoryId`, `totalMinor`, `paidMinor`, `dueOn`, `status`) SELECT `id`, `workspaceId`, `vendor`, `categoryId`, `totalMinor`, `paidMinor`, `dueOn`, `status` FROM `commitments_old`;--> statement-breakpoint
DROP TABLE `transactions_old`;--> statement-breakpoint
DROP TABLE `commitments_old`;--> statement-breakpoint
DROP TABLE `members_old`;--> statement-breakpoint
DROP TABLE `imports_old`;--> statement-breakpoint
DROP TABLE `categories_old`;--> statement-breakpoint
DROP TABLE `workspaces_old`;
