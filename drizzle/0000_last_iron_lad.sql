CREATE TABLE `job_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queryHash` varchar(64) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`cachedJobs` json NOT NULL,
	`fetchedAt` bigint NOT NULL,
	CONSTRAINT `job_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_cache_queryHash_unique` UNIQUE(`queryHash`)
);
--> statement-breakpoint
CREATE TABLE `job_watch_list` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companies` json NOT NULL,
	`mustTags` json NOT NULL,
	`relevantTags` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_watch_list_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tldr_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`cachedArticles` json NOT NULL,
	`fetchedAt` bigint NOT NULL,
	CONSTRAINT `tldr_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
