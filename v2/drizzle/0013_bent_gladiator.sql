ALTER TABLE `users` ADD `legacy_user_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_legacy_user_uq` UNIQUE(`legacy_user_id`);