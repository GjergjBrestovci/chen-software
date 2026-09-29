-- Edge cases: MySQL tables exported from ChenLab.
--
-- Notes:
-- - A.b_ref was given the type of B's key, because a foreign key must match the column it references.
-- - order.code is VARCHAR with no length, so it was given 255.
-- - TAG.label is TEXT, which MySQL cannot use in a key, so it was made VARCHAR(255).

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `B`;
DROP TABLE IF EXISTS `A`;
DROP TABLE IF EXISTS `assigned`;
DROP TABLE IF EXISTS `knows`;
DROP TABLE IF EXISTS `tagged_by`;
DROP TABLE IF EXISTS `tagged`;
DROP TABLE IF EXISTS `BADGE`;
DROP TABLE IF EXISTS `PERSON`;
DROP TABLE IF EXISTS `SEAT`;
DROP TABLE IF EXISTS `ROOM`;
DROP TABLE IF EXISTS `BUILDING`;
DROP TABLE IF EXISTS `TAG`;
DROP TABLE IF EXISTS `order`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `order` (
  `order_id` INT NOT NULL AUTO_INCREMENT,
  `placed` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `note` TEXT DEFAULT ('it''s fine'),
  `paid` BOOLEAN DEFAULT FALSE,
  `total` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `due` DATE DEFAULT '2026-12-31',
  `code` VARCHAR(255),
  PRIMARY KEY (`order_id`),
  UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `TAG` (
  `label` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `BUILDING` (
  `building_name` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`building_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `ROOM` (
  `building_name` VARCHAR(50) NOT NULL,
  `number` SMALLINT NOT NULL,
  PRIMARY KEY (`building_name`, `number`),
  FOREIGN KEY (`building_name`) REFERENCES `BUILDING` (`building_name`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `SEAT` (
  `building_name` VARCHAR(50) NOT NULL,
  `number` SMALLINT NOT NULL,
  `seat` CHAR(3) NOT NULL,
  PRIMARY KEY (`building_name`, `number`, `seat`),
  FOREIGN KEY (`building_name`, `number`) REFERENCES `ROOM` (`building_name`, `number`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `PERSON` (
  `person_id` INT NOT NULL,
  PRIMARY KEY (`person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `BADGE` (
  `badge_no` CHAR(8) NOT NULL,
  `person_id` INT NOT NULL,
  PRIMARY KEY (`badge_no`),
  UNIQUE (`person_id`),
  FOREIGN KEY (`person_id`) REFERENCES `PERSON` (`person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tagged` (
  `order_id` INT NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `tagged_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`, `label`),
  FOREIGN KEY (`order_id`) REFERENCES `order` (`order_id`),
  FOREIGN KEY (`label`) REFERENCES `TAG` (`label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `tagged_by` (
  `order_id` INT NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `by` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`order_id`, `label`, `by`),
  FOREIGN KEY (`order_id`, `label`) REFERENCES `tagged` (`order_id`, `label`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `knows` (
  `person_id` INT NOT NULL,
  `person_person_id` INT NOT NULL,
  PRIMARY KEY (`person_id`, `person_person_id`),
  FOREIGN KEY (`person_id`) REFERENCES `PERSON` (`person_id`),
  FOREIGN KEY (`person_person_id`) REFERENCES `PERSON` (`person_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `assigned` (
  `person_id` INT NOT NULL,
  `building_name` VARCHAR(50) NOT NULL,
  `number` SMALLINT NOT NULL,
  `seat` CHAR(3) NOT NULL,
  `order_id` INT NOT NULL,
  PRIMARY KEY (`building_name`, `number`, `seat`, `order_id`),
  UNIQUE (`person_id`, `order_id`),
  FOREIGN KEY (`person_id`) REFERENCES `PERSON` (`person_id`),
  FOREIGN KEY (`building_name`, `number`, `seat`) REFERENCES `SEAT` (`building_name`, `number`, `seat`),
  FOREIGN KEY (`order_id`) REFERENCES `order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `A` (
  `a_id` INT NOT NULL,
  `b_ref` INT,
  PRIMARY KEY (`a_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `B` (
  `b_id` INT NOT NULL,
  `a_ref` INT,
  PRIMARY KEY (`b_id`),
  FOREIGN KEY (`a_ref`) REFERENCES `A` (`a_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `A` ADD FOREIGN KEY (`b_ref`) REFERENCES `B` (`b_id`);
