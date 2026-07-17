-- AI 模型目录表 + 种子数据
-- 用法：在 MySQL tapnow 库执行本脚本

CREATE TABLE IF NOT EXISTS `ai_model` (
  `id` CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID',
  `slug` VARCHAR(64) NOT NULL UNIQUE COMMENT '模型标识，如 qwen3.7-plus',
  `provider` VARCHAR(32) NOT NULL DEFAULT 'dashscope' COMMENT 'dashscope | ark',
  `provider_model_id` VARCHAR(128) NOT NULL COMMENT '供应商实际模型/接入点 ID',
  `label` VARCHAR(128) NOT NULL COMMENT '展示名称',
  `category` VARCHAR(16) NOT NULL COMMENT 'text | image | video | audio',
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
  `id`, `slug`, `provider`, `provider_model_id`, `label`, `category`, `description`, `usage_hint`,
  `icon`, `tier`, `is_premium`, `is_coming_soon`, `node_types`, `sort_order`, `active`
) VALUES
(
  'a1000001-0000-4000-8000-000000000001',
  'qwen3.7-plus',
  'dashscope', 'qwen3.7-plus',
  'Qwen 3.7 Plus',
  'text',
  '适合日常文案、脚本润色与多轮对话，响应快、中文表现稳定。',
  '推荐作为 Auto 默认文本模型。',
  'Q', 'high', 0, 0, 'text,image', 10, 1
),
(
  'a1000001-0000-4000-8000-000000000002',
  'deepseek-v4-flash',
  'dashscope', 'deepseek-v4-flash',
  'DeepSeek V4 Flash',
  'text',
  '适合快速推理、代码辅助与结构化输出，性价比高。',
  NULL,
  'D', 'medium', 0, 0, 'text,image', 20, 1
),
(
  'a1000001-0000-4000-8000-000000000003',
  'happyhorse-1.0-video-edit',
  'dashscope', 'happyhorse-1.0-video-edit',
  'HappyHorse 1.0 Video Edit',
  'video',
  '适合短视频片段生成、镜头拼接与画面风格统一。',
  '视频生成消耗较高，建议先预览再批量生成。',
  'H', 'high', 1, 0, 'video', 10, 1
),
(
  'a1000001-0000-4000-8000-00000000hh11',
  'happyhorse-1.1-r2v',
  'dashscope', 'happyhorse-1.1-r2v',
  'HappyHorse 1.1 R2V',
  'video',
  '百炼参考生视频：支持多张参考图、可配置分辨率/宽高比/时长/水印。',
  '在 prompt 中用 [Image 1]、[Image 2] 引用上游图片；最多 9 张参考图。',
  'H', 'high', 1, 0, 'video', 8, 1
),
(
  'a1000001-0000-4000-8000-000000000004',
  'sambert-zhide-v1',
  'dashscope', 'sambert-zhide-v1',
  'Sambert Zhide V1',
  'audio',
  '适合中文旁白、解说配音与口播稿朗读。',
  NULL,
  'S', 'medium', 0, 0, 'audio', 10, 1
),
(
  'a1000001-0000-4000-8000-000000000005',
  'gpt-5.6',
  'dashscope', 'gpt-5.6',
  'GPT 5.6',
  'text',
  '适合复杂任务编排、多镜头视频规划与长剧情推理。',
  '使用该模型可能会产生较高消耗。',
  'G', 'high', 1, 1, 'text,image', 100, 1
),
(
  'a1000001-0000-4000-8000-000000000006',
  'gemini-3.1-pro',
  'dashscope', 'gemini-3.1-pro',
  'Gemini 3.1 Pro',
  'text',
  '适合多模态理解、长文档分析与创意头脑风暴。',
  '即将开放，敬请期待。',
  '✦', 'high', 1, 1, 'text,image', 110, 1
),
(
  'a1000001-0000-4000-8000-000000000007',
  'qwen-image-2.0-pro-2026-04-22',
  'dashscope', 'qwen-image-2.0-pro-2026-04-22',
  'qwen-image-2.0-pro',
  'image',
  '通义万相图片生成/编辑满血版：高保真纹理、光影材质与多语言图内文字；支持文生图与指令编辑。',
  '对应百炼模型 ID qwen-image-2.0-pro-2026-04-22；列表展示为 qwen-image-2.0-pro。',
  'I', 'high', 1, 0, 'image', 10, 1
),
(
  'a2000001-0000-4000-8000-000000000001',
  'deepseek-v4-flash-260425',
  'ark', 'deepseek-v4-flash-260425',
  'DeepSeek V4 Flash（方舟）',
  'text',
  '火山方舟托管的快速推理模型，适合文案、分镜和结构化输出。',
  NULL,
  'D', 'medium', 0, 0, 'text', 30, 1
),
(
  'a2000001-0000-4000-8000-000000000002',
  'doubao-seedream-4-0-250828',
  'ark', 'doubao-seedream-4-0-250828',
  'Doubao Seedream 4.0',
  'image',
  '火山方舟图片生成与编辑模型，支持文生图和参考图生成。',
  '图片结果会自动保存到本地，避免临时链接过期。',
  'A', 'high', 1, 0, 'image', 20, 1
),
(
  'a2000001-0000-4000-8000-000000000003',
  'doubao-seedance-2-0-mini-260615',
  'ark', 'doubao-seedance-2-0-mini-260615',
  'Doubao Seedance 2.0 Mini',
  'video',
  '火山方舟视频生成模型，支持文生视频与图片驱动视频。',
  '视频生成耗时较长，任务会在后台持续执行。',
  'V', 'high', 1, 0, 'video', 20, 1
)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `provider` = VALUES(`provider`),
  `provider_model_id` = VALUES(`provider_model_id`),
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
