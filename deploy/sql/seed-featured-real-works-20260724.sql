-- =============================================================================
-- 首页精选推荐：末醒 / 飞向火星 / 这一瓶,大圣本圣
-- 幂等：复用现有 3 组固定 ID，可重复执行。
--
-- 视频地址集中在下面 3 个变量中，对应桶内 users/1/home 下的
-- 末醒.mp4、火星.mp4、大圣.mp4。
-- =============================================================================

SET @video_moxing :=
  'https://bucket-220430.huadong-1.ctyunzos.cn/users/1/home/%E6%9C%AB%E9%86%92.mp4';
SET @video_mars :=
  'https://bucket-220430.huadong-1.ctyunzos.cn/users/1/home/%E7%81%AB%E6%98%9F.mp4';
SET @video_dasheng :=
  'https://bucket-220430.huadong-1.ctyunzos.cn/users/1/home/%E5%A4%A7%E5%9C%A3.mp4';

ALTER TABLE `featured_banner`
  MODIFY COLUMN `subtitle` TEXT NULL COMMENT '副标题/完整简介',
  MODIFY COLUMN `cover` VARCHAR(1024) NOT NULL COMMENT '封面：图片 URL 或 CSS 渐变';

ALTER TABLE `taptv_work`
  MODIFY COLUMN `cover` VARCHAR(1024) NOT NULL COMMENT '列表封面',
  MODIFY COLUMN `video_url` VARCHAR(1024) NOT NULL COMMENT '成片视频 URL';

-- 兼容仅执行过早期 add-taptv-tables.sql、尚无 video_url 的数据库。
SET @featured_video_col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'featured_banner'
    AND COLUMN_NAME = 'video_url'
);
SET @add_featured_video_col_sql := IF(
  @featured_video_col_exists = 0,
  'ALTER TABLE `featured_banner` ADD COLUMN `video_url` VARCHAR(1024) NULL COMMENT ''轮播悬停播放视频'' AFTER `cover`',
  'SELECT 1'
);
PREPARE add_featured_video_col_stmt FROM @add_featured_video_col_sql;
EXECUTE add_featured_video_col_stmt;
DEALLOCATE PREPARE add_featured_video_col_stmt;

-- 只展示本次配置的 3 条首页精选。
UPDATE `featured_banner`
SET `active` = 0
WHERE `id` NOT IN (
  'f7a1d001-7e23-4c01-9a01-000000000001',
  'f7a1d001-7e23-4c01-9a01-000000000002',
  'f7a1d001-7e23-4c01-9a01-000000000003'
);

-- 旧精选作品不再参与 TapTV 的精选排序。
UPDATE `taptv_work`
SET `featured` = 0
WHERE `id` NOT IN (
  't7a1d001-7e23-4c01-9a01-000000000001',
  't7a1d001-7e23-4c01-9a01-000000000002',
  't7a1d001-7e23-4c01-9a01-000000000003'
);

INSERT INTO `taptv_work` (
  `id`, `user_id`, `title`, `author_name`, `author_avatar`,
  `cover`, `video_url`, `description`, `producer`,
  `forks`, `likes`, `favorites`, `shares`, `tags`,
  `node_count`, `category`, `featured`, `workflow_data`, `published_at`
) VALUES
(
  't7a1d001-7e23-4c01-9a01-000000000001',
  NULL,
  'AI科幻末日短片《末醒》',
  '创作者',
  '创',
  'https://p11-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/e6b4959ebbca4f449e533988f00c32f0~tplv-tb4s082cfz-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=B1lYt5B3DNk7WypTtMIrTH1uEIk%3D',
  @video_moxing,
  '科技改变未来，未来改变世界。
#抖音AI创作大赛 #命题末日',
  NULL,
  0, 0, 0, 0,
  '["AI短片","末日"]',
  0, 'animation', 1,
  '{"id":"workflow-t7a1d001-7e23-4c01-9a01-000000000001","name":"末醒","createdAt":"2026-07-24T00:00:00.000Z","updatedAt":"2026-07-24T00:00:00.000Z","nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  '2026-07-24 12:00:00'
),
(
  't7a1d001-7e23-4c01-9a01-000000000002',
  NULL,
  '《飞向火星》AI短片 | 生成式末日美学描绘人类未来的另一种可能性',
  '创作者',
  '创',
  'https://p3-heycan-hgt-sign.byteimg.com/tos-cn-i-3jr8j4ixpe/2dccdf5d27ab4a00872cf347df9b67b7~tplv-3jr8j4ixpe-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=CjU9A54%2FaREDCpeuh6gdUaHj7bM%3D',
  @video_mars,
  '本片讲述了人类在利用AI技术发展文明到一定阶段后，因自身贪婪的本性引发与AI之间的战争，最终，人类逃离地球，飞向火星，并企图再次利用AI技术延续文明的故事。
This film tells the story of humanity using AI technology to develop civilization to a certain stage, but due to their own greedy nature, they triggered a war with AI. In the end, humans fled Earth, flew to Mars, and attempted to continue civilization using AI technology once again.',
  NULL,
  0, 0, 0, 0,
  '["AI短片","末日"]',
  0, 'animation', 1,
  '{"id":"workflow-t7a1d001-7e23-4c01-9a01-000000000002","name":"飞向火星","createdAt":"2026-07-24T00:00:00.000Z","updatedAt":"2026-07-24T00:00:00.000Z","nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  '2026-07-24 12:10:00'
),
(
  't7a1d001-7e23-4c01-9a01-000000000003',
  NULL,
  '《这一瓶,大圣本圣》',
  '创作者',
  '创',
  'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/6db0e4a5c57a49c7a09693f6f66b9d1d~tplv-tb4s082cfz-aigc_resize:480:480.webp?lk3s=4fa96020&x-expires=1816410265&x-signature=WkVH0nqchaZaG9MWs8kN6OqOBGM%3D',
  @video_dasheng,
  '美术风格：纯水墨国潮动画

一句话简介：
一个幻想成为齐天大圣的小男孩，喝下爸爸带回的健力宝后，在劲爽气泡与电解质的双重激发下，展开了一段腾云驾雾、挥棒苍穹的英雄幻想。

创意内核：
作品以“每个孩子心中都有一个齐天大圣”为情感原点，将健力宝含气电解质的核心卖点——劲爽气泡与钾钠充能——转化为可视化的水墨特效语言。气泡化作金色祥云与力量符号，电解质化作体内金色闪电，共同触发从平凡孩童到齐天大圣的华丽变身。结尾以瓶盖内侧“一元乐享”的惊喜发现收束，将英雄幻想落回童年日常，完成“尽兴到底”的情感闭环。',
  NULL,
  0, 0, 0, 0,
  '["AI短片","水墨","广告"]',
  0, 'ad', 1,
  '{"id":"workflow-t7a1d001-7e23-4c01-9a01-000000000003","name":"这一瓶,大圣本圣","createdAt":"2026-07-24T00:00:00.000Z","updatedAt":"2026-07-24T00:00:00.000Z","nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  '2026-07-24 12:20:00'
)
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `author_name` = VALUES(`author_name`),
  `author_avatar` = VALUES(`author_avatar`),
  `cover` = VALUES(`cover`),
  `video_url` = VALUES(`video_url`),
  `description` = VALUES(`description`),
  `producer` = VALUES(`producer`),
  `tags` = VALUES(`tags`),
  `node_count` = VALUES(`node_count`),
  `category` = VALUES(`category`),
  `featured` = VALUES(`featured`),
  `workflow_data` = VALUES(`workflow_data`),
  `published_at` = VALUES(`published_at`);

INSERT INTO `featured_banner` (
  `id`, `title`, `subtitle`, `cover`, `video_url`, `link`, `sort_order`, `active`
) VALUES
(
  'f7a1d001-7e23-4c01-9a01-000000000001',
  'AI科幻末日短片《末醒》',
  '科技改变未来，未来改变世界。
#抖音AI创作大赛 #命题末日',
  'https://p11-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/e6b4959ebbca4f449e533988f00c32f0~tplv-tb4s082cfz-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=B1lYt5B3DNk7WypTtMIrTH1uEIk%3D',
  @video_moxing,
  '/taptv/t7a1d001-7e23-4c01-9a01-000000000001',
  0, 1
),
(
  'f7a1d001-7e23-4c01-9a01-000000000002',
  '《飞向火星》AI短片 | 生成式末日美学描绘人类未来的另一种可能性',
  '本片讲述了人类在利用AI技术发展文明到一定阶段后，因自身贪婪的本性引发与AI之间的战争，最终，人类逃离地球，飞向火星，并企图再次利用AI技术延续文明的故事。
This film tells the story of humanity using AI technology to develop civilization to a certain stage, but due to their own greedy nature, they triggered a war with AI. In the end, humans fled Earth, flew to Mars, and attempted to continue civilization using AI technology once again.',
  'https://p3-heycan-hgt-sign.byteimg.com/tos-cn-i-3jr8j4ixpe/2dccdf5d27ab4a00872cf347df9b67b7~tplv-3jr8j4ixpe-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=CjU9A54%2FaREDCpeuh6gdUaHj7bM%3D',
  NULLIF(@video_mars, ''),
  '/taptv/t7a1d001-7e23-4c01-9a01-000000000002',
  1, 1
),
(
  'f7a1d001-7e23-4c01-9a01-000000000003',
  '《这一瓶,大圣本圣》',
  '美术风格：纯水墨国潮动画

一句话简介：
一个幻想成为齐天大圣的小男孩，喝下爸爸带回的健力宝后，在劲爽气泡与电解质的双重激发下，展开了一段腾云驾雾、挥棒苍穹的英雄幻想。

创意内核：
作品以“每个孩子心中都有一个齐天大圣”为情感原点，将健力宝含气电解质的核心卖点——劲爽气泡与钾钠充能——转化为可视化的水墨特效语言。气泡化作金色祥云与力量符号，电解质化作体内金色闪电，共同触发从平凡孩童到齐天大圣的华丽变身。结尾以瓶盖内侧“一元乐享”的惊喜发现收束，将英雄幻想落回童年日常，完成“尽兴到底”的情感闭环。',
  'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/6db0e4a5c57a49c7a09693f6f66b9d1d~tplv-tb4s082cfz-aigc_resize:480:480.webp?lk3s=4fa96020&x-expires=1816410265&x-signature=WkVH0nqchaZaG9MWs8kN6OqOBGM%3D',
  @video_dasheng,
  '/taptv/t7a1d001-7e23-4c01-9a01-000000000003',
  2, 1
)
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `subtitle` = VALUES(`subtitle`),
  `cover` = VALUES(`cover`),
  `video_url` = VALUES(`video_url`),
  `link` = VALUES(`link`),
  `sort_order` = VALUES(`sort_order`),
  `active` = VALUES(`active`);
