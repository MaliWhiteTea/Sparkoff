CREATE TABLE `appointment_files` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`appointment_id` bigint unsigned NOT NULL,
	`disk` varchar(40) NOT NULL DEFAULT 'local',
	`path` varchar(512) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`extension` varchar(10) NOT NULL,
	`mime_type` varchar(255),
	`size_bytes` bigint unsigned NOT NULL,
	`scheduled_deletion_at` datetime,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointment_status_histories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`appointment_id` bigint unsigned NOT NULL,
	`actor_id` bigint unsigned,
	`from_status` varchar(40),
	`to_status` varchar(40) NOT NULL,
	`note` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_status_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blackout_periods` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`printer_id` bigint unsigned,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`reason` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `blackout_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operating_hours` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`weekday` int NOT NULL,
	`is_open` boolean NOT NULL DEFAULT false,
	`opens_at` varchar(8),
	`latest_start_at` varchar(8),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `operating_hours_id` PRIMARY KEY(`id`),
	CONSTRAINT `operating_hours_weekday_uq` UNIQUE(`weekday`)
);
--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `status` varchar(40) NOT NULL DEFAULT 'pending_verification';--> statement-breakpoint
UPDATE `appointments` SET `status` = 'pending_approval' WHERE `status` = 'pending';--> statement-breakpoint
ALTER TABLE `appointments` ADD `first_name` varchar(100);--> statement-breakpoint
ALTER TABLE `appointments` ADD `last_name` varchar(100);--> statement-breakpoint
ALTER TABLE `appointments` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `appointments` ADD `duration_minutes` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `filament_source` varchar(20);--> statement-breakpoint
ALTER TABLE `appointments` ADD `filament_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `appointments` ADD `filament_material` varchar(40);--> statement-breakpoint
ALTER TABLE `appointments` ADD `filament_color` varchar(80);--> statement-breakpoint
ALTER TABLE `appointments` ADD `user_note` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `admin_note` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `verification_token_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `appointments` ADD `email_verified_at` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `verification_expires_at` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `canceled_at` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `privacy_notice_version` varchar(30);--> statement-breakpoint
ALTER TABLE `appointments` ADD `privacy_notice_seen_at` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `rules_accepted_at` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `retention_exempt_until` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD `retention_exemption_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `appointments` ADD `updated_at` datetime;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_verification_token_uq` UNIQUE(`verification_token_hash`);--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_tracking_token_uq` UNIQUE(`track_token_hash`);--> statement-breakpoint
CREATE INDEX `appointment_files_appointment_idx` ON `appointment_files` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `appointment_files_deletion_idx` ON `appointment_files` (`scheduled_deletion_at`);--> statement-breakpoint
CREATE INDEX `appointment_history_appointment_idx` ON `appointment_status_histories` (`appointment_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `blackout_periods_time_idx` ON `blackout_periods` (`printer_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `appointments_availability_idx` ON `appointments` (`printer_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`status`);
