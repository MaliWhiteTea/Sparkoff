ALTER TABLE `announcements` ADD `type` varchar(20) DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` ADD `placement` varchar(20) DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` ADD `is_published` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` ADD `starts_at` datetime;--> statement-breakpoint
ALTER TABLE `announcements` ADD `ends_at` datetime;