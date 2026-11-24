ALTER TABLE `material_media` MODIFY COLUMN `path` varchar(512);--> statement-breakpoint
ALTER TABLE `material_media` MODIFY COLUMN `mime` varchar(100);--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `unit` varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `reason` varchar(500);--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `actor_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `categories` ADD `slug` varchar(140);--> statement-breakpoint
ALTER TABLE `categories` ADD `description` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `sort_order` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `created_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `loans` ADD `borrower_name_original` text;--> statement-breakpoint
ALTER TABLE `loans` ADD `issued_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `loans` ADD `closed_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `loans` ADD `item_type` varchar(30);--> statement-breakpoint
ALTER TABLE `loans` ADD `issued_at` datetime;--> statement-breakpoint
ALTER TABLE `loans` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `loans` ADD `closure_note` text;--> statement-breakpoint
ALTER TABLE `loans` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `code` varchar(50);--> statement-breakpoint
ALTER TABLE `locations` ADD `description` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `is_public` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `created_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `material_media` ADD `type` varchar(20) DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_media` ADD `external_url` varchar(2048);--> statement-breakpoint
ALTER TABLE `material_media` ADD `title` varchar(180);--> statement-breakpoint
ALTER TABLE `material_media` ADD `alt_text` varchar(180);--> statement-breakpoint
ALTER TABLE `material_media` ADD `is_cover` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `material_media` ADD `created_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `material_media` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `slug` varchar(200);--> statement-breakpoint
ALTER TABLE `materials` ADD `sku` varchar(100);--> statement-breakpoint
ALTER TABLE `materials` ADD `brand` varchar(120);--> statement-breakpoint
ALTER TABLE `materials` ADD `model` varchar(160);--> statement-breakpoint
ALTER TABLE `materials` ADD `minimum_stock` decimal(15,3);--> statement-breakpoint
ALTER TABLE `materials` ADD `public_visibility` varchar(20) DEFAULT 'status' NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `description` text;--> statement-breakpoint
ALTER TABLE `materials` ADD `technical_specs` json;--> statement-breakpoint
ALTER TABLE `materials` ADD `image_path` varchar(512);--> statement-breakpoint
ALTER TABLE `materials` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `archived_at` datetime;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `movement_type` varchar(30);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `reversed_movement_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `source_type` varchar(100);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `source_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_slug_uq` UNIQUE(`slug`);--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_code_uq` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_slug_uq` UNIQUE(`slug`);--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_sku_uq` UNIQUE(`sku`);--> statement-breakpoint
CREATE INDEX `media_material_sort_idx` ON `material_media` (`material_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `stock_material_time_idx` ON `stock_movements` (`material_id`,`created_at`);