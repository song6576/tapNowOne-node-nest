-- HappyHorse 1.1 参考生视频模型（百炼 MaaS 异步接口）
INSERT INTO `ai_model` (
  `id`, `slug`, `provider`, `provider_model_id`, `label`, `category`,
  `description`, `usage_hint`, `icon`, `tier`, `is_premium`, `is_coming_soon`,
  `node_types`, `sort_order`, `active`
) VALUES (
  'a1000001-0000-4000-8000-00000000hh11',
  'happyhorse-1.1-r2v',
  'dashscope',
  'happyhorse-1.1-r2v',
  'HappyHorse 1.1 R2V',
  'video',
  '百炼参考生视频：支持多张参考图、可配置分辨率/宽高比/时长/水印。',
  '在 prompt 中用 [Image 1]、[Image 2] 引用上游图片；最多 9 张参考图。',
  'H',
  'high',
  1,
  0,
  'video',
  8,
  1
)
ON DUPLICATE KEY UPDATE
  `provider` = VALUES(`provider`),
  `provider_model_id` = VALUES(`provider_model_id`),
  `label` = VALUES(`label`),
  `description` = VALUES(`description`),
  `usage_hint` = VALUES(`usage_hint`),
  `sort_order` = VALUES(`sort_order`),
  `active` = 1;
