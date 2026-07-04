-- Agent 对话历史表（无外键，兼容旧版 MySQL / 非标准 user 表）
-- 在 phpMyAdmin 选中 tapnow 库后执行

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
  `role` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `agent_message_conversation_id_created_at_idx` (`conversation_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
