-- Bookstore (needs work): MySQL tables exported from ChenLab.
--
-- Notes:
-- - AUTHOR has no key attribute, so a generated id column is its primary key.
-- - An unnamed relationship was exported as unnamed_table.
-- - unnamed_table has no cardinality on the PUBLISHER end, so it was treated as many.
-- - unnamed_table has no cardinality on the BOOK end, so it was treated as many.
-- - An unnamed relationship was exported as unnamed_table_2.
-- - unnamed_table_2 has no cardinality on the AUTHOR end, so it was treated as many.
-- - unnamed_table_2 has no cardinality on the BOOK end, so it was treated as many.
-- - An unnamed relationship was exported as unnamed_table_3.
-- - unnamed_table_3 has no cardinality on the GENRE end, so it was treated as many.
-- - unnamed_table_3 has no cardinality on the BOOK end, so it was treated as many.
-- - These columns have no type yet, so they were made VARCHAR(255): PUBLISHER.name, BOOK.isbn, BOOK.title, BOOK.pages, BOOK.price, BOOK.publication_date, BOOK.language, AUTHOR.author_id, AUTHOR.name, GENRE.type, GENRE.age_rating.

CREATE TABLE `PUBLISHER` (
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `BOOK` (
  `isbn` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255),
  `pages` VARCHAR(255),
  `price` VARCHAR(255),
  `publication_date` VARCHAR(255),
  `language` VARCHAR(255),
  PRIMARY KEY (`isbn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `AUTHOR` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `author_id` VARCHAR(255),
  `name` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `GENRE` (
  `type` VARCHAR(255) NOT NULL,
  `age_rating` VARCHAR(255),
  PRIMARY KEY (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `unnamed_table` (
  `name` VARCHAR(255) NOT NULL,
  `isbn` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`name`, `isbn`),
  FOREIGN KEY (`name`) REFERENCES `PUBLISHER` (`name`),
  FOREIGN KEY (`isbn`) REFERENCES `BOOK` (`isbn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `unnamed_table_2` (
  `id` INT NOT NULL,
  `isbn` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`, `isbn`),
  FOREIGN KEY (`id`) REFERENCES `AUTHOR` (`id`),
  FOREIGN KEY (`isbn`) REFERENCES `BOOK` (`isbn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `unnamed_table_3` (
  `type` VARCHAR(255) NOT NULL,
  `isbn` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`type`, `isbn`),
  FOREIGN KEY (`type`) REFERENCES `GENRE` (`type`),
  FOREIGN KEY (`isbn`) REFERENCES `BOOK` (`isbn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
