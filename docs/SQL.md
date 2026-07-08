# TapNow 数据库 SQL 脚本说明

本文档说明 `deploy/sql/` 目录下每个 SQL 文件的用途、执行顺序，以及各表/字段含义。  
适用环境：**MySQL 5.7+ / MariaDB**，通过 **phpMyAdmin** 或命令行执行。

---

## 一、执行顺序（新环境推荐）

### 方式 A：一条命令建全库（推荐）

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tapnow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u tapnow -p tapnow < deploy/sql/init-all-tables.sql
```

`init-all-tables.sql` 会创建业务表共 **13 张**，外加运维用的 `schema_migration`（记录已执行过的增量 SQL）：  
`user`、`team`、`team_invite_link`、`team_member`、`workspace_folder`、`project`、`agent_conversation`、`agent_message`、`featured_banner`、`taptv_work`、`taptv_like`、`taptv_favorite`、`user_follow`、`schema_migration`。

**线上升级（改表 / 新建表）** 见 [`DEPLOY-DB.md`](DEPLOY-DB.md)：只跑新的 `add-*.sql`，并用 `deploy/apply-sql.sh` 写入 `schema_migration`。  
已有线上库首次启用记录表：`./deploy/apply-sql.sh add-schema-migration-table.sql`。

### 方式 B：分步执行（旧库升级或只需部分表时）

| 顺序 | 文件 | 说明 |
|------|------|------|
| 1 | `init-user-table.sql` | 创建完整 user 表 |
| 2 | `add-agent-chat-tables.sql` | Agent 对话表 |
| 3 | `add-project-folder-tables.sql` | 项目、文件夹表 + Agent 关联项目 |
| 4 | `add-taptv-tables.sql` | TapTV 作品、点赞、收藏、关注 |
| 5 | `add-team-tables.sql` | 团队、成员、工作空间 `team_id` 隔离 |
| 6 | `add-team-invite-tables.sql` | 邀请链接、成员配额字段 |

> 方式 B 中 `init-user-table.sql` 已包含个人资料、`tapies_balance`、`active_team_id` 等字段，**无需**再执行 `alter-user-table.sql`、`add-user-profile-fields.sql`、`add-user-profile-text-fields.sql`，以及 `add-team-tables.sql` 里对 user 表的 ALTER 部分。

若 **user 表已存在** 且有数据，不要用 `init-user-table.sql` / `init-all-tables.sql` 的 DROP，改用 `fix-user-table-for-prisma.sql` 或 `alter-user-table.sql` 修补。

---

## 二、各 SQL 文件详解

### 1. `init-user-table.sql` — 用户表初始化

**何时用：** 全新数据库，或可以清空 `user` 表时。

**做什么：**
- 删除旧 `user` 表（`DROP TABLE IF EXISTS`）
- 创建 NestJS / Prisma 所需的用户表

**表：`user`（已包含个人资料、Tapies、团队字段，无需再跑 `alter-user-table` / `add-user-profile-*`）**

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | INT AUTO_INCREMENT | 用户主键，自增整数 |
| `email` | VARCHAR(255) UNIQUE | 登录邮箱，唯一 |
| `iphone` | INT NULL | 手机号（历史字段名，Prisma 映射为 `phone`） |
| `passWord` | VARCHAR(255) NULL | bcrypt 加密后的密码；Google 登录用户可为空 |
| `token` | VARCHAR(255) NULL | 预留 token 字段（当前 JWT 不存库） |
| `google_id` | VARCHAR(255) UNIQUE NULL | Google OAuth 用户 ID |
| `name` | VARCHAR(255) NULL | 显示昵称 |
| `avatar_url` | VARCHAR(512) NULL | 头像 URL |
| `banner_url` | VARCHAR(512) NULL | 个人主页背景图 |
| `bio` | VARCHAR(500) NULL | 个人简介 |
| `social_link` | VARCHAR(512) NULL | 社交链接 |
| `country` | VARCHAR(64) NULL | 国家 |
| `city` | VARCHAR(64) NULL | 城市 |
| `profession` | VARCHAR(128) NULL | 职业 |
| `show_join_date` | TINYINT(1) DEFAULT 1 | 是否展示加入日期 |
| `tapies_balance` | INT DEFAULT 0 | Tapies 余额 |
| `active_team_id` | CHAR(36) NULL | 当前激活团队 ID |
| `createTime` | TIMESTAMP | 注册时间，默认当前时间 |

**注意：** 列名 `passWord`、`createTime` 与 Prisma schema 中的 `@map` 一致，不要随意改成 `password`。

---

### 2. `alter-user-table.sql` — 增量补字段（旧表升级）

**何时用：** `user` 表已存在，但缺少 Google 登录或个人资料字段。

**做什么：** 逐条 `ALTER TABLE` 添加：
- `google_id` + 唯一索引
- `name`
- `avatar_url`
- 将 `passWord` 改为可 NULL

**注意：** 列已存在时会报错，跳过该条即可。

---

### 3. `fix-user-table-for-prisma.sql` — 修复表结构以匹配 Prisma

**何时用：** 注册报 500、字段类型/引擎不对、与 Prisma 不一致时。

**做什么：**
1. `SHOW CREATE TABLE user` 查看现状
2. 修正主键、email 唯一索引、各列类型
3. 引擎改为 **InnoDB**，字符集 **utf8mb4**

**注意：** 有重要数据时先备份；若表为空，直接跑 `init-user-table.sql` 更简单。

---

### 4. `add-agent-chat-tables.sql` — AI 对话历史

**何时用：** 启用 Agent 聊天持久化（百炼对话存 MySQL）。

**表：`agent_conversation`（会话）**

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | CHAR(36) | 会话 UUID，主键 |
| `user_id` | INT | 所属用户 ID |
| `title` | VARCHAR(255) NULL | 会话标题，通常取首条消息前 40 字 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 最后一条消息时间 |

**表：`agent_message`（消息）**

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | CHAR(36) | 消息 UUID |
| `conversation_id` | CHAR(36) | 所属会话 ID |
| `role` | VARCHAR(20) | 角色：`user` / `assistant` / `system` |
| `content` | TEXT | 消息正文 |
| `created_at` | DATETIME | 发送时间 |

**设计说明：**
- 脚本**不加外键**，避免 phpMyAdmin 报 `#1005 errno 150`
- NestJS 在应用层校验 `user_id` 归属
- 执行 `add-project-folder-tables.sql` 后，`agent_conversation` 会多一列 `project_id`（见下）

---

### 5. `add-project-folder-tables.sql` — 项目与文件夹

**何时用：** 云端保存画布项目、工作空间文件夹。

**表：`workspace_folder`**

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | CHAR(36) | 文件夹 UUID |
| `user_id` | INT | 所属用户 |
| `parent_id` | CHAR(36) NULL | 父文件夹 ID；NULL 表示根目录 |
| `name` | VARCHAR(255) | 文件夹名称 |
| `created_at` / `updated_at` | DATETIME | 创建 / 更新时间 |

**表：`project`**

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | CHAR(36) | **项目 ID**，前端路由 `/canvas/:projectId` 使用此值 |
| `user_id` | INT | 所属用户 |
| `folder_id` | CHAR(36) NULL | 所在文件夹；NULL 表示未归类 |
| `name` | VARCHAR(255) | 项目名称（画布标题栏可改） |
| `data` | LONGTEXT | **画布 JSON**：`nodes`、`edges`、`viewport` 等 |
| `thumbnail` | VARCHAR(512) NULL | 列表封面（URL 或 CSS gradient 字符串） |
| `created_at` / `updated_at` | DATETIME | 创建 / 更新时间 |

**对 `agent_conversation` 的扩展：**

| 新增字段 | 含义 |
|----------|------|
| `project_id` CHAR(36) NULL | 会话关联的项目；一个项目可有多条会话 |

**注意：** `ALTER TABLE ... ADD COLUMN project_id` 重复执行会报错，可忽略。

---

### 6. `add-user-profile-fields.sql` — 用户资料扩展

**何时用：** 支持个人中心背景图上传。

**做什么：** 为 `user` 表增加：

| 字段 | 类型 | 含义 |
|------|------|------|
| `banner_url` | VARCHAR(512) NULL | 个人主页背景图 URL |

头像仍使用已有字段 `avatar_url`。

### 6. `add-user-profile-text-fields.sql` — 个人简介与资料

**何时用：** 账户设置保存个人简介、社交链接、地区等到云端。

**新增字段（`user` 表）：**

| 字段 | 类型 | 含义 |
|------|------|------|
| `bio` | VARCHAR(500) | 个人简介 |
| `social_link` | VARCHAR(512) | 社交媒体链接 |
| `country` | VARCHAR(64) | 国家/地区 |
| `city` | VARCHAR(64) | 城市 |
| `profession` | VARCHAR(128) | 身份/职业 |
| `show_join_date` | TINYINT(1) | 是否显示入驻时间，默认 1 |

用户名使用已有字段 `name`；邮箱 `email` 不可通过接口修改。

---

### 7. `add-taptv-tables.sql` — TapTV 社区

**何时用：** 启用首页精选、TapTV 列表、点赞/收藏/关注、发布作品、个人主页「我的收藏」。

**完整接口说明：** 见 [`docs/API.md`](API.md) TapTV 章节。

#### 表 `featured_banner`（首页轮播）

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | CHAR(36) | 主键 UUID |
| `title` | VARCHAR(255) | 轮播主标题 |
| `subtitle` | VARCHAR(255) | 副标题 |
| `cover` | VARCHAR(512) | 封面图 URL 或 CSS 渐变 |
| `link` | VARCHAR(512) | 点击跳转路径 |
| `sort_order` | INT | 排序权重，越小越靠前 |
| `active` | TINYINT(1) | 是否上线展示 |

**接口：** `GET /api/home/featured`

#### 表 `taptv_work`（作品主表）

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | CHAR(36) | 作品 UUID |
| `user_id` | INT NULL | 发布者；关联 `user.id`，删除用户时置 NULL |
| `title` | VARCHAR(255) | 作品标题 |
| `author_name` | VARCHAR(128) | 作者展示名 |
| `author_avatar` | VARCHAR(16) | 作者头像占位字符 |
| `cover` | VARCHAR(512) | **列表默认封面**（发布时上传或项目缩略图） |
| `video_url` | VARCHAR(512) | **悬浮播放**用的成片视频地址 |
| `description` | TEXT | 详情简介 |
| `producer` | VARCHAR(255) | 出品方 |
| `forks` | INT | Fork 次数（冗余计数） |
| `likes` | INT | 点赞总数（与 `taptv_like` 同步） |
| `favorites` | INT | 收藏总数（与 `taptv_favorite` 同步） |
| `shares` | INT | 分享次数 |
| `tags` | VARCHAR(512) | JSON 数组字符串 |
| `node_count` | INT | 工作流节点数 |
| `category` | VARCHAR(32) | 分类 slug |
| `featured` | TINYINT(1) | 是否精选 |
| `workflow_data` | LONGTEXT | 画布 JSON，Fork / 查看工作流用 |
| `published_at` | DATETIME | 发布时间 |

#### 表 `taptv_like`（点赞记录）

| 字段 | 类型 | 含义 |
|------|------|------|
| `user_id` | INT | 点赞用户 |
| `work_id` | CHAR(36) | 被赞作品 |
| `created_at` | DATETIME | 点赞时间 |

**唯一约束：** `(user_id, work_id)` — 每人每件作品最多一条点赞记录。  
**接口：** `POST /api/taptv/:id/like` — 有记录则删除并 `likes-1`，无则插入并 `likes+1`。

#### 表 `taptv_favorite`（收藏记录）

| 字段 | 类型 | 含义 |
|------|------|------|
| `user_id` | INT | 收藏用户 |
| `work_id` | CHAR(36) | 被藏作品 |
| `created_at` | DATETIME | 收藏时间；**我的收藏按此倒序** |

**唯一约束：** `(user_id, work_id)`  
**接口：**
- `POST /api/taptv/:id/favorite` — 切换收藏
- `GET /api/taptv/favorites` — 当前用户收藏列表（需登录）

#### 表 `user_follow`（关注关系）

| 字段 | 类型 | 含义 |
|------|------|------|
| `follower_id` | INT | 粉丝（发起关注的人） |
| `following_id` | INT | 被关注者 |

**接口：** `POST /api/taptv/users/:userId/follow`；列表 `sort=following` 时按关注作者筛选。

#### 关联接口一览

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/home/featured` | 否 | 首页精选轮播 |
| GET | `/api/taptv` | 可选 | 作品列表 |
| GET | `/api/taptv/favorites` | **是** | 我的收藏（须在 `:id` 路由前注册） |
| GET | `/api/taptv/:id` | 可选 | 作品详情 |
| GET | `/api/taptv/:id/workflow` | 否 | 工作流 JSON |
| POST | `/api/taptv/publish` | **是** | 从画布发布作品 |
| POST | `/api/taptv/:id/like` | **是** | 切换点赞 |
| POST | `/api/taptv/:id/favorite` | **是** | 切换收藏 |
| POST | `/api/taptv/:id/share` | 否 | 分享 +1 |
| POST | `/api/taptv/:id/clone` | **是** | Fork 到工作空间 |
| POST | `/api/taptv/users/:userId/follow` | **是** | 关注/取关作者 |


---

### 8. `add-team-tables.sql` — 团队与工作空间隔离

**何时用：** 支持创建团队、切换团队、项目/文件夹按 `team_id` 隔离。

**主要表：** `team`、`team_member`  
**扩展字段：** `user.active_team_id`、`user.tapies_balance`；`project.team_id`、`workspace_folder.team_id`

- 个人空间：`team_id IS NULL`
- 团队空间：`team_id = 团队 UUID`，成员共享

---

### 9. `add-team-invite-tables.sql` — 团队邀请

**何时用：** 支持邀请链接加入团队、成员列表配额展示。

**新建表 `team_invite_link`：**

| 字段 | 含义 |
|------|------|
| `token` | 邀请链接短码 |
| `expires_at` | 过期时间（默认 7 天） |
| `unlimited_quota` | 通过链接加入是否无限 Tapies |
| `revoked_at` | 手动作废时间 |

**扩展 `team_member`：**

| 字段 | 含义 |
|------|------|
| `invite_link_id` | 通过哪条链接加入 |
| `quota_limit` | NULL = 无限 |
| `quota_used` | 已使用量 |

---

## 三、表关系概览

```
user (1) ──< workspace_folder
user (1) ──< project
user (1) ──< agent_conversation
user (1) ──< team_member ──> team
team (1) ──< team_invite_link
team (1) ──< project          [project.team_id]
team (1) ──< workspace_folder  [workspace_folder.team_id]
workspace_folder (1) ──< project          [project.folder_id]
workspace_folder (1) ──< workspace_folder [parent_id 嵌套]
project (1) ──< agent_conversation         [project_id]
agent_conversation (1) ──< agent_message
user (1) ──< taptv_work
user (1) ──< taptv_like ──> taptv_work
user (1) ──< taptv_favorite ──> taptv_work
user (1) ──< user_follow (follower / following)
```

画布节点**不单独建表**，全部存在 `project.data` 的 JSON 里。  
上传的图片/视频/音频 URL 写在节点 `data.outputUrl` 中。

### 表 `schema_migration`（运维用）

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | INT AUTO_INCREMENT | 主键 |
| `filename` | VARCHAR(255) UNIQUE | 已执行的 `deploy/sql/*.sql` 文件名 |
| `applied_at` | TIMESTAMP | 执行时间 |

Nest/Prisma **不读**此表；由 `deploy/apply-sql.sh` 维护，避免线上重复执行同一增量脚本。详见 [`DEPLOY-DB.md`](DEPLOY-DB.md)。

---

## 四、phpMyAdmin 操作提示

1. 左侧选中数据库（如 `tapnow`）
2. 点 **SQL** 标签，粘贴脚本
3. 若某条 `ALTER` 报「Duplicate column」，说明已执行过，跳过
4. 避免使用 `DATETIME(3)` 等 MySQL 8 专用精度，脚本已用 `DATETIME`
5. 外键可选块默认注释掉；不加外键不影响 NestJS 运行

---

## 五、与 Prisma 的对应

Prisma schema 路径：`backend-nest/prisma/schema.prisma`  
修改 schema 后本地执行：

```bash
cd backend-nest
npx prisma generate
```

生产/共享 MySQL 仍以 `deploy/sql/*.sql` 为准手动迁移，避免 `prisma migrate` 与 phpMyAdmin 环境不一致。  
详细升级步骤、备份、`apply-sql.sh` 用法见 [`DEPLOY-DB.md`](DEPLOY-DB.md)。

---

## 六、文档维护约定

以后**新增或修改**数据库字段、SQL 脚本、后端接口时，请同步更新：

| 步骤 | 文件 | 写什么 |
|------|------|--------|
| 1 | `deploy/sql/add-*.sql`（或 `alter-*.sql`） | 增量变更；表头写关联接口；字段加中文注释 |
| 2 | `deploy/sql/init-all-tables.sql` | 同步新表/新字段（仅供新环境一键初始化） |
| 3 | `docs/SQL.md` | 对应章节：表用途、字段表、何时执行 |
| 4 | `docs/DEPLOY-DB.md` | 若流程有变则补充 |
| 5 | `docs/API.md` | 路径、鉴权、请求/响应、业务逻辑 |
| 6 | `backend-nest/src/**` | Controller 路由注释 + Service 方法 JSDoc |
| 7 | `frontend/src/api/client.ts` | 函数 JSDoc（调哪个接口、返回什么） |
| 8 | `frontend/src/services/api.ts` | Mock/真实切换说明（若新增对外导出） |

Prisma `schema.prisma` 中对应 model 字段可加 `///` 注释，与 SQL 文档保持一致。  
服务器上用 `./deploy/apply-sql.sh 文件名.sql` 执行增量脚本并登记到 `schema_migration`。
