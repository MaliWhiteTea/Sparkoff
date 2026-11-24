ALTER TABLE `custom_roles` ADD `is_protected` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD `legacy_role_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD `legacy_slug` varchar(120);--> statement-breakpoint
ALTER TABLE `custom_roles` ADD `legacy_permission_keys` json;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_legacy_role_uq` UNIQUE(`legacy_role_id`);--> statement-breakpoint
ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_legacy_slug_uq` UNIQUE(`legacy_slug`);