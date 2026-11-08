CREATE TABLE `entitlement_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`orderId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entitlement_grants_workspace_idx` ON `entitlement_grants` (`workspaceId`);--> statement-breakpoint
CREATE UNIQUE INDEX `entitlement_grants_order_unique` ON `entitlement_grants` (`orderId`);