ALTER TABLE `announcements` MODIFY COLUMN `created_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `announcements` ADD `legacy_announcement_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `announcements` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_legacy_id_uq` UNIQUE(`legacy_announcement_id`);