# TapNow 接口说明

本文档描述后端 NestJS 提供的 HTTP 接口：**路径、鉴权、请求/响应字段、业务逻辑、对应数据表**。  
前端真实调用见 `frontend/src/api/client.ts`；组件层统一走 `frontend/src/services/api.ts`（可切换 Mock）。

> **约定：** 以后每新增字段、SQL 脚本或接口，须同步更新：
> 1. `deploy/sql/*.sql` 字段行尾注释  
> 2. `docs/SQL.md` 表/字段说明  
> 3. 本文件对应接口章节  
> 4. 后端 Controller / Service 方法注释  
> 5. 前端 `api/client.ts` JSDoc  

---

## 通用约定

| 项 | 说明 |
|----|------|
| 基础路径 | `/api`（Vite 开发环境由 proxy 转发到 Nest） |
| 鉴权 | 请求头 `Authorization: Bearer <JWT>` |
| 可选登录 | `OptionalJwtAuthGuard`：有 token 则解析用户，无 token 也可访问，用于列表附带 `liked_by_me` 等 |
| 必须登录 | `JwtAuthGuard`：未登录返回 401 |
| 字段命名 | 后端 JSON 使用 **snake_case**；前端 `mapTapTVItem` 转为 **camelCase** |

---

## TapTV 社区 `/api/taptv`

数据表见 `deploy/sql/add-taptv-tables.sql`，详解见 `docs/SQL.md` 第 7 节。

### 数据流关系

```
taptv_work（作品主表）
    ├── cover      → 列表卡片默认封面（图片 URL 或 CSS 渐变）
    ├── video_url  → 鼠标悬浮时播放的视频地址
    ├── likes      → 冗余计数，与 taptv_like 行数同步
    └── favorites  → 冗余计数，与 taptv_favorite 行数同步

taptv_like(user_id, work_id)     唯一 → 某用户是否点赞
taptv_favorite(user_id, work_id) 唯一 → 某用户是否收藏；个人主页「我的收藏」查此表
```

---

### GET `/api/home/featured`

首页精选轮播，无鉴权。

**响应示例：**

```json
[
  {
    "id": "uuid",
    "title": "TapNow Launches ChatGPT Images 2.0",
    "subtitle": "实现创意·更清晰·更流畅",
    "cover": "linear-gradient(...)",
    "link": "/taptv"
  }
]
```

**表：** `featured_banner`（`active=1` 按 `sort_order` 升序）

---

### GET `/api/models`

AI 模型目录，无鉴权。供首页与画布节点按类型选用。

**Query：**

| 参数 | 说明 |
|------|------|
| `category` | 可选：`text` / `image` / `video` / `audio` |
| `node_type` | 可选：`text` / `image` / `video` / `audio`，按 `node_types` 字段过滤 |

**响应示例：**

```json
{
  "models": [
    {
      "id": "uuid",
      "slug": "qwen3.7-plus",
      "label": "Qwen 3.7 Plus",
      "category": "text",
      "description": "适合日常文案、脚本润色与多轮对话…",
      "usage_hint": "推荐作为 Auto 默认文本模型。",
      "icon": "Q",
      "tier": "high",
      "is_premium": false,
      "is_coming_soon": false,
      "node_types": ["text", "image"],
      "sort_order": 10
    }
  ],
  "coming_soon": [],
  "by_category": { "text": [], "image": [], "video": [], "audio": [] },
  "default_slug": "qwen3.7-plus",
  "default_image_slug": "qwen-image-2.0-pro-2026-04-22"
}
```

**表：** `ai_model`（见 `deploy/sql/add-ai-model-table.sql`）

---

### GET `/api/home/dashboard`

首页聚合接口：一次返回精选轮播 + TapTV 预览（默认 8 条），减少前端往返。

可选登录（`Authorization: Bearer <jwt>`）：TapTV 预览含 `liked_by_me` / `favorited_by_me` / `following_author`。

**响应示例：**

```json
{
  "featured": [
    {
      "id": "uuid",
      "title": "TapNow Launches ChatGPT Images 2.0",
      "subtitle": "实现创意·更清晰·更流畅",
      "cover": "linear-gradient(...)",
      "link": "/taptv"
    }
  ],
  "taptv": [
    {
      "id": "uuid",
      "title": "作品标题",
      "cover": "https://...",
      "author": { "id": "1", "name": "作者", "avatar": "..." },
      "likes": 42,
      "liked_by_me": false
    }
  ]
}
```

**说明：** TapTV 预览等价于 `GET /api/taptv?sort=featured&limit=8`。独立接口 `/api/home/featured` 与 `/api/taptv` 仍保留兼容。

---

### GET `/api/taptv`

作品列表。可选登录（登录后每条带 `liked_by_me` / `favorited_by_me` / `following_author`）。

**Query 参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `sort` | string | `featured` | `featured` 精选优先 / `following` 关注作者 / `hot` 按点赞 / `latest` 按发布时间 |
| `category` | string | — | `animation` `ad` `anime` … 传 `all` 或不传表示全部 |
| `search` | string | — | 标题、作者名模糊搜索 |
| `limit` | number | 50 | 每页条数，最大 100 |
| `page` | number | 1 | 页码 |

**响应：** `TapTVItemMeta[]`（见下方「作品对象字段」）

**逻辑（`TaptvService.listWorks`）：**
- `sort=following` 必须登录，查 `user_follow` 得作者 id 列表再过滤 `taptv_work.user_id`
- `mapWorks` 批量查当前用户对这批作品的 like/favorite/follow 状态

---

### GET `/api/taptv/favorites`

**必须登录。** 当前用户收藏的作品列表，按收藏时间 `taptv_favorite.created_at` **倒序**。

**响应：** `TapTVItemMeta[]`，每条 `favorited_by_me` 恒为 `true`。

**逻辑（`TaptvService.listFavorites`）：**
1. `taptv_favorite` where `user_id = 当前用户`
2. `include: { work: true }` 关联作品
3. 走 `mapWorks` 映射为 API 格式

**前端使用：** 个人主页 →「我的收藏」Tab（`ProfilePage` → `listTapTVFavorites()`）

> **路由顺序：** 此路由必须写在 `GET :id` 之前，否则 `favorites` 会被当成作品 id。

---

### GET `/api/taptv/:id`

单条作品详情。可选登录。

**响应：** 单个 `TapTVItemMeta`；不存在 404。

---

### GET `/api/taptv/:id/workflow`

作品关联的画布工作流 JSON（用于「查看工作流」/ Fork）。无鉴权。

**响应：** `CanvasProject` 结构（nodes + edges）

---

### POST `/api/taptv/publish`

**必须登录。** 从画布项目发布到 TapTV。

**请求体：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 作品标题，1–80 字 |
| `projectId` | 是 | 画布项目 UUID |
| `videoUrl` | 是 | 成片视频 URL（列表悬浮播放用） |
| `coverUrl` | 否 | 封面图 URL；不传则用项目 `thumbnail` 或默认渐变 |
| `description` | 否 | 简介，最多 500 字 |
| `subtitleUrl` | 否 | 字幕文件 URL（预留） |
| `category` | 否 | 分类，默认 `creative` |

**响应：**

```json
{ "id": "新作品uuid", "title": "...", "message": "作品已提交审核" }
```

**逻辑（`TaptvService.publishWork`）：**
- 读取 `project.data` 作为 `workflow_data`
- `cover` ← `coverUrl` || `project.thumbnail` || 默认渐变
- `author_name` / `author_avatar` 从当前用户昵称首字生成
- 写入 `taptv_work`，`featured=false`

---

### POST `/api/taptv/:id/like`

**必须登录。** 切换点赞（已赞则取消）。

**响应：**

```json
{ "liked": true, "likes": 214 }
```

**逻辑（`TaptvService.toggleLike`）：**
- 有 `taptv_like` 记录 → 删除记录 + `taptv_work.likes -= 1`
- 无记录 → 插入 + `likes += 1`
- 事务保证计数与关联表一致

**前端：** 图标填充 + 琥珀色高亮（`liked_by_me` / `taptv-card-action--like-active`）

---

### POST `/api/taptv/:id/favorite`

**必须登录。** 切换收藏（已藏则取消）。

**响应：**

```json
{ "favorited": true, "favorites": 89 }
```

**逻辑（`TaptvService.toggleFavorite`）：** 同点赞，表为 `taptv_favorite`，字段 `favorites`。

**前端：**
- 列表/详情：收藏图标点亮
- 个人主页「我的收藏」：取消收藏后从列表移除

---

### POST `/api/taptv/:id/share`

记录分享次数 +1，无鉴权。

**响应：** `{ "shares": 46 }`

---

### POST `/api/taptv/:id/clone`

**必须登录。** Fork 工作流到当前用户新项目，`forks` +1。

**响应：** 新项目 `ProjectMeta`

---

### POST `/api/taptv/users/:userId/follow`

**必须登录。** 关注/取消关注作者。

**响应：** `{ "following": true }`

**表：** `user_follow`，`(follower_id, following_id)` 唯一

---

## 作品对象字段（`TapTVItemMeta`）

后端 → 前端映射见 `frontend/src/api/client.ts` 的 `mapTapTVItem`。

| API 字段 (snake_case) | 前端字段 (camelCase) | 含义 |
|----------------------|----------------------|------|
| `id` | `id` | 作品 UUID |
| `title` | `title` | 标题 |
| `author` | `author` | 作者显示名 |
| `author_avatar` | `authorAvatar` | 作者头像占位字 |
| `author_user_id` | `authorUserId` | 作者用户 id（可空，种子数据无绑定） |
| `cover` | `cover` | **列表默认封面**：图片 URL 或 `linear-gradient(...)` |
| `video_url` | `videoUrl` | **悬浮播放**用的视频地址 |
| `description` | `description` | 详情简介 |
| `producer` | `producer` | 出品方 |
| `forks` | `forks` | Fork 次数 |
| `likes` | `likes` | 点赞总数（冗余） |
| `favorites` | `favorites` | 收藏总数（冗余） |
| `shares` | `shares` | 分享次数 |
| `tags` | `tags` | 标签数组 |
| `node_count` | `nodeCount` | 工作流节点数 |
| `category` | `category` | 分类 slug |
| `published_at` | `publishedAt` | 发布时间 ISO 字符串 |
| `featured` | `featured` | 是否精选 |
| `liked_by_me` | `likedByMe` | 当前用户是否已点赞（未登录 false） |
| `favorited_by_me` | `favoritedByMe` | 当前用户是否已收藏 |
| `following_author` | `followingAuthor` | 当前用户是否已关注作者 |

---

## 前端：列表卡片悬浮播放

实现：`frontend/src/components/taptv/TapTVCard.tsx`

| 状态 | 展示 |
|------|------|
| 默认 | `cover`：URL 用 `<img>`，否则渐变 `<div>` |
| `mouseenter` | 显示 `<video src={videoUrl}>`，`muted loop playsInline`，从头播放 |
| `mouseleave` | `pause()` + `currentTime=0`，恢复封面 |

封面是否为图片：`frontend/src/utils/taptvCover.ts` → `isTapTVCoverImage(cover)`

---

## Mock 模式

`VITE_USE_MOCK=true`（默认）时：

| 真实接口 | Mock 实现 |
|----------|-----------|
| `POST .../like` | `mockToggleTapTVLike` + `localStorage` key `tapflow_taptv_likes` |
| `POST .../favorite` | `mockToggleTapTVFavorite` + key `tapflow_taptv_favorites` |
| `GET .../favorites` | 从 Mock 数据过滤 localStorage 中的收藏 id |

见 `frontend/src/utils/taptvLocalState.ts`、`frontend/src/mock/api.ts`。

---

## 计费 `/api/billing`

> 当前订阅 / 充值 / 礼包购买为**模拟支付**（登录后即时到账）。上线接 Stripe/支付宝时替换下单与 webhook 即可，接口路径可保持不变。  
> SQL：`deploy/sql/add-billing-tables.sql`

### GET `/api/billing/plans?cycle=monthly|yearly|enterprise`

订阅套餐目录。`enterprise` 时返回 Custom 企业版 + `partner_logos`（前端 Logo 跑马灯）。

### POST `/api/billing/subscribe`

订阅套餐。Body：`{ plan_slug, cycle, pro_tapies?, team_id? }`。PRO 需传 `pro_tapies`（如 6000）。企业版：`plan_slug=enterprise`。

### GET `/api/billing/gift-packs`

礼包超市列表。购买：`POST /api/billing/gift-packs/:id/purchase` Body `{ team_id? }`。

### POST `/api/billing/recharge`

充值 Tapies。Body：`{ tapies_amount, team_id? }`。汇率 `$1 = 100 Tapies`；订阅档位可叠加充值赠送。

### GET `/api/billing/team-benefits?team_id=`

团队权益：动态 `public_id`、当前订阅档、成员配额。前端「充值」→ 跳转账户充值页；「升级」→ 跳转订购套餐。

### 奖励中心

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/billing/rewards/redeem` | 兑换码兑换 `{ code, team_id? }` |
| GET | `/api/billing/rewards/history` | 兑换记录 |
| POST | `/api/billing/rewards/generate` | **临时**生成兑换码（`BILLING_ALLOW_GENERATE=false` 可关） |

### GET `/api/billing/transactions`

Tapies 交易流水（账单「交易记录」Tab）。

