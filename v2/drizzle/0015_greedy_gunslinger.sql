ALTER TABLE `feedbacks` ADD `legacy_feedback_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `feedbacks` ADD CONSTRAINT `feedbacks_legacy_id_uq` UNIQUE(`legacy_feedback_id`);