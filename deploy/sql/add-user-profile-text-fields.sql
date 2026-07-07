-- 用户个人资料字段（简介、社交、地区等）
-- phpMyAdmin：选中 tapnow → SQL → 执行；列已存在可忽略报错

ALTER TABLE `user`
  ADD COLUMN `bio` VARCHAR(500) NULL AFTER `banner_url`;

ALTER TABLE `user`
  ADD COLUMN `social_link` VARCHAR(512) NULL AFTER `bio`;

ALTER TABLE `user`
  ADD COLUMN `country` VARCHAR(64) NULL AFTER `social_link`;

ALTER TABLE `user`
  ADD COLUMN `city` VARCHAR(64) NULL AFTER `country`;

ALTER TABLE `user`
  ADD COLUMN `profession` VARCHAR(128) NULL AFTER `city`;

ALTER TABLE `user`
  ADD COLUMN `show_join_date` TINYINT(1) NOT NULL DEFAULT 1 AFTER `profession`;
