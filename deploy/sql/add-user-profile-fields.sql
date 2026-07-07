-- 用户资料扩展：个人主页背景图
-- phpMyAdmin：选中 tapnow → SQL → 执行；列已存在可忽略报错

ALTER TABLE `user`
  ADD COLUMN `banner_url` VARCHAR(512) NULL AFTER `avatar_url`;
