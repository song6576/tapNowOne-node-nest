# 前端数据架构

前端所有业务数据统一通过 `frontend/src/services/api.ts` 调用 NestJS API，不提供 Mock 模式或静态示例数据回退。

## 数据链路

```text
React 页面 / Zustand Store
  → frontend/src/services/api.ts
  → frontend/src/api/client.ts
  → /api/*
  → NestJS Service
  → Prisma
  → MySQL
```

精选推荐由以下表提供：

- `featured_banner`：首页精选轮播。
- `taptv_work`：精选点击后的作品详情、视频与工作流。

修改线上精选数据时执行版本化增量 SQL，不要在前端添加静态数组，也不要在 NestJS 启动阶段自动 seed：

```bash
cd backend-nest
./deploy/apply-sql.sh seed-featured-real-works-20260724.sql
```

未登录时，需要鉴权的数据接口应显示空态或跳转登录，不得降级到 localStorage 示例数据。
