CREATE TABLE `activation_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`role` varchar(24) NOT NULL DEFAULT 'member',
	`unit_id` bigint unsigned,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activation_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_devices` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`device_hash` varchar(64) NOT NULL,
	`last_seen_at` datetime NOT NULL,
	CONSTRAINT `activity_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`action` varchar(100) NOT NULL,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcement_reads` (
	`announcement_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`read_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `announcement_reads_announcement_id_user_id_pk` PRIMARY KEY(`announcement_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`audience` varchar(16) NOT NULL,
	`unit_id` bigint unsigned,
	`pinned` boolean NOT NULL DEFAULT false,
	`published_at` datetime,
	`expires_at` datetime,
	`created_by` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`printer_id` bigint unsigned,
	`name` varchar(200),
	`email` varchar(255),
	`starts_at` datetime,
	`ends_at` datetime,
	`status` varchar(24) NOT NULL DEFAULT 'pending',
	`model_path` varchar(512),
	`track_token_hash` varchar(64),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointments_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`actor_id` bigint unsigned,
	`action` varchar(100) NOT NULL,
	`entity` varchar(100) NOT NULL,
	`entity_id` bigint unsigned,
	`before` json,
	`after` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unit_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`reply_to_id` bigint unsigned,
	`attachment_path` varchar(512),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_pins` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`pinned_by` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_pins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_poll_votes` (
	`poll_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`option_index` int NOT NULL,
	CONSTRAINT `chat_poll_votes_poll_id_user_id_pk` PRIMARY KEY(`poll_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `chat_polls` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`message_id` bigint unsigned NOT NULL,
	`question` varchar(500) NOT NULL,
	`options` json NOT NULL,
	`closes_at` datetime,
	CONSTRAINT `chat_polls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_reads` (
	`user_id` bigint unsigned NOT NULL,
	`unit_id` bigint unsigned NOT NULL,
	`last_message_id` bigint unsigned NOT NULL,
	CONSTRAINT `chat_reads_user_id_unit_id_pk` PRIMARY KEY(`user_id`,`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `custom_roles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`tabs` json NOT NULL,
	`permissions` json NOT NULL,
	`room_ids` json NOT NULL,
	`general_access` boolean NOT NULL DEFAULT false,
	CONSTRAINT `custom_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`recipient` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`status` varchar(24) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_rsvps` (
	`event_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`status` varchar(24) NOT NULL,
	CONSTRAINT `event_rsvps_event_id_user_id_pk` PRIMARY KEY(`event_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`unit_id` bigint unsigned,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime,
	`created_by` bigint unsigned NOT NULL,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kind` varchar(24) NOT NULL,
	`message` text NOT NULL,
	`image_path` varchar(512),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `feedbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `filaments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`color` varchar(40),
	`available` boolean NOT NULL DEFAULT true,
	CONSTRAINT `filaments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`material_id` bigint unsigned NOT NULL,
	`borrower_first_name` varchar(120),
	`borrower_last_name` varchar(120),
	`borrower_email` varchar(255),
	`quantity` decimal(15,3) NOT NULL,
	`returned_quantity` decimal(15,3) NOT NULL DEFAULT '0',
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`due_at` datetime,
	`closed_at` datetime,
	`anonymized_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_media` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`material_id` bigint unsigned NOT NULL,
	`path` varchar(512) NOT NULL,
	`mime` varchar(100) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `material_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`kind` varchar(24) NOT NULL,
	`unit` varchar(24) NOT NULL,
	`category_id` bigint unsigned,
	`location_id` bigint unsigned,
	`quantity` decimal(15,3) NOT NULL DEFAULT '0',
	`is_public` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` bigint unsigned NOT NULL,
	`unit_id` bigint unsigned NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'member',
	`via_role` boolean NOT NULL DEFAULT false,
	CONSTRAINT `memberships_user_id_unit_id_pk` PRIMARY KEY(`user_id`,`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`read_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'available',
	`description` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `printers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`csrf_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stickers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`label` varchar(100) NOT NULL,
	`path` varchar(512) NOT NULL,
	CONSTRAINT `stickers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`material_id` bigint unsigned NOT NULL,
	`delta` decimal(15,3) NOT NULL,
	`balance_after` decimal(15,3) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`actor_id` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` varchar(120) NOT NULL,
	`value` json,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`task_id` bigint unsigned NOT NULL,
	`actor_id` bigint unsigned NOT NULL,
	`action` varchar(64) NOT NULL,
	`payload` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `task_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_proofs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`task_id` bigint unsigned NOT NULL,
	`step_id` bigint unsigned,
	`user_id` bigint unsigned NOT NULL,
	`kind` varchar(24) NOT NULL,
	`value` text NOT NULL,
	`captured_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `task_proofs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_steps` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`task_id` bigint unsigned NOT NULL,
	`title` varchar(200) NOT NULL,
	`kind` varchar(24) NOT NULL DEFAULT 'check',
	`sort_order` int NOT NULL DEFAULT 0,
	`completed_at` datetime,
	CONSTRAINT `task_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unit_id` bigint unsigned,
	`name` varchar(200) NOT NULL,
	`steps` json NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `task_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unit_id` bigint unsigned NOT NULL,
	`assignee_id` bigint unsigned,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`progress` int NOT NULL DEFAULT 0,
	`due_at` datetime,
	`created_by` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trusted_devices` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `trusted_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`parent_id` bigint unsigned,
	`name` varchar(120) NOT NULL,
	`is_room` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`global_role` varchar(24) NOT NULL DEFAULT 'member',
	`custom_role_id` bigint unsigned,
	`avatar_path` varchar(512),
	`preferences` json,
	`kvkk_version` varchar(32),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `web_push_subscriptions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `web_push_subscriptions_id` PRIMARY KEY(`id`)
);
