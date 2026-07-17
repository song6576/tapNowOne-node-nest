-- 为 ai_model 增加多供应商字段，并创建 generation_task
-- 可重复执行（列已存在时会跳过）
-- 用法：
--   cd /opt/tapnow/backend-nest
--   ./deploy/apply-sql.sh add-ark-models-and-tasks.sql

-- 1) provider
SET @sql := (
  SELECT IF(
    (
      SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ai_model'
        AND COLUMN_NAME = 'provider'
    ) = 0,
    'ALTER TABLE `ai_model` ADD COLUMN `provider` VARCHAR(32) NOT NULL DEFAULT ''dashscope'' COMMENT ''dashscope | ark'' AFTER `slug`',
    'SELECT ''skip provider'' AS msg'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) provider_model_id
SET @sql := (
  SELECT IF(
    (
      SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ai_model'
        AND COLUMN_NAME = 'provider_model_id'
    ) = 0,
    'ALTER TABLE `ai_model` ADD COLUMN `provider_model_id` VARCHAR(128) NULL COMMENT ''供应商实际模型/接入点 ID'' AFTER `provider`',
    'SELECT ''skip provider_model_id'' AS msg'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `ai_model`
SET `provider` = COALESCE(NULLIF(`provider`, ''), 'dashscope'),
    `provider_model_id` = COALESCE(NULLIF(`provider_model_id`, ''), `slug`)
WHERE `provider_model_id` IS NULL OR `provider_model_id` = '';

ALTER TABLE `ai_model`
  MODIFY COLUMN `provider_model_id` VARCHAR(128) NOT NULL COMMENT '供应商实际模型/接入点 ID';

INSERT INTO `ai_model` (
  `id`, `slug`, `provider`, `provider_model_id`, `label`, `category`,
  `description`, `usage_hint`, `icon`, `tier`, `is_premium`,
  `is_coming_soon`, `node_types`, `sort_order`, `active`
) VALUES
(
  'a2000001-0000-4000-8000-000000000001',
  'deepseek-v4-flash-260425', 'ark', 'deepseek-v4-flash-260425',
  'DeepSeek V4 Flash（方舟）', 'text',
  '火山方舟托管的快速推理模型，适合文案、分镜、结构化输出与代码任务。',
  NULL, 'D', 'medium', 0, 0, 'text', 30, 1
),
(
  'a2000001-0000-4000-8000-000000000002',
  'doubao-seedream-4-0-250828', 'ark', 'doubao-seedream-4-0-250828',
  'Doubao Seedream 4.0', 'image',
  '火山方舟图片生成与编辑模型，支持文生图和参考图生成。',
  '图片结果会自动保存到本地，避免临时链接过期。', 'A', 'high', 1, 0, 'image', 20, 1
),
(
  'a2000001-0000-4000-8000-000000000003',
  'doubao-seedance-2-0-mini-260615', 'ark', 'doubao-seedance-2-0-mini-260615',
  'Doubao Seedance 2.0 Mini', 'video',
  '火山方舟视频生成模型，支持文生视频与图片驱动视频。',
  '视频生成耗时较长，任务会在后台持续执行。', 'V', 'high', 1, 0, 'video', 20, 1
)
ON DUPLICATE KEY UPDATE
  `provider` = VALUES(`provider`),
  `provider_model_id` = VALUES(`provider_model_id`),
  `label` = VALUES(`label`),
  `category` = VALUES(`category`),
  `description` = VALUES(`description`),
  `usage_hint` = VALUES(`usage_hint`),
  `node_types` = VALUES(`node_types`),
  `active` = VALUES(`active`),
  `updated_at` = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS `generation_task` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `user_id` INT NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `node_type` VARCHAR(16) NULL,
  `provider` VARCHAR(32) NULL,
  `provider_task_id` VARCHAR(128) NULL,
  `state` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `progress` INT NOT NULL DEFAULT 0,
  `result_url` VARCHAR(1024) NULL,
  `error` TEXT NULL,
  `metadata` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  INDEX `idx_generation_task_user_created` (`user_id`, `created_at`),
  INDEX `idx_generation_task_state_expires` (`state`, `expires_at`),
  CONSTRAINT `fk_generation_task_user`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 生成与视频合成任务';
