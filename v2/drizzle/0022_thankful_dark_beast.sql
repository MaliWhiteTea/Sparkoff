ALTER TABLE `appointment_files` ADD `legacy_appointment_file_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `appointment_status_histories` ADD `legacy_appointment_history_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `appointments` ADD `legacy_appointment_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `appointment_files` ADD CONSTRAINT `appointment_files_legacy_id_uq` UNIQUE(`legacy_appointment_file_id`);--> statement-breakpoint
ALTER TABLE `appointment_status_histories` ADD CONSTRAINT `appointment_history_legacy_id_uq` UNIQUE(`legacy_appointment_history_id`);--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_legacy_id_uq` UNIQUE(`legacy_appointment_id`);