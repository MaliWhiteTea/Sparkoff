ALTER TABLE `feedbacks` ADD `image_original_name` varchar(255);--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `image_mime_type` varchar(100);--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `image_size` bigint unsigned;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `status` varchar(20) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `admin_note` text;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `handled_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `handled_at` datetime;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
CREATE INDEX `feedbacks_status_idx` ON `feedbacks` (`status`);--> statement-breakpoint
CREATE INDEX `feedbacks_kind_idx` ON `feedbacks` (`kind`);