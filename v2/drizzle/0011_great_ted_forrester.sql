CREATE TABLE `announcement_roles` (
	`announcement_id` bigint unsigned NOT NULL,
	`role_id` bigint unsigned NOT NULL,
	CONSTRAINT `announcement_roles_announcement_id_role_id_pk` PRIMARY KEY(`announcement_id`,`role_id`)
);
--> statement-breakpoint
ALTER TABLE `announcement_reads` ADD `acknowledged_at` datetime;--> statement-breakpoint
ALTER TABLE `announcements` ADD `requires_acknowledgement` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `announcement_roles_role_idx` ON `announcement_roles` (`role_id`);