# TapNow 文件上传接口说明

本文说明如何上传**画布项目素材**、**用户头像**、**个人主页背景图**，以及前端/后端的构造方式。

---

## 一、前置条件

1. 用户已登录（请求头带 JWT）
2. NestJS 后端已启动（默认 `http://localhost:3000`）
3. 开发环境下 Vite 已代理：
   - `/api` → 后端
   - `/uploads` → 后端静态文件
4. 若使用 MySQL 存用户背景，先执行 [`deploy/sql/add-user-profile-fields.sql`](../deploy/sql/add-user-profile-fields.sql)

---

## 二、存储方式

| 项目 | 说明 |
|------|------|
| 磁盘目录 | `backend-nest/uploads/`（可用环境变量 `UPLOAD_DIR` 修改） |
| 访问 URL | `/uploads/{userId}/{category}/...` |
| 数据库 | 头像/背景 URL 写入 `user.avatar_url`、`user.banner_url`；画布素材 URL 写入 `project.data` 节点 JSON |

文件**不单独建 asset 表**；项目素材 URL 存在画布节点的 `data.outputUrl` 中。

---

## 三、接口一览

| 用途 | 方法 | 路径 | 表单字段 |
|------|------|------|----------|
| 画布素材（图/视频/音频） | POST | `/api/uploads` | `file`, 可选 `category=project`, 可选 `projectId` |
| 用户头像 | POST | `/api/users/me/avatar` | `file` |
| 个人背景图 | POST | `/api/users/me/banner` | `file` |

**共同要求：**
- `Content-Type: multipart/form-data`
- Header：`Authorization: Bearer <token>`

---

## 四、类型与大小限制

| category | 允许 MIME | 最大体积 |
|----------|-----------|----------|
| `project` | 见下表 | 100 MB |
| `avatar` | jpeg, png, webp, gif | 5 MB |
| `banner` | jpeg, png, webp | 10 MB |

**project 允许的 MIME：**

- 图片：`image/jpeg`, `image/png`, `image/webp`, `image/gif`
- 视频：`video/mp4`, `video/webm`, `video/quicktime`
- 音频：`audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/ogg`, `audio/x-wav`

---

## 五、响应格式

### 5.1 画布素材 `POST /api/uploads`

```json
{
  "url": "/uploads/12/project/a1b2c3d4-....jpg",
  "filename": "photo.jpg",
  "mime_type": "image/jpeg",
  "size": 102400,
  "category": "project"
}
```

若传了 `projectId`，文件会存到 `uploads/{userId}/project/{projectId}/` 子目录。

### 5.2 头像 `POST /api/users/me/avatar`

```json
{
  "url": "/uploads/12/avatar/uuid.png",
  "user": {
    "id": "12",
    "email": "you@example.com",
    "name": "昵称",
    "avatar_url": "/uploads/12/avatar/uuid.png",
    "banner_url": null,
    "created_at": "2026-07-01T00:00:00.000Z"
  }
}
```

### 5.3 背景 `POST /api/users/me/banner`

```json
{
  "url": "/uploads/12/banner/uuid.jpg",
  "banner_url": "/uploads/12/banner/uuid.jpg",
  "user": { "...": "同上，含 banner_url" }
}
```

---

## 六、前端调用示例

项目已封装在前端仓库 `frontend/src/api/client.ts`：

```typescript
import { uploadProjectAsset, uploadAvatar, uploadBanner } from '../api/client'

// 1. 画布上传图片/视频/音频
const file = inputElement.files[0]
const result = await uploadProjectAsset(file, projectId)
// result.url → 写入节点 data.outputUrl

// 2. 头像
const { user } = await uploadAvatar(file)
authStore.updateUser(user)

// 3. 背景
const { user } = await uploadBanner(file)
authStore.updateUser(user)
```

**原生 fetch 示例（便于 Postman / curl 对照）：**

```javascript
const form = new FormData()
form.append('file', file)
form.append('category', 'project')
form.append('projectId', '550e8400-e29b-41d4-a716-446655440000')

await fetch('/api/uploads', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
})
```

```bash
curl -X POST http://localhost:3000/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@avatar.png"
```

---

## 七、画布中如何使用上传结果

上传成功后，前端会：

1. 根据 `mime_type` 判断节点类型（image / video / audio）
2. 在画布创建对应节点，`data.outputUrl = url`
3. 防抖 `PATCH /api/projects/:id` 把整份 `project.data` 存回云端

节点 JSON 示例：

```json
{
  "id": "node-uuid",
  "type": "image",
  "position": { "x": 100, "y": 200 },
  "data": {
    "label": "photo",
    "prompt": "",
    "status": "done",
    "outputUrl": "/uploads/12/project/550e8400-.../abc.jpg"
  }
}
```

页面展示时用 `<img src={outputUrl} />` 或 `<video src={outputUrl} />`；开发环境 `/uploads` 经 Vite 代理即可访问。

---

## 八、个人中心如何使用

| 页面 | 操作 | 接口 |
|------|------|------|
| 个人主页 `ProfilePage` | 「上传背景」 | `uploadBanner` |
| 个人主页 | 头像右下角编辑 | `uploadAvatar` |
| 账户设置 → 个人资料 | 点击头像 | `uploadAvatar` |

背景图优先使用 `user.banner_url`；未上传时仍可用本地 gradient 预设（`profile.bannerStyle`）。

---

## 九、后端代码位置

| 模块 | 路径 |
|------|------|
| 上传服务 | `backend-nest/src/upload/upload.service.ts` |
| 项目素材接口 | `backend-nest/src/upload/upload.controller.ts` |
| 头像/背景接口 | `backend-nest/src/users/users.controller.ts` |
| 静态文件 | `backend-nest/src/main.ts` → `app.useStaticAssets(..., { prefix: '/uploads' })` |
| 类型与限制 | `backend-nest/src/upload/upload.constants.ts` |

---

## 十、环境变量

| 变量 | 默认值 | 含义 |
|------|--------|------|
| `UPLOAD_DIR` | `backend-nest/uploads` | 文件保存根目录 |
| `FRONTEND_URL` | `http://localhost:5173` | CORS 允许来源 |

---

## 十一、生产部署注意

1. `uploads/` 需持久化卷（容器重启不丢文件）
2. 多机部署时改用对象存储（OSS/S3），URL 改为 CDN 域名
3. 当前为**本地磁盘 MVP**；后续可替换 `UploadService.saveFile` 实现而不改 API 契约
4. 建议对 `/uploads` 做 Nginx 反向代理或 CDN，减轻 Node 静态压力

---

## 十二、错误码说明

| HTTP | 常见原因 |
|------|----------|
| 401 | 未登录或 token 过期 |
| 400 | 未选文件、MIME 不支持、文件过大 |
| 500 | 磁盘不可写、数据库更新失败 |

错误体示例（NestJS）：

```json
{
  "statusCode": 400,
  "message": "不支持的文件类型：application/pdf（project）"
}
```
