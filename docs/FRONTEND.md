# TapNow 前端架构（1:1 复刻）

> Mock / 真实后端由 `VITE_USE_MOCK` 切换，统一入口 `services/api.ts`。  
> **接口说明：** [`docs/API.md`](API.md)  
> **数据库字段：** [`docs/SQL.md`](SQL.md)

## 页面地图

| 路由 | 页面 | TapNow 对应 |
|------|------|-------------|
| `/home` | HomePage | app.tapnow.ai/home |
| `/taptv` | TapTVPage | TapTV 社区列表 |
| `/taptv/:id` | TapTVDetailPage | TapTV 详情 / Fork |
| `/home/projects` | ProjectsPage | 项目管理 |
| `/canvas` | CanvasPage | 画布编辑器 |
| `/canvas/:id` | CanvasPage | 打开指定项目 |

## 目录结构

```
frontend/src/
├── mock/                  # 静态 Mock 数据 & 模拟 API
│   ├── data.ts            # 用户、项目、TapTV、任务历史
│   └── api.ts             # 模拟异步请求
├── services/
│   └── api.ts             # 统一入口（Mock ↔ 真实后端切换）
├── config.ts              # VITE_USE_MOCK 开关
├── layouts/
│   └── AppLayout.tsx      # Home/TapTV 共用侧边栏布局
├── pages/                 # 路由页面
├── components/
│   ├── shell/             # 应用壳组件
│   │   ├── AppSidebar.tsx     # 左侧全局导航
│   │   ├── TopBar.tsx         # 通用顶栏
│   │   ├── CanvasTopBar.tsx   # 画布顶栏（项目菜单）
│   │   ├── CanvasToolbar.tsx  # 画布左侧节点工具栏
│   │   ├── TaskBar.tsx        # 底部生成历史
│   │   ├── CanvasContextMenu.tsx
│   │   └── SettingsDrawer.tsx
│   ├── nodes/             # React Flow 节点
│   ├── FlowCanvas.tsx
│   ├── RightPanel.tsx     # Inspector + Agent 双 Tab
│   └── PropertyPanel.tsx
├── store/
│   └── canvasStore.ts     # 画布状态（Zustand）
└── types/
```

## 画布布局（TapNow 1:1）

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo▾ Project]  [name]              [Export][Save][⚡][⚙][👤] │  CanvasTopBar
├──┬─────────────────────────────────────────────────┬─────────┤
│T │                                                 │Inspector│
│o │              Infinite Canvas                    │ Agent   │  RightPanel
│o │                                                 │         │
│l │                                                 │         │
│b ├─────────────────────────────────────────────────┴─────────┤
│a │ [History] [task][task][task]...                           │  TaskBar
└──┴──────────────────────────────────────────────────────────┘
```

## Mock 模式

默认开启，无需启动后端：

```bash
cd frontend && npm run dev
# 打开 http://localhost:5173/home
```

关闭 Mock、接入后端：

```bash
# frontend/.env
VITE_USE_MOCK=false
```

然后启动 backend，Vite proxy 会转发 `/api` 请求。

## TapTV 卡片交互

| 行为 | 实现位置 | 数据字段 |
|------|----------|----------|
| 默认封面 | `components/taptv/TapTVCard.tsx` | `cover`（图片 URL 或渐变） |
| 悬浮播放 | 同上，`onMouseEnter/Leave` | `videoUrl` |
| 点赞点亮 | `onLike` → `toggleTapTVLike` | `likedByMe`、`likes` |
| 收藏点亮 | `onFavorite` → `toggleTapTVFavorite` | `favoritedByMe`、`favorites` |
| 我的收藏 | `pages/ProfilePage.tsx` | `GET /api/taptv/favorites` |

## 后续接入后端清单

| 功能 | Mock 位置 | 真实 API |
|------|-----------|----------|
| 用户登录 | 跳过 | `/api/auth/*` |
| 项目列表 | `mock/data.ts` | `/api/projects` |
| TapTV 列表/详情 | `mock/api.ts` | `GET /api/taptv` |
| TapTV 点赞/收藏 | `utils/taptvLocalState.ts` | `POST /api/taptv/:id/like|favorite` |
| TapTV 我的收藏 | `mock/api.ts` | `GET /api/taptv/favorites` |
| AI 生成 | `mock/api.ts` | `/api/generate` |
| Agent | `mock/api.ts` | `/api/agent/*` |
| 视频合成 | `mock/api.ts` | `/api/compose` |

只需修改 `services/api.ts`，页面组件无需改动。
