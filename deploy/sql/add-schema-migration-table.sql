-- 迁移执行记录表（线上升级用，可重复执行）
-- 记录已应用到当前库的 deploy/sql/*.sql 文件名，避免重复执行或漏执行
--
-- 用法：
--   mysql -u tapnow -p tapnow < deploy/sql/add-schema-migration-table.sql
--   然后登记本脚本：
--   mysql -u tapnow -p tapnow -e "INSERT IGNORE INTO schema_migration (filename) VALUES ('add-schema-migration-table.sql');"

CREATE TABLE IF NOT EXISTS `schema_migration` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(255) NOT NULL COMMENT 'deploy/sql/ 下的脚本文件名',
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_schema_migration_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
