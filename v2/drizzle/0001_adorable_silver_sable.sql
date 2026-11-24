ALTER TABLE `units` ADD `is_general` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `chat_unit_cursor_idx` ON `chat_messages` (`unit_id`,`id`);--> statement-breakpoint
CREATE INDEX `memberships_unit_idx` ON `memberships` (`unit_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `stock_material_idx` ON `stock_movements` (`material_id`);--> statement-breakpoint
CREATE INDEX `tasks_unit_idx` ON `tasks` (`unit_id`);--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assignee_id`);