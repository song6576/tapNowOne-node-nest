-- =============================================================================
-- 画布素材收藏：个人主页「我的收藏」可展示画布里星标的视频/图片
-- 接口：GET/POST /api/media-favorites/*
-- =============================================================================
CREATE TABLE IF NOT EXISTS `user_media_favorite` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `media_url` VARCHAR(1024) NOT NULL,
  `media_url_hash` VARCHAR(64) NOT NULL,
  `media_type` VARCHAR(16) NOT NULL,
  `title` VARCHAR(255) NULL,
  `cover_url` VARCHAR(1024) NULL,
  `project_id` CHAR(36) NULL,
  `node_id` VARCHAR(64) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_media_favorite_user_hash` (`user_id`, `media_url_hash`),
  KEY `idx_user_media_favorite_user_created` (`user_id`, `created_at`),
  CONSTRAINT `fk_user_media_favorite_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
