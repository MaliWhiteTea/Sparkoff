CREATE TABLE `user_custom_roles` (
	`user_id` bigint unsigned NOT NULL,
	`role_id` bigint unsigned NOT NULL,
	CONSTRAINT `user_custom_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE INDEX `user_custom_roles_role_idx` ON `user_custom_roles` (`role_id`);
--> statement-breakpoint
INSERT INTO `user_custom_roles` (`user_id`, `role_id`)
SELECT u.`id`, u.`custom_role_id` FROM `users` u
INNER JOIN `custom_roles` r ON r.`id` = u.`custom_role_id`
WHERE u.`custom_role_id` IS NOT NULL;
