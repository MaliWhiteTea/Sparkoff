CREATE TABLE `request_limits` (
	`key` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`reset_at` datetime NOT NULL,
	CONSTRAINT `request_limits_key` PRIMARY KEY(`key`)
);
