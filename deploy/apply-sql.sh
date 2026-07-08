#!/usr/bin/env bash
# 在服务器上安全执行增量 SQL，并写入 schema_migration 记录
#
# 用法：
#   cd /opt/tapnow/backend-nest
#   ./deploy/apply-sql.sh add-xxx.sql
#
# 环境变量（可选）：
#   MYSQL_USER=tapnow MYSQL_DB=tapnow MYSQL_PWD=密码 ./deploy/apply-sql.sh add-xxx.sql
#   也可用 -p 交互输入密码（默认）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_DIR="$SCRIPT_DIR/sql"

MYSQL_USER="${MYSQL_USER:-tapnow}"
MYSQL_DB="${MYSQL_DB:-tapnow}"
FILENAME="${1:-}"

if [[ -z "$FILENAME" ]]; then
  echo "用法: $0 <sql文件名>"
  echo "示例: $0 add-schema-migration-table.sql"
  echo ""
  echo "可用脚本:"
  ls -1 "$SQL_DIR"/*.sql | xargs -n1 basename
  exit 1
fi

# 允许传相对路径或仅文件名
if [[ -f "$FILENAME" ]]; then
  SQL_FILE="$FILENAME"
  FILENAME="$(basename "$FILENAME")"
elif [[ -f "$SQL_DIR/$FILENAME" ]]; then
  SQL_FILE="$SQL_DIR/$FILENAME"
else
  echo "错误: 找不到文件 $FILENAME（在 deploy/sql/ 下也不存在）"
  exit 1
fi

# 禁止对已有库误跑全量初始化
if [[ "$FILENAME" == "init-all-tables.sql" || "$FILENAME" == "init-user-table.sql" ]]; then
  echo "拒绝执行 $FILENAME：全量初始化会 DROP 表，线上有数据时禁止。"
  echo "新建空库请手动：mysql -u $MYSQL_USER -p $MYSQL_DB < deploy/sql/$FILENAME"
  exit 1
fi

MYSQL_ARGS=(-u "$MYSQL_USER")
if [[ -n "${MYSQL_PWD:-}" ]]; then
  export MYSQL_PWD
else
  MYSQL_ARGS+=(-p)
fi
MYSQL_ARGS+=("$MYSQL_DB")

# 若 schema_migration 已存在，先检查是否已执行过
HAS_TABLE=$(mysql "${MYSQL_ARGS[@]}" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema=DATABASE() AND table_name='schema_migration';" 2>/dev/null || echo "0")

if [[ "$HAS_TABLE" == "1" ]]; then
  ALREADY=$(mysql "${MYSQL_ARGS[@]}" -N -e \
    "SELECT COUNT(*) FROM schema_migration WHERE filename='$FILENAME';")
  if [[ "$ALREADY" != "0" ]]; then
    echo "跳过：$FILENAME 已在 schema_migration 中记录，不重复执行。"
    exit 0
  fi
fi

echo "备份建议（首次改线上库强烈推荐）："
echo "  mysqldump -u $MYSQL_USER -p $MYSQL_DB > ~/backup_\$(date +%F_%H%M).sql"
echo ""
echo "正在执行: $SQL_FILE"

mysql "${MYSQL_ARGS[@]}" < "$SQL_FILE"

# 确保记录表存在后再登记
mysql "${MYSQL_ARGS[@]}" < "$SQL_DIR/add-schema-migration-table.sql" 2>/dev/null || true
mysql "${MYSQL_ARGS[@]}" -e \
  "INSERT IGNORE INTO schema_migration (filename) VALUES ('$FILENAME');"

echo "完成：$FILENAME 已执行并记录。"
echo "查看记录：mysql -u $MYSQL_USER -p $MYSQL_DB -e 'SELECT * FROM schema_migration ORDER BY id;'"
