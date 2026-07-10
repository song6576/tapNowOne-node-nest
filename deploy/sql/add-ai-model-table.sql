-- AI 模型目录表 + 种子数据
-- 用法：在 MySQL tapnow 库执行本脚本

CREATE TABLE IF NOT EXISTS `ai_model` (
  `id` CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID',
  `slug` VARCHAR(64) NOT NULL UNIQUE COMMENT '模型标识，如 qwen3.7-plus',
  `label` VARCHAR(128) NOT NULL COMMENT '展示名称',
  `category` VARCHAR(16) NOT NULL COMMENT 'text | video | audio',
  `description` TEXT NOT NULL COMMENT '悬浮说明：适用场景',
  `usage_hint` VARCHAR(512) NULL COMMENT '补充提示，如消耗说明',
  `icon` VARCHAR(8) NOT NULL DEFAULT '·' COMMENT '列表图标字符',
  `tier` VARCHAR(16) NULL COMMENT '档位：high | medium',
  `is_premium` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否付费/高消耗',
  `is_coming_soon` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '即将上线，不可选',
  `node_types` VARCHAR(128) NOT NULL COMMENT '适用节点，逗号分隔：text,image,video,audio',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ai_model_category` (`category`, `active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 模型目录';

INSERT INTO `ai_model` (
  `id`, `slug`, `label`, `category`, `description`, `usage_hint`,
  `icon`, `tier`, `is_premium`, `is_coming_soon`, `node_types`, `sort_order`, `active`
) VALUES
(
  'a1000001-0000-4000-8000-000000000001',
  'qwen3.7-plus',
  'Qwen 3.7 Plus',
  'text',
  '适合日常文案、脚本润色与多轮对话，响应快、中文表现稳定。',
  '推荐作为 Auto 默认文本模型。',
  'Q', 'high', 0, 0, 'text,image', 10, 1
),
(
  'a1000001-0000-4000-8000-000000000002',
  'deepseek-v4-flash',
  'DeepSeek V4 Flash',
  'text',
  '适合快速推理、代码辅助与结构化输出，性价比高。',
  NULL,
  'D', 'medium', 0, 0, 'text,image', 20, 1
),
(
  'a1000001-0000-4000-8000-000000000003',
  'happyhorse-1.0-video-edit',
  'HappyHorse 1.0 Video Edit',
  'video',
  '适合短视频片段生成、镜头拼接与画面风格统一。',
  '视频生成消耗较高，建议先预览再批量生成。',
  'H', 'high', 1, 0, 'video', 10, 1
),
(
  'a1000001-0000-4000-8000-000000000004',
  'sambert-zhide-v1',
  'Sambert Zhide V1',
  'audio',
  '适合中文旁白、解说配音与口播稿朗读。',
  NULL,
  'S', 'medium', 0, 0, 'audio', 10, 1
),
(
  'a1000001-0000-4000-8000-000000000005',
  'gpt-5.6',
  'GPT 5.6',
  'text',
  '适合复杂任务编排、多镜头视频规划与长剧情推理。',
  '使用该模型可能会产生较高消耗。',
  'G', 'high', 1, 1, 'text,image', 100, 1
),
(
  'a1000001-0000-4000-8000-000000000006',
  'gemini-3.1-pro',
  'Gemini 3.1 Pro',
  'text',
  '适合多模态理解、长文档分析与创意头脑风暴。',
  '即将开放，敬请期待。',
  '✦', 'high', 1, 1, 'text,image', 110, 1
)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `category` = VALUES(`category`),
  `description` = VALUES(`description`),
  `usage_hint` = VALUES(`usage_hint`),
  `icon` = VALUES(`icon`),
  `tier` = VALUES(`tier`),
  `is_premium` = VALUES(`is_premium`),
  `is_coming_soon` = VALUES(`is_coming_soon`),
  `node_types` = VALUES(`node_types`),
  `sort_order` = VALUES(`sort_order`),
  `active` = VALUES(`active`),
  `updated_at` = CURRENT_TIMESTAMP;
