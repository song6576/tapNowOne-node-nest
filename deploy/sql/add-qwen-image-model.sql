-- 增量：图片模型 qwen-image-2.0-pro（API slug 为带日期的快照 ID）
-- 执行前请确保 ai_model 表已存在（add-ai-model-table.sql）
-- 关联接口：GET /api/models

INSERT INTO `ai_model` (
  `id`, `slug`, `label`, `category`, `description`, `usage_hint`,
  `icon`, `tier`, `is_premium`, `is_coming_soon`, `node_types`, `sort_order`, `active`
) VALUES
(
  'a1000001-0000-4000-8000-000000000007',
  'qwen-image-2.0-pro-2026-04-22',
  'qwen-image-2.0-pro',
  'image',
  '通义万相图片生成/编辑满血版：高保真纹理、光影材质与多语言图内文字；支持文生图与指令编辑。',
  '对应百炼模型 ID qwen-image-2.0-pro-2026-04-22；列表展示为 qwen-image-2.0-pro。',
  'I', 'high', 1, 0, 'image', 10, 1
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
