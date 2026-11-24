ALTER TABLE `categories` ADD `legacy_category_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `loans` ADD `legacy_loan_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `locations` ADD `legacy_location_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `material_media` ADD `legacy_media_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `materials` ADD `legacy_material_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `legacy_movement_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_legacy_id_uq` UNIQUE(`legacy_category_id`);--> statement-breakpoint
ALTER TABLE `loans` ADD CONSTRAINT `loans_legacy_id_uq` UNIQUE(`legacy_loan_id`);--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_legacy_id_uq` UNIQUE(`legacy_location_id`);--> statement-breakpoint
ALTER TABLE `material_media` ADD CONSTRAINT `material_media_legacy_id_uq` UNIQUE(`legacy_media_id`);--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_legacy_id_uq` UNIQUE(`legacy_material_id`);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_legacy_id_uq` UNIQUE(`legacy_movement_id`);