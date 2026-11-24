ALTER TABLE `filaments` MODIFY COLUMN `color` varchar(80);--> statement-breakpoint
ALTER TABLE `printers` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `printers` MODIFY COLUMN `status` varchar(24) NOT NULL DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE `filaments` ADD `brand` varchar(100);--> statement-breakpoint
ALTER TABLE `filaments` ADD `diameter_mm` decimal(4,2) DEFAULT '1.75' NOT NULL;--> statement-breakpoint
ALTER TABLE `filaments` ADD `spool_weight_grams` int;--> statement-breakpoint
ALTER TABLE `filaments` ADD `nozzle_temp_min` int;--> statement-breakpoint
ALTER TABLE `filaments` ADD `nozzle_temp_max` int;--> statement-breakpoint
ALTER TABLE `filaments` ADD `bed_temp_min` int;--> statement-breakpoint
ALTER TABLE `filaments` ADD `bed_temp_max` int;--> statement-breakpoint
ALTER TABLE `filaments` ADD `technical_notes` text;--> statement-breakpoint
ALTER TABLE `filaments` ADD `unavailable_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `filaments` ADD `sort_order` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `filaments` ADD `created_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `filaments` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `printers` ADD `code` varchar(20);--> statement-breakpoint
ALTER TABLE `printers` ADD `sort_order` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `printers` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `filaments` ADD CONSTRAINT `filaments_name_color_uq` UNIQUE(`name`,`color`);--> statement-breakpoint
ALTER TABLE `printers` ADD CONSTRAINT `printers_code_uq` UNIQUE(`code`);