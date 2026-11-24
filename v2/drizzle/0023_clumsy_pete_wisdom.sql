ALTER TABLE `custom_roles` ADD `description` text;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD `created_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;