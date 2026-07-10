-- =============================================================================
-- 计费：订阅、礼包超市、充值流水、兑换码
-- 接口说明见 docs/API.md「计费 /api/billing」；字段说明见 docs/SQL.md
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- user_subscription：用户/团队当前订阅（个人 team_id=NULL，团队订阅填 team_id）
-- 接口：POST /api/billing/subscribe
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_subscription` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,                      -- 下单用户
  `team_id` CHAR(36) NULL,                   -- 团队订阅时填 team.id；个人为 NULL
  `plan_slug` VARCHAR(32) NOT NULL,          -- basic|pro|ultimate|max|enterprise|free
  `cycle` VARCHAR(16) NOT NULL,              -- monthly|yearly|enterprise
  `pro_tapies` INT NULL,                     -- PRO 档位每月 Tapies（滑块 3500/6000/…）
  `status` VARCHAR(16) NOT NULL DEFAULT 'active', -- active|cancelled
  `started_at` DATETIME(0) NOT NULL,
  `expires_at` DATETIME(0) NULL,             -- 订阅到期时间
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sub_user` (`user_id`),
  KEY `idx_sub_team` (`team_id`),
  CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_team` FOREIGN KEY (`team_id`) REFERENCES `team` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- gift_pack：礼包超市商品目录
-- 接口：GET /api/billing/gift-packs、POST /api/billing/gift-packs/:id/purchase
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gift_pack` (
  `id` CHAR(36) NOT NULL,
  `model_name` VARCHAR(64) NOT NULL,         -- 如 Seedance 2.0
  `tier` VARCHAR(32) NOT NULL,               -- 银卡|金卡|铂金卡
  `price_usd_cents` INT NOT NULL,            -- 标价（美分），如 100000 = $1000
  `tapies_amount` INT NOT NULL,              -- 到账 Tapies 数量
  `tapies_label` VARCHAR(128) NOT NULL,      -- 展示文案，如 140000 Seedance 2.0 Tapies
  `bg_gradient` VARCHAR(256) NOT NULL,       -- 卡片背景 CSS 渐变
  `stock_total` INT NOT NULL DEFAULT 100,
  `stock_remaining` INT NOT NULL DEFAULT 100,
  `sort_order` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gift_pack_active_sort` (`active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- redemption_code：兑换码（奖励中心）
-- 接口：POST /api/billing/rewards/redeem；临时生成 POST /api/billing/rewards/generate
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `redemption_code` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,              -- 唯一兑换码，如 TAP-XXXX-XXXX
  `activity_name` VARCHAR(255) NOT NULL,   -- 活动名称（兑换记录展示）
  `tapies_amount` INT NOT NULL,              -- 兑换获得的 Tapies
  `max_uses` INT NOT NULL DEFAULT 1,         -- 最大可用次数
  `used_count` INT NOT NULL DEFAULT 0,       -- 已使用次数
  `expires_at` DATETIME(0) NULL,             -- 过期时间，NULL=永不过期
  `created_by` INT NULL,                     -- 生成者 user_id（临时接口用）
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_redemption_code` (`code`),
  KEY `idx_redemption_expires` (`expires_at`),
  CONSTRAINT `fk_redemption_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- redemption_record：用户兑换历史
-- 接口：GET /api/billing/rewards/history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `redemption_record` (
  `id` CHAR(36) NOT NULL,
  `code_id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `team_id` CHAR(36) NULL,                   -- 兑换时充入的团队（NULL=个人余额）
  `code_display` VARCHAR(64) NOT NULL,       -- 脱敏展示用
  `activity_name` VARCHAR(255) NOT NULL,
  `tapies_amount` INT NOT NULL,
  `redeemed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_redeem_user_time` (`user_id`, `redeemed_at`),
  CONSTRAINT `fk_redeem_code` FOREIGN KEY (`code_id`) REFERENCES `redemption_code` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_redeem_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_redeem_team` FOREIGN KEY (`team_id`) REFERENCES `team` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- tapies_ledger：Tapies 流水（充值/订阅/兑换/礼包/消费）
-- 接口：GET /api/billing/transactions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tapies_ledger` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,                    -- 操作者
  `team_id` CHAR(36) NULL,                   -- 团队账户变动时填 team.id
  `type` VARCHAR(32) NOT NULL,               -- recharge|subscription|gift_pack|redeem|consume
  `amount` INT NOT NULL,                     -- 正=入账，负=扣费
  `balance_after` INT NOT NULL,                -- 变动后余额
  `description` VARCHAR(512) NOT NULL,
  `ref_type` VARCHAR(32) NULL,               -- 关联类型：order|code|gift_pack|subscription
  `ref_id` CHAR(36) NULL,
  `operator_email` VARCHAR(255) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_user_time` (`user_id`, `created_at`),
  KEY `idx_ledger_team_time` (`team_id`, `created_at`),
  CONSTRAINT `fk_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ledger_team` FOREIGN KEY (`team_id`) REFERENCES `team` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
