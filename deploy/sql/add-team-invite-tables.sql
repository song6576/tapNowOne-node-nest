-- 团队邀请链接与成员配额
-- 执行前请确保 team / team_member 表已存在

CREATE TABLE IF NOT EXISTS `team_invite_link` (
  `id` CHAR(36) NOT NULL,
  `team_id` CHAR(36) NOT NULL,
  `token` VARCHAR(32) NOT NULL,
  `created_by` INT NOT NULL,
  `expires_at` DATETIME(0) NOT NULL,
  `max_uses` INT NULL,
  `use_count` INT NOT NULL DEFAULT 0,
  `unlimited_quota` TINYINT(1) NOT NULL DEFAULT 1,
  `revoked_at` DATETIME(0) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_invite_token` (`token`),
  KEY `idx_team_invite_team` (`team_id`),
  KEY `idx_team_invite_expires` (`expires_at`),
  CONSTRAINT `fk_team_invite_team` FOREIGN KEY (`team_id`) REFERENCES `team` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_invite_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `team_member`
  ADD COLUMN `invite_link_id` CHAR(36) NULL AFTER `role`,
  ADD COLUMN `quota_limit` INT NULL AFTER `invite_link_id`,
  ADD COLUMN `quota_used` INT NOT NULL DEFAULT 0 AFTER `quota_limit`,
  ADD KEY `idx_team_member_invite` (`invite_link_id`),
  ADD CONSTRAINT `fk_team_member_invite` FOREIGN KEY (`invite_link_id`) REFERENCES `team_invite_link` (`id`) ON DELETE SET NULL;
