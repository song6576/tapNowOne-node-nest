-- =============================================================================
-- TapTV 社区 & 首页精选推荐
-- 执行前请确保已存在 user 表
-- 详细字段说明见 docs/SQL.md 第 7 节；接口说明见 docs/API.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- featured_banner：首页顶部精选轮播
-- 接口：GET /api/home/featured
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `featured_banner` (
  `id` CHAR(36) NOT NULL,                    -- 主键 UUID
  `title` VARCHAR(255) NOT NULL,             -- 轮播主标题
  `subtitle` TEXT NULL,                      -- 完整简介（可选）
  `cover` VARCHAR(512) NOT NULL,             -- 封面：图片 URL 或 CSS linear-gradient(...)
  `link` VARCHAR(512) NULL,                  -- 点击跳转路径，如 /taptv
  `sort_order` INT NOT NULL DEFAULT 0,       -- 排序，越小越靠前
  `active` TINYINT(1) NOT NULL DEFAULT 1,    -- 1=展示 0=下线
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_featured_active_sort` (`active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- taptv_work：TapTV 社区作品主表
-- 列表默认展示 cover；鼠标悬浮播放 video_url
-- 接口：GET/POST /api/taptv/* 见 docs/API.md
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `taptv_work` (
  `id` CHAR(36) NOT NULL,                    -- 作品 UUID
  `user_id` INT NULL,                        -- 发布者 user.id；种子数据可为 NULL
  `title` VARCHAR(255) NOT NULL,             -- 作品标题
  `author_name` VARCHAR(128) NOT NULL,       -- 作者展示名（可与 user.name 不同）
  `author_avatar` VARCHAR(16) NOT NULL,      -- 作者头像占位字符（首字）
  `cover` VARCHAR(512) NOT NULL,           -- 列表封面：上传的图片 URL 或 CSS 渐变
  `video_url` VARCHAR(512) NOT NULL,       -- 成片视频 URL；卡片悬浮时播放
  `description` TEXT NULL,                   -- 详情页简介
  `producer` VARCHAR(255) NULL,              -- 出品方（可选）
  `forks` INT NOT NULL DEFAULT 0,            -- Fork 到画布的次数（冗余计数）
  `likes` INT NOT NULL DEFAULT 0,            -- 点赞总数（与 taptv_like 同步）
  `favorites` INT NOT NULL DEFAULT 0,        -- 收藏总数（与 taptv_favorite 同步）
  `shares` INT NOT NULL DEFAULT 0,           -- 分享次数
  `tags` VARCHAR(512) NOT NULL DEFAULT '[]', -- JSON 字符串数组，如 ["动画","广告"]
  `node_count` INT NOT NULL DEFAULT 0,       -- 工作流节点数量
  `category` VARCHAR(32) NOT NULL,         -- 分类：animation/ad/anime/...
  `featured` TINYINT(1) NOT NULL DEFAULT 0,  -- 1=精选作品（排序 featured 时优先）
  `workflow_data` LONGTEXT NULL,             -- 画布工作流 JSON（Fork 用）
  `published_at` DATETIME(0) NOT NULL,       -- 发布时间（列表排序）
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_taptv_featured_published` (`featured`, `published_at`),
  KEY `idx_taptv_category_published` (`category`, `published_at`),
  KEY `idx_taptv_published` (`published_at`),
  KEY `idx_taptv_likes` (`likes`),
  CONSTRAINT `fk_taptv_work_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- taptv_like：用户点赞记录（谁赞了哪件作品）
-- 唯一约束 (user_id, work_id) 防止重复点赞
-- 接口：POST /api/taptv/:id/like → 有则删（取消赞），无则插（点赞）
-- 同时更新 taptv_work.likes 冗余计数
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `taptv_like` (
  `id` CHAR(36) NOT NULL,                    -- 记录 UUID
  `user_id` INT NOT NULL,                    -- 点赞用户
  `work_id` CHAR(36) NOT NULL,               -- 被赞作品 taptv_work.id
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 点赞时间
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_taptv_like_user_work` (`user_id`, `work_id`),
  KEY `idx_taptv_like_work` (`work_id`),
  CONSTRAINT `fk_taptv_like_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_taptv_like_work` FOREIGN KEY (`work_id`) REFERENCES `taptv_work` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- taptv_favorite：用户收藏记录
-- 唯一约束 (user_id, work_id) 防止重复收藏
-- 接口：POST /api/taptv/:id/favorite → 切换收藏
-- 接口：GET /api/taptv/favorites → 个人主页「我的收藏」列表
-- 同时更新 taptv_work.favorites 冗余计数
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `taptv_favorite` (
  `id` CHAR(36) NOT NULL,                    -- 记录 UUID
  `user_id` INT NOT NULL,                    -- 收藏用户
  `work_id` CHAR(36) NOT NULL,               -- 被藏作品 taptv_work.id
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 收藏时间（我的收藏按此倒序）
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_taptv_fav_user_work` (`user_id`, `work_id`),
  KEY `idx_taptv_fav_work` (`work_id`),
  CONSTRAINT `fk_taptv_fav_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_taptv_fav_work` FOREIGN KEY (`work_id`) REFERENCES `taptv_work` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- user_follow：用户关注关系（follower 关注 following）
-- 接口：POST /api/taptv/users/:userId/follow
-- 用于 TapTV 列表 sort=following 筛选关注作者的作品
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_follow` (
  `id` CHAR(36) NOT NULL,
  `follower_id` INT NOT NULL,                -- 粉丝（谁点的关注）
  `following_id` INT NOT NULL,               -- 被关注者
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_follow_pair` (`follower_id`, `following_id`),
  KEY `idx_user_follow_following` (`following_id`),
  CONSTRAINT `fk_user_follow_follower` FOREIGN KEY (`follower_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_follow_following` FOREIGN KEY (`following_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 精选与 TapTV 数据通过增量 SQL 或管理接口写入，不在服务启动时自动生成。
