-- TapNow user 表初始化（phpMyAdmin 用法见下方说明）
-- 数据库名请先在左侧选中 tapnow，再执行本 SQL

-- ═══════════════════════════════════════════
-- 方案 A：全新库、表里没有重要数据 → 直接建表
-- 在 phpMyAdmin 只执行下面这一段（从 DROP 到分号结束）
-- ═══════════════════════════════════════════

DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `iphone` INT NULL,
  `passWord` VARCHAR(255) NULL,
  `token` VARCHAR(255) NULL,
  `google_id` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(512) NULL,
  `createTime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_email_key` (`email`),
  UNIQUE KEY `user_google_id_key` (`google_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
