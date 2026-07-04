-- 修复 user 表结构（表为空时可安全执行）
USE test;

DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `iphone` INT NULL,
  `passWord` VARCHAR(255) NULL,
  `token` VARCHAR(255) NULL,
  `google_id` VARCHAR(255) NULL,
  `name` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(512) NULL,
  `createTime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_email_key` (`email`),
  UNIQUE KEY `user_google_id_key` (`google_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
