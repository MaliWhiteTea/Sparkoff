ALTER TABLE `blackout_periods` ADD `kind` varchar(20) DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE `blackout_periods` ADD `is_all_day` boolean DEFAULT false NOT NULL;