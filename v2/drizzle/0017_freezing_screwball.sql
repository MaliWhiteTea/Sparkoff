ALTER TABLE `filaments` ADD `legacy_filament_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `operating_hours` ADD `legacy_operating_hour_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `printers` ADD `legacy_printer_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `filaments` ADD CONSTRAINT `filaments_legacy_id_uq` UNIQUE(`legacy_filament_id`);--> statement-breakpoint
ALTER TABLE `operating_hours` ADD CONSTRAINT `operating_hours_legacy_id_uq` UNIQUE(`legacy_operating_hour_id`);--> statement-breakpoint
ALTER TABLE `printers` ADD CONSTRAINT `printers_legacy_id_uq` UNIQUE(`legacy_printer_id`);