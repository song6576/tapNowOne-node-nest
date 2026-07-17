# AI 平台 Key 与切换说明

本文说明百炼与火山方舟双 Provider 的配置、模型目录和路由方式。
相关代码：`src/ai/ai-router.service.ts`、`src/ai/ark.service.ts`、`src/agent/dashscope.service.ts`。

---

## 一、当前架构（一句话）

前端不持有模型 Key。前端只提交模型 slug，后端查询 `ai_model` 的 `provider/provider_model_id` 后路由。

```
前端 /api/agent、/api/generate
        ↓
 NestJS AiRouterService
        ↓
 DashScopeService 或 ArkService
```

---

## 二、只换百炼 Key（同一平台）

### 1. 改哪个文件

| 环境 | 文件 |
|------|------|
| 本地开发 | `backend-nest/.env` |
| 生产示例 | `backend-nest/.env.production.example` → 服务器真实 `.env` |

### 2. 改哪一项

```env
# 阿里云百炼控制台：https://bailian.console.aliyun.com/
DASHSCOPE_API_KEY=sk-你的新Key
```

可选：

```env
# 默认对话模型（Agent / 分镜）
DASHSCOPE_MODEL=qwen-plus

# 文生图 API 根路径（一般不用改）
# DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# 生图分辨率
# IMAGE_SIZE=1328*1328

# 强制不调真实 API（调试用）
# MOCK_MODE=true
```

### 3. 代码里谁在读

`src/agent/dashscope.service.ts`：

```ts
get apiKey(): string {
  return this.config.get<string>('DASHSCOPE_API_KEY', '') ?? '';
}
```

对话与生图请求头均为：

```http
Authorization: Bearer <DASHSCOPE_API_KEY>
```

### 4. 改完怎么生效

```bash
# 本地：停掉再启
cd backend-nest
npm run start:dev:proxy

# 生产（示例）
pm2 restart tapnow-api
# 或改完 .env 后：pm2 restart <进程名> --update-env
```

可用健康检查确认是否识别到 Key：

```bash
curl -s http://127.0.0.1:3000/api/health
# dashscope_configured: true 表示已配置 Key
# mock_mode: true 表示走 Mock（无 Key 或 MOCK_MODE=true）
```

> **安全：** `.env` 不要提交到 Git；只提交 `.env.example` / `.env.production.example`。

---

## 三、火山方舟配置

```env
ARK_API_KEY=ark-请使用控制台新建的Key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_RESOLUTION=720p
VIDEO_RATIO=16:9
```

已注册模型：

- `deepseek-v4-flash-260425`：文本
- `doubao-seedream-4-0-250828`：图片
- `doubao-seedance-2-0-mini-260615`：视频

`doubao-seedream-5-0-260128` 是图片模型，不应注册为文本模型。方舟图片和视频返回的临时 URL 会下载到 `/uploads/generated`。

豆包语音不复用 `ARK_API_KEY`，需要语音服务独立的 AppID 与 Access Token，本期未接入生成；上传的音频仍可进入 FFmpeg 合成。

数据库升级：

```bash
cd backend-nest
prisma db execute --file prisma/migrations/add_ark_models_and_tasks.sql --schema prisma/schema.prisma
prisma generate
```

健康检查返回：

```json
{
  "providers": { "dashscope": true, "ark": true },
  "ffmpeg_configured": true
}
```

---

## 四、换成其他平台（不能只改 Key）

百炼的 **URL、请求体、响应字段** 与其他平台不同。换平台时至少要改：

| 位置 | 改什么 |
|------|--------|
| `.env` | 新平台的 Key、Base URL、默认模型名 |
| `src/agent/dashscope.service.ts` | 请求地址、Header、Body、解析逻辑 |
| `deploy/sql/add-ai-model-table.sql` / `ai_model` 表 | 模型 `slug` 要与新平台模型 ID 一致 |
| 前端回退数据 `frontend/src/types/aiModel.ts` | 可选：与线上目录对齐 |

更干净的做法是抽 `LlmProvider` / `ImageProvider` 接口，百炼与 OpenAI 各实现一份；下面给一个**最小改动示例**（OpenAI 兼容接口）。

---

## 五、简单实例：换成 OpenAI 兼容接口

许多平台（OpenAI、部分国产网关、硅基流动等）提供与 OpenAI 类似的：

```http
POST {BASE}/v1/chat/completions
Authorization: Bearer <KEY>
```

### 1. `.env` 示例

```env
# 可继续沿用变量名，或改成 OPENAI_* 并在代码里读取
DASHSCOPE_API_KEY=sk-openai-or-other-key
DASHSCOPE_MODEL=gpt-4o-mini
# 若平台 Base 不同，在代码里用独立变量更清晰：
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 2. 对话：改 `chatCompletion`（示意）

当前百炼对话 URL：

```text
https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

OpenAI 兼容可改成：

```ts
const base =
  this.config.get<string>('OPENAI_BASE_URL') ||
  'https://api.openai.com/v1';

const resp = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: model ?? this.model,
    messages,
    temperature: 0.7,
  }),
});

const data = await resp.json();
const content = data.choices?.[0]?.message?.content;
```

若对方也是 OpenAI 兼容格式，**解析逻辑往往不用大改**；主要换 `BASE_URL` 和 Key。

### 3. 文生图：通常要单独接

百炼当前用：

```text
POST {DASHSCOPE_BASE_URL}/services/aigc/multimodal-generation/generation
```

OpenAI 图片接口常见为：

```text
POST https://api.openai.com/v1/images/generations
```

示意（需按官方文档调字段）：

```ts
async generateImage(opts: {
  model: string;
  prompt: string;
  size?: string; // 如 "1024x1024"
}): Promise<string> {
  const base =
    this.config.get<string>('OPENAI_BASE_URL') ||
    'https://api.openai.com/v1';

  const resp = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model, // 如 dall-e-3 / gpt-image-1
      prompt: opts.prompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  const data = await resp.json();
  // OpenAI 常见：data[0].url 或 data[0].b64_json
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('未返回图片地址');
  return url;
}
```

生成模块 `src/generate/generate.service.ts` 会把返回的 URL 下载到 `/uploads/generated/`，一般**不用改**，只要 `generateImage` 仍返回可访问的图片 URL（或 data URL）即可。

### 4. 模型目录要对齐

例如改用 `gpt-4o-mini` / `dall-e-3` 时，在 `ai_model` 表插入或更新：

```sql
-- 示例：文本模型
INSERT INTO ai_model (id, slug, label, category, description, icon, node_types, sort_order, active)
VALUES (
  UUID(), 'gpt-4o-mini', 'GPT-4o mini', 'text',
  'OpenAI 文本模型示例', 'G', 'text,image', 10, 1
);

-- 示例：图片模型（slug 必须与调用 generateImage 时传入的 model 一致）
INSERT INTO ai_model (id, slug, label, category, description, icon, node_types, sort_order, active)
VALUES (
  UUID(), 'dall-e-3', 'DALL·E 3', 'image',
  'OpenAI 文生图示例', 'I', 'image', 10, 1
);
```

同时检查：

- `src/agent/agent-models.ts` 里的白名单 / `DEFAULT_*_MODEL`
- `frontend/src/types/aiModel.ts` 里的 `FALLBACK_AI_MODELS`（接口挂掉时的回退）

---

## 六、推荐演进（多平台长期维护）

```
.env
  AI_PROVIDER=dashscope | openai
  DASHSCOPE_API_KEY=...
  OPENAI_API_KEY=...
  OPENAI_BASE_URL=...

src/agent/providers/
  provider.interface.ts   # chatCompletion / generateImage
  dashscope.provider.ts
  openai.provider.ts
```

`AgentModule` / `GenerateModule` 按 `AI_PROVIDER` 注入对应实现，业务层（`agent.service`、`generate.service`）不再写死百炼 URL。

---

## 七、检查清单

换 Key（仍用百炼）：

- [ ] 改 `backend-nest/.env` 的 `DASHSCOPE_API_KEY`
- [ ] 重启 Nest / PM2
- [ ] `GET /api/health` → `dashscope_configured: true`
- [ ] 试一次 Agent 对话或图片生成

换平台：

- [ ] 新 Key + Base URL 写入 `.env`
- [ ] 改 `dashscope.service.ts`（或拆 Provider）的对话 / 生图
- [ ] 更新 `ai_model` 种子与默认 slug
- [ ] 前端回退模型列表（如需要）
- [ ] 本地跑通：`/api/agent/chat`、`/api/generate` + `/api/tasks/:id`

---

## 八、相关文件索引

| 文件 | 说明 |
|------|------|
| `backend-nest/.env` | 本地真实 Key（勿提交） |
| `backend-nest/.env.example` | 变量模板 |
| `src/agent/dashscope.service.ts` | 调第三方 API 的核心 |
| `src/agent/agent.service.ts` | Agent 业务（对话 / 分镜 / 画布 actions） |
| `src/generate/generate.service.ts` | 异步生图任务 |
| `deploy/sql/add-ai-model-table.sql` | 模型目录种子 |
| `docs/API.md` | `/api/generate`、`/api/agent` 接口说明 |
