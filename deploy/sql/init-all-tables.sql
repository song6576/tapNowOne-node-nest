-- =============================================================================
-- TapNow 全库一键初始化（与 prisma/schema.prisma 一致）
--
-- 适用：全新 tapnow 数据库，一条命令建齐全部表
-- 警告：会 DROP 所有 TapNow 业务表，有数据请先备份
--
-- 命令行：
--   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tapnow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
--   mysql -u tapnow -p tapnow < deploy/sql/init-all-tables.sql
--
-- phpMyAdmin：左侧选中 tapnow 库 → SQL → 粘贴执行
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `agent_message`;
DROP TABLE IF EXISTS `agent_conversation`;
DROP TABLE IF EXISTS `taptv_favorite`;
DROP TABLE IF EXISTS `taptv_like`;
DROP TABLE IF EXISTS `user_follow`;
DROP TABLE IF EXISTS `taptv_work`;
DROP TABLE IF EXISTS `featured_banner`;
DROP TABLE IF EXISTS `project`;
DROP TABLE IF EXISTS `workspace_folder`;
DROP TABLE IF EXISTS `team_member`;
DROP TABLE IF EXISTS `team_invite_link`;
DROP TABLE IF EXISTS `team`;
DROP TABLE IF EXISTS `user`;

SET FOREIGN_KEY_CHECKS = 1;

-- ── 1. 用户 ──────────────────────────────────────────────────────────────────

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

-- ── 2. 团队 ──────────────────────────────────────────────────────────────────

CREATE TABLE `team` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `team_invite_link` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `team_member` (
  `id` CHAR(36) NOT NULL,
  `team_id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'member',
  `invite_link_id` CHAR(36) NULL,
  `quota_limit` INT NULL,
  `quota_used` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_member_pair` (`team_id`, `user_id`),
  KEY `idx_team_member_user` (`user_id`),
  KEY `idx_team_member_invite` (`invite_link_id`),
  CONSTRAINT `fk_team_member_team` FOREIGN KEY (`team_id`) REFERENCES `team` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_member_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_member_invite` FOREIGN KEY (`invite_link_id`) REFERENCES `team_invite_link` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. 工作空间 / 项目 / Agent 对话 ─────────────────────────────────────────

CREATE TABLE `workspace_folder` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `team_id` CHAR(36) NULL,
  `parent_id` CHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `workspace_folder_user_id_updated_at_idx` (`user_id`, `updated_at`),
  KEY `idx_workspace_folder_team_updated` (`team_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `project` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `team_id` CHAR(36) NULL,
  `folder_id` CHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `thumbnail` VARCHAR(512) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `project_user_id_updated_at_idx` (`user_id`, `updated_at`),
  KEY `idx_project_team_updated` (`team_id`, `updated_at`),
  KEY `project_folder_id_idx` (`folder_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `agent_conversation` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `project_id` CHAR(36) NULL,
  `title` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `agent_conversation_user_id_updated_at_idx` (`user_id`, `updated_at`),
  KEY `agent_conversation_project_id_updated_at_idx` (`project_id`, `updated_at`),
  KEY `agent_conversation_user_id_project_id_idx` (`user_id`, `project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `agent_message` (
  `id` CHAR(36) NOT NULL,
  `conversation_id` CHAR(36) NOT NULL,
  `role` VARCHAR(20) NOT NULL COMMENT 'user | assistant | system',
  `content` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `agent_message_conversation_id_created_at_idx` (`conversation_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. 首页精选 / TapTV 社区 ─────────────────────────────────────────────────

CREATE TABLE `featured_banner` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(255) NULL,
  `cover` VARCHAR(512) NOT NULL,
  `link` VARCHAR(512) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_featured_active_sort` (`active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `taptv_work` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NULL,
  `title` VARCHAR(255) NOT NULL,
  `author_name` VARCHAR(128) NOT NULL,
  `author_avatar` VARCHAR(16) NOT NULL,
  `cover` VARCHAR(512) NOT NULL,
  `video_url` VARCHAR(512) NOT NULL,
  `description` TEXT NULL,
  `producer` VARCHAR(255) NULL,
  `forks` INT NOT NULL DEFAULT 0,
  `likes` INT NOT NULL DEFAULT 0,
  `favorites` INT NOT NULL DEFAULT 0,
  `shares` INT NOT NULL DEFAULT 0,
  `tags` VARCHAR(512) NOT NULL DEFAULT '[]',
  `node_count` INT NOT NULL DEFAULT 0,
  `category` VARCHAR(32) NOT NULL,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `workflow_data` LONGTEXT NULL,
  `published_at` DATETIME(0) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_taptv_featured_published` (`featured`, `published_at`),
  KEY `idx_taptv_category_published` (`category`, `published_at`),
  KEY `idx_taptv_published` (`published_at`),
  KEY `idx_taptv_likes` (`likes`),
  CONSTRAINT `fk_taptv_work_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `taptv_like` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `work_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_taptv_like_user_work` (`user_id`, `work_id`),
  KEY `idx_taptv_like_work` (`work_id`),
  CONSTRAINT `fk_taptv_like_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_taptv_like_work` FOREIGN KEY (`work_id`) REFERENCES `taptv_work` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `taptv_favorite` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `work_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_taptv_fav_user_work` (`user_id`, `work_id`),
  KEY `idx_taptv_fav_work` (`work_id`),
  CONSTRAINT `fk_taptv_fav_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_taptv_fav_work` FOREIGN KEY (`work_id`) REFERENCES `taptv_work` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_follow` (
  `id` CHAR(36) NOT NULL,
  `follower_id` INT NOT NULL,
  `following_id` INT NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_follow_pair` (`follower_id`, `following_id`),
  KEY `idx_user_follow_following` (`following_id`),
  CONSTRAINT `fk_user_follow_follower` FOREIGN KEY (`follower_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_follow_following` FOREIGN KEY (`following_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 首次启动 Nest 服务时会自动 seed 精选轮播与 TapTV 示例数据（表为空时）
