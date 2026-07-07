-- TapNow Agent 对话表（phpMyAdmin 兼容版 — 无外键，避免 #1005 errno 150）
-- 说明：外键失败通常因 user 表引擎/字段类型不一致；NestJS/Prisma 不依赖数据库外键也能正常运行
--
-- 用法：phpMyAdmin 左侧选中 tapnow → SQL → 粘贴执行

CREATE TABLE IF NOT EXISTS `agent_conversation` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `title` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `agent_conversation_user_id_updated_at_idx` (`user_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `agent_message` (
  `id` CHAR(36) NOT NULL,
  `conversation_id` CHAR(36) NOT NULL,
  `role` VARCHAR(20) NOT NULL COMMENT 'user | assistant | system',
  `content` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `agent_message_conversation_id_created_at_idx` (`conversation_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════
-- 可选：user 表已是 InnoDB 且 id 为 INT 时，再执行下面外键（失败可忽略）
-- ═══════════════════════════════════════════
-- ALTER TABLE `agent_conversation`
--   ADD CONSTRAINT `agent_conversation_user_id_fkey`
--   FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `agent_message`
--   ADD CONSTRAINT `agent_message_conversation_id_fkey`
--   FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
