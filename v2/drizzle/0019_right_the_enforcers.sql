ALTER TABLE `audit_logs` ADD `legacy_activity_log_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_legacy_id_uq` UNIQUE(`legacy_activity_log_id`);