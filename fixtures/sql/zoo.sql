-- Zoo: MySQL tables exported from ChenLab.
--
-- Notes:
-- - ANIMAL is split into subclasses (t,d), but MySQL cannot enforce those constraints on the subclass tables.
-- - MAMMAL is split into subclasses (p,d), but MySQL cannot enforce those constraints on the subclass tables.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `HERBIVORE`;
DROP TABLE IF EXISTS `CARNIVORE`;
DROP TABLE IF EXISTS `BIRD`;
DROP TABLE IF EXISTS `MAMMAL`;
DROP TABLE IF EXISTS `ANIMAL`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `ANIMAL` (
  `animal_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`animal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `MAMMAL` (
  `animal_id` INT NOT NULL,
  `gestation_days` SMALLINT,
  PRIMARY KEY (`animal_id`),
  FOREIGN KEY (`animal_id`) REFERENCES `ANIMAL` (`animal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `BIRD` (
  `animal_id` INT NOT NULL,
  `wingspan_cm` SMALLINT,
  PRIMARY KEY (`animal_id`),
  FOREIGN KEY (`animal_id`) REFERENCES `ANIMAL` (`animal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `CARNIVORE` (
  `animal_id` INT NOT NULL,
  `teeth_type` VARCHAR(50),
  PRIMARY KEY (`animal_id`),
  FOREIGN KEY (`animal_id`) REFERENCES `MAMMAL` (`animal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `HERBIVORE` (
  `animal_id` INT NOT NULL,
  `browse` VARCHAR(50),
  PRIMARY KEY (`animal_id`),
  FOREIGN KEY (`animal_id`) REFERENCES `MAMMAL` (`animal_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
