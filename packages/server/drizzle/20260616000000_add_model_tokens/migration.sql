ALTER TABLE `plan_versions` ADD COLUMN `model_id` text;
ALTER TABLE `plan_versions` ADD COLUMN `input_tokens` integer;
ALTER TABLE `plan_versions` ADD COLUMN `output_tokens` integer;
