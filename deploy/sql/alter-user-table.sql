-- 方案 B：user 表已存在，只补 Google 相关字段
-- 在 phpMyAdmin 左侧选中数据库后，逐条执行（列已存在会报错，跳过即可）

ALTER TABLE `user` ADD COLUMN `google_id` VARCHAR(255) NULL;
ALTER TABLE `user` ADD UNIQUE KEY `user_google_id_key` (`google_id`);

ALTER TABLE `user` ADD COLUMN `name` VARCHAR(255) NULL;
ALTER TABLE `user` ADD COLUMN `avatar_url` VARCHAR(512) NULL;

ALTER TABLE `user` MODIFY COLUMN `passWord` VARCHAR(255) NULL;
