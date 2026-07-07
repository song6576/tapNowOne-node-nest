-- 修复 user 表以匹配 Prisma schema（注册 500 时优先执行）
-- phpMyAdmin：左侧选中 tapnow 库，逐段执行；报「已存在」可跳过

-- 查看当前表结构（先执行这条，确认列名是否为 passWord 而非 password）
SHOW CREATE TABLE `user`;

-- 若表是空的或可以重建，直接执行 init-user-table.sql 更简单

-- ── 修补现有表（有数据时用）──

ALTER TABLE `user` MODIFY `id` INT NOT NULL AUTO_INCREMENT;
ALTER TABLE `user` ADD PRIMARY KEY (`id`);

ALTER TABLE `user` MODIFY `email` VARCHAR(255) NOT NULL;
ALTER TABLE `user` ADD UNIQUE KEY `user_email_key` (`email`);

ALTER TABLE `user` MODIFY `passWord` VARCHAR(255) NULL;
ALTER TABLE `user` MODIFY `token` VARCHAR(255) NULL;
ALTER TABLE `user` MODIFY `google_id` VARCHAR(255) NULL;
ALTER TABLE `user` MODIFY `name` VARCHAR(255) NULL;
ALTER TABLE `user` MODIFY `avatar_url` VARCHAR(512) NULL;
ALTER TABLE `user` MODIFY `createTime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE `user` ADD UNIQUE KEY `user_google_id_key` (`google_id`);

ALTER TABLE `user` ENGINE=InnoDB;
ALTER TABLE `user` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
