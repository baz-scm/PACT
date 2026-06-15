ALTER TABLE `plan_versions` ADD COLUMN `model_id` text;
--> statement-breakpoint
ALTER TABLE `plan_versions` ADD COLUMN `input_tokens` integer;
--> statement-breakpoint
ALTER TABLE `plan_versions` ADD COLUMN `output_tokens` integer;
