-- TapNow user 表 — 一键初始化（与 prisma/schema.prisma 中 User 模型一致）
--
-- 适用：全新数据库，或确认 user 表无重要数据、可重建时
-- 警告：会 DROP 旧 user 表；若已有 team/taptv 等外键引用 user，请先备份
--
-- 命令行：
--   mysql -u tapnow -p tapnow < deploy/sql/init-user-table.sql
--
-- phpMyAdmin：左侧选中 tapnow 库 → SQL → 粘贴执行

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `user`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `iphone` INT NULL,
  `passWord` VARCHAR(255) NULL,
  `token` VARCHAR(255) NULL,
  `google_id` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(512) NULL,
  `banner_url` VARCHAR(512) NULL,
  `bio` VARCHAR(500) NULL,
  `social_link` VARCHAR(512) NULL,
  `country` VARCHAR(64) NULL,
  `city` VARCHAR(64) NULL,
  `profession` VARCHAR(128) NULL,
  `show_join_date` TINYINT(1) NOT NULL DEFAULT 1,
  `tapies_balance` INT NOT NULL DEFAULT 0,
  `active_team_id` CHAR(36) NULL,
  `createTime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_email_key` (`email`),
  UNIQUE KEY `user_google_id_key` (`google_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
