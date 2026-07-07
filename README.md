# TapNow Backend (NestJS)

Phase 4 用户系统 — NestJS + Prisma + MySQL，当前已实现 **邮箱注册/登录** 与 **Google OAuth**。

## 技术栈

| 组件 | 用途 |
|------|------|
| NestJS | API 框架、模块化、Guard/Strategy |
| Prisma | MySQL ORM，类型安全 |
| Passport + JWT | 会话 token |
| google-auth-library | 验证 Google ID Token |
| BullMQ + FFmpeg | Phase 2/4 任务队列与视频合成（后续接入） |

## 快速开始

### 1. 扩展 MySQL `user` 表

在 Navicat 中对 `test` 库执行：

```sql
-- 见 prisma/migrations/add_google_oauth.sql
ALTER TABLE `user`
  ADD COLUMN `google_id` VARCHAR(255) NULL UNIQUE,
  ADD COLUMN `name` VARCHAR(255) NULL,
  ADD COLUMN `avatar_url` VARCHAR(512) NULL;

ALTER TABLE `user` MODIFY COLUMN `passWord` VARCHAR(255) NULL;
```

> 若列已存在，跳过对应语句即可。

### 2. 配置 Google OAuth

1. 打开 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 创建 **OAuth 2.0 客户端 ID** → 类型选 **Web 应用**
3. **已授权的 JavaScript 来源**：`http://localhost:5173`
4. 复制 Client ID 到前后端 `.env`

### 3. 启动后端

```bash
cd backend-nest
cp .env.example .env
# 编辑 DATABASE_URL、JWT_SECRET、GOOGLE_CLIENT_ID

npm install
npx prisma generate
npm run start:dev
```

默认端口 `3000`，健康检查：`GET /api/health`

### 4. 启动前端并联调

```bash
cd frontend
cp .env.example .env
# VITE_USE_MOCK=false
# VITE_GOOGLE_CLIENT_ID=与后端相同

npm run dev
```

打开 http://localhost:5173/login ，勾选条款后点击 Google 登录。

## Auth API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 邮箱注册 `{ email, password, name? }` |
| POST | `/api/auth/login` | 邮箱登录 |
| POST | `/api/auth/google` | Google 登录 `{ credential }` — GIS 返回的 ID Token |
| GET | `/api/auth/me` | 当前用户（Bearer JWT） |

## 与旧 Python 后端的关系

- `backend/` — 原 FastAPI + SQLite，负责 AI 生成/Agent（Phase 2）
- `backend-nest/` — 新 NestJS 栈，负责用户系统；后续逐步迁移队列与 FFmpeg

Vite 代理：`/api` → NestJS `:3000`，`/static` → Python `:8000`（生成资源）

## 文档与数据库脚本

| 目录 | 说明 |
|------|------|
| [`docs/API.md`](docs/API.md) | 全部 HTTP 接口说明（路径、鉴权、请求/响应） |
| [`docs/SQL.md`](docs/SQL.md) | `deploy/sql/` 脚本说明、表字段、执行顺序 |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | 前端架构与 Mock 切换（前端在独立仓库） |
| [`docs/UPLOAD.md`](docs/UPLOAD.md) | 文件上传接口 |
| [`deploy/sql/`](deploy/sql/) | MySQL 迁移脚本（phpMyAdmin 手动执行） |
| [`deploy/nginx/`](deploy/nginx/) | Nginx 配置示例 |
| [`deploy/pm2.ecosystem.config.cjs`](deploy/pm2.ecosystem.config.cjs) | PM2 进程配置 |
