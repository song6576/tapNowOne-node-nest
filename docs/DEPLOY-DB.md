# TapNow 生产数据库变更指南

适用环境：Ubuntu 服务器 + MySQL，代码在 `/opt/tapnow/backend-nest`。  
约定：**本地改 Prisma schema，生产用 `deploy/sql/` 增量脚本**；勿对线上库使用 `prisma migrate`。

> **FinalShell 用户**：日常操作直接看下方 [FinalShell 操作速查表](#finalshell-操作速查表)。

---

## FinalShell 操作速查表

在 FinalShell 打开 SSH 终端，**默认目录** `/opt/tapnow/backend-nest`。

### 只需做一次（启用迁移记录）

```bash
cd /opt/tapnow/backend-nest
git pull origin main
chmod +x deploy/apply-sql.sh
./deploy/apply-sql.sh add-schema-migration-table.sql
mysql -u tapnow -p tapnow -e "SELECT * FROM schema_migration ORDER BY id;"
```

---

### 以后改表 / 新建表（复制整段执行）

**前提：** 你已在 Mac 上改好 `schema.prisma`、写好 `deploy/sql/add-xxx.sql` 并 `git push`。

把 `add-你的新脚本.sql` 换成实际文件名：

```bash
cd /opt/tapnow/backend-nest
git pull origin main
mysqldump -u tapnow -p tapnow > ~/backup_$(date +%F_%H%M).sql
./deploy/apply-sql.sh add-你的新脚本.sql
npx prisma generate
npm run build
pm2 restart tapnow-api
curl http://127.0.0.1:3000/api/health
```

看到 `"database":"ok"` 即成功。

---

### 只改了后端代码（没动数据库）

```bash
cd /opt/tapnow/backend-nest
git pull origin main
npm install          # package.json 有变时
npm run build
pm2 restart tapnow-api
curl http://127.0.0.1:3000/api/health
```

---

### 只改了前端

```bash
cd /opt/tapnow/frontend
git pull origin main
npm install          # package.json 有变时
npm run build
```

浏览器强刷 `Ctrl+Shift+R`。Nginx 一般不用重启。

---

### 常用检查命令

```bash
pm2 status                                          # 后端是否在跑
pm2 logs tapnow-api --lines 50                      # 看报错
mysql -u tapnow -p tapnow -e "SHOW TABLES;"        # 有哪些表
mysql -u tapnow -p tapnow -e "DESCRIBE user;"       # 看某表结构
mysql -u tapnow -p tapnow -e "SELECT * FROM schema_migration ORDER BY id;"  # 已执行过哪些 SQL
curl http://127.0.0.1:3000/api/health               # 本机测后端
curl http://127.0.0.1/api/health                    # 本机测 Nginx 代理
```

---

### 两种改库场景

| 场景 | Mac 本地 | FinalShell |
|------|----------|------------|
| **加字段** | 改 schema + 新建 `add-表名-字段.sql` + push | `git pull` → `apply-sql.sh` → generate → build → restart |
| **新建表** | 改 schema + 新建 `add-功能-tables.sql` + push | 同上 |

**不需要**在 FinalShell 里手写 SQL，也**不需要**再跑 `init-all-tables.sql`。

---

### 完整示例：给 user 加 nickname

Mac 已 push `deploy/sql/add-user-nickname.sql` 后，FinalShell 执行：

```bash
cd /opt/tapnow/backend-nest
git pull origin main
mysqldump -u tapnow -p tapnow > ~/backup_$(date +%F_%H%M).sql
./deploy/apply-sql.sh add-user-nickname.sql
npx prisma generate
npm run build
pm2 restart tapnow-api
curl http://127.0.0.1:3000/api/health
```

---

### 禁止在 FinalShell 执行

| 命令 | 后果 |
|------|------|
| `mysql ... < deploy/sql/init-all-tables.sql` | **DROP 全部表，数据全丢** |
| `mysql ... < deploy/sql/init-user-table.sql` | **删除 user 表** |
| 同一 `add-xxx.sql` 手动反复执行 | 可能报「列已存在」；用 `apply-sql.sh` 会自动跳过已登记脚本 |

---

### 一句话流程

```
Mac：改 schema → 写 add-xxx.sql → git push
FinalShell：git pull → 备份 → apply-sql.sh → prisma generate → pm2 restart
```

---

## 一、两种脚本的区别

| 文件 | 用途 | 线上有数据时 |
|------|------|----------------|
| `init-all-tables.sql` | 全新空库一键建表 | **禁止执行**（会 DROP） |
| `init-user-table.sql` | 仅重建 user | **禁止执行** |
| `add-*.sql` / `alter-*.sql` | 增量变更 | 按需执行一次 |
| `schema_migration` 表 | 记录已执行过哪些脚本 | 自动维护 |

新服务器：先建库 → 跑 `init-all-tables.sql` 一次。  
已有数据的服务器：只跑新的增量 SQL。

---

## 二、首次启用迁移记录（已有线上库）

若库是早期用分步脚本建的，还没有 `schema_migration`：

```bash
cd /opt/tapnow/backend-nest
git pull origin main
chmod +x deploy/apply-sql.sh

# 方式 A：用脚本（推荐）
./deploy/apply-sql.sh add-schema-migration-table.sql

# 方式 B：手动
mysql -u tapnow -p tapnow < deploy/sql/add-schema-migration-table.sql
mysql -u tapnow -p tapnow -e \
  "INSERT IGNORE INTO schema_migration (filename) VALUES ('add-schema-migration-table.sql');"
```

查看已执行记录：

```bash
mysql -u tapnow -p tapnow -e "SELECT * FROM schema_migration ORDER BY id;"
```

---

## 三、日常：表结构变更怎么做

### 1. 本地开发

1. 修改 `prisma/schema.prisma`
2. 在 `deploy/sql/` **新建**增量文件，命名建议：
   - 新表：`add-功能名-tables.sql`
   - 新字段：`add-表名-字段名.sql`
   - 改结构：`alter-表名-说明.sql`
3. 把相同结构同步写入 `init-all-tables.sql`（只服务「以后新服务器」，不影响线上）
4. 更新 `docs/SQL.md`（必要时 `docs/API.md`）
5. 本地验证：

```bash
npx prisma generate
# 本地 MySQL 执行你的新 SQL 后启动后端测试
npm run start:dev
```

6. commit & push

### 2. 服务器升级

```bash
cd /opt/tapnow/backend-nest
git pull origin main

# 强烈建议：有真实用户时先备份
mysqldump -u tapnow -p tapnow > ~/backup_$(date +%F_%H%M).sql

# 执行本次新增的增量脚本（只执行新文件，不要跑 init-all）
./deploy/apply-sql.sh add-你的新脚本.sql

# 同步 Prisma Client + 重启
npm install          # package.json 有变时
npx prisma generate  # schema.prisma 有变时必做
npm run build
pm2 restart tapnow-api
```

无数据库变更、仅改代码时：

```bash
git pull && npm install && npm run build && pm2 restart tapnow-api
```

---

## 四、`apply-sql.sh` 行为

- 在 `deploy/sql/` 下找文件并执行
- 已在 `schema_migration` 登记过则**跳过**，避免重复
- **拒绝**执行 `init-all-tables.sql` / `init-user-table.sql`，防止误删线上数据
- 执行成功后 `INSERT IGNORE` 登记文件名

非交互密码（可选）：

```bash
MYSQL_USER=tapnow MYSQL_DB=tapnow MYSQL_PWD='你的密码' \
  ./deploy/apply-sql.sh add-xxx.sql
```

---

## 五、示例

### 示例 A：给 user 加字段

`deploy/sql/add-user-nickname.sql`：

```sql
ALTER TABLE `user`
  ADD COLUMN `nickname` VARCHAR(64) NULL AFTER `name`;
```

服务器：

```bash
./deploy/apply-sql.sh add-user-nickname.sql
npx prisma generate && npm run build && pm2 restart tapnow-api
```

### 示例 B：新建表

`deploy/sql/add-notification-table.sql`：

```sql
CREATE TABLE IF NOT EXISTS `notification` (
  `id` CHAR(36) NOT NULL,
  `user_id` INT NOT NULL,
  `content` TEXT NOT NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_user_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

服务器同样：`./deploy/apply-sql.sh add-notification-table.sql`，再 generate + build + restart。

---

## 六、检查清单

- [ ] 本地 schema + 增量 SQL + `init-all-tables.sql`（新环境）已对齐
- [ ] 已 push 到 GitHub
- [ ] 服务器 `git pull`
- [ ] 已备份（重要变更）
- [ ] 只执行新的 `add-` / `alter-` 脚本
- [ ] `schema_migration` 中有该文件名
- [ ] `npx prisma generate` + `npm run build` + `pm2 restart`

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
# database 应为 ok
```

---

## 七、相关文档

| 文档 | 内容 |
|------|------|
| [`SQL.md`](SQL.md) | 各表字段、历史脚本说明 |
| [`../deploy/sql/`](../deploy/sql/) | 全部 SQL 文件 |
| [`../README.md`](../README.md) | 后端快速开始 |
