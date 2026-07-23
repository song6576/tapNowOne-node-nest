-- =============================================================================
-- 首页精选推荐：写入 3 条真实作品（都挺好 / 三秒水渍 / 呼保义）
-- 同时写入 featured_banner + taptv_work；旧 mock 精选下线
-- 幂等：固定 UUID，可重复执行
-- =============================================================================

-- 封面/视频签名 URL 较长，放宽字段
ALTER TABLE `featured_banner`
  MODIFY COLUMN `cover` VARCHAR(1024) NOT NULL COMMENT '封面：图片 URL 或 CSS 渐变',
  MODIFY COLUMN `subtitle` VARCHAR(512) NULL COMMENT '副标题/简介摘要';

ALTER TABLE `taptv_work`
  MODIFY COLUMN `cover` VARCHAR(1024) NOT NULL COMMENT '列表封面',
  MODIFY COLUMN `video_url` VARCHAR(1024) NOT NULL COMMENT '成片视频 URL';

-- 精选表增加 video_url（轮播可悬停播放；无则仅封面）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'featured_banner'
    AND COLUMN_NAME = 'video_url'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `featured_banner` ADD COLUMN `video_url` VARCHAR(1024) NULL COMMENT ''轮播悬停播放视频'' AFTER `cover`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 旧 mock 精选下线（保留记录，便于回滚）
UPDATE `featured_banner`
SET `active` = 0
WHERE `id` IN (
  '35e63feb-af8b-4635-906c-cb00db91fbc6',
  'c0b678f7-c5ba-4e97-970a-8e2596422586',
  '5febddb0-8dcf-4cf6-bf3e-8b40652b66f7',
  'c3b5545b-a595-430c-821c-5ce3e980eaea'
)
OR (
  `title` IN (
    'TapNow Launches ChatGPT Images 2.0',
    'Seedance 2.0 Now Live',
    'Introducing Agentic Canvas',
    'WORLD MODEL'
  )
  AND `cover` LIKE 'linear-gradient%'
);

-- -----------------------------------------------------------------------------
-- TapTV 作品（详情 / 探索 / 精选跳转目标）
-- -----------------------------------------------------------------------------
INSERT INTO `taptv_work` (
  `id`, `user_id`, `title`, `author_name`, `author_avatar`,
  `cover`, `video_url`, `description`, `producer`,
  `forks`, `likes`, `favorites`, `shares`, `tags`,
  `node_count`, `category`, `featured`, `workflow_data`, `published_at`
) VALUES
(
  't7a1d001-7e23-4c01-9a01-000000000001',
  NULL,
  '都挺好',
  '小林导',
  '小',
  'https://p11-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/d87d84335be14b208f908fdacbf23caf~tplv-tb4s082cfz-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=ISCSryozIVDdj%2BDTLjKIA4hVBy4%3D',
  'https://v9-artist.vlabvod.com/b23b51e89054540e779405dc9c75571c/6a6b2d32/video/tos/cn/tos-cn-v-148450/o0fH7nKCLBAF2pkQqIbDz1SbsBRgeqR2DHBcEh/?a=4066&ch=0&cr=0&dr=0&er=0&cd=0%7C0%7C0%7C0&br=2857&bt=2857&cs=0&ds=4&ft=5QYTUxhhe6BMyqWAs1eJD12Nzj&mime_type=video_mp4&qs=0&rc=NTxoZjs8Zjo8aThmODU6NEBpM3BmaHM5cmw6OzczNDM7M0BiXjBjM2BiXjQxMjBfLzYzYSM2b29kMmRrNWthLS1kNC9zcw%3D%3D&btag=80000e00038000&dy_q=1784803025&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20260723183704A1A30B019C5A2094D002',
  '以真实故事讲述青春与成长。告别校园、踏入职场，迷茫是每个人成长路上的必经阶段。故事里的少年，亦是现实中的你我。愿我们不惧坎坷、挣脱困顿，勇敢向前，在平凡生活里找到属于自己的热爱。',
  '个人首部AI短片',
  0, 0, 0, 0,
  '["动画","短片"]',
  12, 'animation', 1,
  '{"id":"workflow-t7a1d001-7e23-4c01-9a01-000000000001","name":"都挺好","createdAt":"2026-07-23T00:00:00.000Z","updatedAt":"2026-07-23T00:00:00.000Z","nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  '2026-07-23 12:00:00'
),
(
  't7a1d001-7e23-4c01-9a01-000000000002',
  NULL,
  '他只是停了三秒，却被剪成了证据｜《三秒水渍》',
  '创作者',
  '创',
  'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/d85cd328f99d4bc5aa93aa5108ac635f~tplv-tb4s082cfz-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=VOQpd2Dykm7r4tyb79pO%2FkxFXj8%3D',
  'https://v9-artist.vlabvod.com/3d91968e84e6f9eb7af61d74b4290bfb/6a6b2a18/video/tos/cn/tos-cn-v-148450/oM4AEZDZFBGmGQZ7BB7YSBeH02AIENRfgqU4RE/?a=4066&ch=0&cr=0&dr=0&er=0&cd=0%7C0%7C0%7C0&br=2664&bt=2664&cs=0&ds=4&ft=5QYTUxhhe6BMyqWAs1eJD12Nzj&mime_type=video_mp4&qs=0&rc=NWc5ZGczNzU3NGQ7ZGQ8ZkBpMzk0OnU5cjxuOzczNDM7M0A0MC8tYWMtNWExLTQvNDNeYSNgcC1hMmRrL2BhLS1kNGFzcw%3D%3D&btag=80000e00028000&dy_q=1784803025&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20260723183704A1A30B019C5A2094D002',
  '《三秒水渍》以一个微小到几乎不构成事件的瞬间为起点：一名普通通勤者在便利店失手打翻水瓶，低头停顿三秒后默默捡起、擦净并离开。现实中的事件很快结束，但监控只留下那段停顿。被上传到网络后，它脱离完整语境，成为可反复播放、剪切和解释的片段。不同观看者把自己的立场投射其上，水渍被说成证据，沉默被读成态度，三秒被放大成公共审判与社会热点。随着影像在屏幕、冷柜、试管和档案机器中被复制、归类，完整的主角逐渐被一帧画面取代。结尾，主角看向隐藏的偷窥视角，短暂反看观看者，却无法停止循环；眨眼之后，一切重新开始。',
  NULL,
  0, 0, 0, 0,
  '["短片","社会"]',
  10, 'animation', 1,
  '{"id":"workflow-t7a1d001-7e23-4c01-9a01-000000000002","name":"三秒水渍","createdAt":"2026-07-23T00:00:00.000Z","updatedAt":"2026-07-23T00:00:00.000Z","nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  '2026-07-23 12:10:00'
),
(
  't7a1d001-7e23-4c01-9a01-000000000003',
  NULL,
  '宋江歌曲《呼保义》',
  '创作者',
  '创',
  'https://p3-heycan-hgt-sign.byteimg.com/tos-cn-i-3jr8j4ixpe/19c627c22095415bb6e0625a42b1197b~tplv-3jr8j4ixpe-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=Sf841KKf9MwSRc%2BSxdBC2rttoEc%3D',
  'https://v9-artist.vlabvod.com/9678bacf662636fb2f50655da350d038/6a6b2a20/video/tos/cn/tos-cn-v-148450/o4EDpGRfd1AqHBFH9CRAII3SEINjazQIKgfFBp/?a=4066&ch=0&cr=0&dr=0&er=0&cd=0%7C0%7C0%7C0&br=3185&bt=3185&cs=0&ds=4&ft=5QYTUxhhe6BMyqWAs1eJD12Nzj&mime_type=video_mp4&qs=0&rc=ZDk3ODZlMzo2ZGhpO2VoaUBpam1ubHk5cmpkNzczNDM7M0A1XjUuL2AyNmMxX2I2LTEvYSMvZWowMmQ0NWFhLS1kNGFzcw%3D%3D&btag=80000e00028000&dy_q=1784803025&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20260723183704A1A30B019C5A2094D002',
  '水墨染忠义 招安碎江湖 及时雨藏半阙月光 梁山梦断蓼儿洼。',
  NULL,
  0, 0, 0, 0,
  '["MV","水墨"]',
  8, 'mv', 1,
  '{"id":"workflow-t7a1d001-7e23-4c01-9a01-000000000003","name":"呼保义","createdAt":"2026-07-23T00:00:00.000Z","updatedAt":"2026-07-23T00:00:00.000Z","nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
  '2026-07-23 12:20:00'
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
  `published_at` = VALUES(`published_at`);

-- -----------------------------------------------------------------------------
-- 首页精选轮播
-- -----------------------------------------------------------------------------
INSERT INTO `featured_banner` (
  `id`, `title`, `subtitle`, `cover`, `video_url`, `link`, `sort_order`, `active`
) VALUES
(
  'f7a1d001-7e23-4c01-9a01-000000000001',
  '都挺好',
  '以真实故事讲述青春与成长。告别校园、踏入职场，迷茫是每个人成长路上的必经阶段。故事里的少年，亦是现实中的你我。愿我们不惧坎坷、挣脱困顿，勇敢向前，在平凡生活里找到属于自己的热爱。',
  'https://p11-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/d87d84335be14b208f908fdacbf23caf~tplv-tb4s082cfz-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=ISCSryozIVDdj%2BDTLjKIA4hVBy4%3D',
  'https://v9-artist.vlabvod.com/b23b51e89054540e779405dc9c75571c/6a6b2d32/video/tos/cn/tos-cn-v-148450/o0fH7nKCLBAF2pkQqIbDz1SbsBRgeqR2DHBcEh/?a=4066&ch=0&cr=0&dr=0&er=0&cd=0%7C0%7C0%7C0&br=2857&bt=2857&cs=0&ds=4&ft=5QYTUxhhe6BMyqWAs1eJD12Nzj&mime_type=video_mp4&qs=0&rc=NTxoZjs8Zjo8aThmODU6NEBpM3BmaHM5cmw6OzczNDM7M0BiXjBjM2BiXjQxMjBfLzYzYSM2b29kMmRrNWthLS1kNC9zcw%3D%3D&btag=80000e00038000&dy_q=1784803025&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20260723183704A1A30B019C5A2094D002',
  '/taptv/t7a1d001-7e23-4c01-9a01-000000000001',
  0,
  1
),
(
  'f7a1d001-7e23-4c01-9a01-000000000002',
  '他只是停了三秒，却被剪成了证据｜《三秒水渍》',
  '《三秒水渍》以一个微小到几乎不构成事件的瞬间为起点：一名普通通勤者在便利店失手打翻水瓶，低头停顿三秒后默默捡起、擦净并离开。现实中的事件很快结束，但监控只留下那段停顿。被上传到网络后，它脱离完整语境，成为可反复播放、剪切和解释的片段。不同观看者把自己的立场投射其上，水渍被说成证据，沉默被读成态度，三秒被放大成公共审判与社会热点。随着影像在屏幕、冷柜、试管和档案机器中被复制、归类，完整的主角逐渐被一帧画面取代。结尾，主角看向隐藏的偷窥视角，短暂反看观看者，却无法停止循环；眨眼之后，一切重新开始。',
  'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/d85cd328f99d4bc5aa93aa5108ac635f~tplv-tb4s082cfz-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=VOQpd2Dykm7r4tyb79pO%2FkxFXj8%3D',
  'https://v9-artist.vlabvod.com/3d91968e84e6f9eb7af61d74b4290bfb/6a6b2a18/video/tos/cn/tos-cn-v-148450/oM4AEZDZFBGmGQZ7BB7YSBeH02AIENRfgqU4RE/?a=4066&ch=0&cr=0&dr=0&er=0&cd=0%7C0%7C0%7C0&br=2664&bt=2664&cs=0&ds=4&ft=5QYTUxhhe6BMyqWAs1eJD12Nzj&mime_type=video_mp4&qs=0&rc=NWc5ZGczNzU3NGQ7ZGQ8ZkBpMzk0OnU5cjxuOzczNDM7M0A0MC8tYWMtNWExLTQvNDNeYSNgcC1hMmRrL2BhLS1kNGFzcw%3D%3D&btag=80000e00028000&dy_q=1784803025&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20260723183704A1A30B019C5A2094D002',
  '/taptv/t7a1d001-7e23-4c01-9a01-000000000002',
  1,
  1
),
(
  'f7a1d001-7e23-4c01-9a01-000000000003',
  '宋江歌曲《呼保义》',
  '水墨染忠义 招安碎江湖 及时雨藏半阙月光 梁山梦断蓼儿洼。',
  'https://p3-heycan-hgt-sign.byteimg.com/tos-cn-i-3jr8j4ixpe/19c627c22095415bb6e0625a42b1197b~tplv-3jr8j4ixpe-aigc_resize_loss:720:720.webp?lk3s=4fa96020&x-expires=1787184000&x-signature=Sf841KKf9MwSRc%2BSxdBC2rttoEc%3D',
  'https://v9-artist.vlabvod.com/9678bacf662636fb2f50655da350d038/6a6b2a20/video/tos/cn/tos-cn-v-148450/o4EDpGRfd1AqHBFH9CRAII3SEINjazQIKgfFBp/?a=4066&ch=0&cr=0&dr=0&er=0&cd=0%7C0%7C0%7C0&br=3185&bt=3185&cs=0&ds=4&ft=5QYTUxhhe6BMyqWAs1eJD12Nzj&mime_type=video_mp4&qs=0&rc=ZDk3ODZlMzo2ZGhpO2VoaUBpam1ubHk5cmpkNzczNDM7M0A1XjUuL2AyNmMxX2I2LTEvYSMvZWowMmQ0NWFhLS1kNGFzcw%3D%3D&btag=80000e00028000&dy_q=1784803025&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20260723183704A1A30B019C5A2094D002',
  '/taptv/t7a1d001-7e23-4c01-9a01-000000000003',
  2,
  1
)
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `subtitle` = VALUES(`subtitle`),
  `cover` = VALUES(`cover`),
  `video_url` = VALUES(`video_url`),
  `link` = VALUES(`link`),
  `sort_order` = VALUES(`sort_order`),
  `active` = 1;
