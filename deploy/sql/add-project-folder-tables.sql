-- TapNow 项目与文件夹表 + agent_conversation 扩展 project_id
-- phpMyAdmin 兼容：无外键，DATETIME 不带 (3)
--
-- 用法：phpMyAdmin 左侧选中 tapnow → SQL → 粘贴执行

CREATE TABLE IF NOT EXISTS `workspace_folder` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `parent_id` CHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workspace_folder_user_id_updated_at_idx` (`user_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `folder_id` CHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `thumbnail` VARCHAR(512) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `project_user_id_updated_at_idx` (`user_id`, `updated_at`),
  KEY `project_folder_id_idx` (`folder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 若 agent_conversation 已存在，仅追加 project_id 列（重复执行会报错，可忽略）
ALTER TABLE `agent_conversation`
  ADD COLUMN `project_id` CHAR(36) NULL AFTER `user_id`;

ALTER TABLE `agent_conversation`
  ADD KEY `agent_conversation_project_id_updated_at_idx` (`project_id`, `updated_at`);

ALTER TABLE `agent_conversation`
  ADD KEY `agent_conversation_user_id_project_id_idx` (`user_id`, `project_id`);
