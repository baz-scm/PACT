ALTER TABLE `comments` ADD COLUMN `commenter_token` text;
ALTER TABLE `comments` ADD COLUMN `resolved` integer NOT NULL DEFAULT 0;
