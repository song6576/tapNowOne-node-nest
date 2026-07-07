-- 团队与工作空间隔离
-- 执行前请确保 user / project / workspace_folder 表已存在

CREATE TABLE IF NOT EXISTS `team` (
  `id` CHAR(36) NOT NULL,
  `public_id` VARCHAR(32) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `owner_id` INT NOT NULL,
  `tapies_balance` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_public_id` (`public_id`),
  KEY `idx_team_owner` (`owner_id`),
  CONSTRAINT `fk_team_owner` FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `team_member` (
  `id` CHAR(36) NOT NULL,
  `team_id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'member',
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_member_pair` (`team_id`, `user_id`),
  KEY `idx_team_member_user` (`user_id`),
  CONSTRAINT `fk_team_member_team` FOREIGN KEY (`team_id`) REFERENCES `team` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_member_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `user`
  ADD COLUMN `tapies_balance` INT NOT NULL DEFAULT 0 AFTER `show_join_date`,
  ADD COLUMN `active_team_id` CHAR(36) NULL AFTER `tapies_balance`;

ALTER TABLE `workspace_folder`
  ADD COLUMN `team_id` CHAR(36) NULL AFTER `user_id`,
  ADD KEY `idx_workspace_folder_team_updated` (`team_id`, `updated_at`);

ALTER TABLE `project`
  ADD COLUMN `team_id` CHAR(36) NULL AFTER `user_id`,
  ADD KEY `idx_project_team_updated` (`team_id`, `updated_at`);

-- 已有数据默认为个人空间（team_id 为 NULL）
