-- University: MySQL tables exported from ChenLab.
--
-- Notes:
-- - age in STUDENT is derived, so it has no column.

CREATE TABLE `DEPARTMENT` (
  `dept_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`dept_id`),
  UNIQUE (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `COURSE` (
  `dept_id` INT NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `credits` TINYINT DEFAULT 5,
  PRIMARY KEY (`dept_id`, `code`),
  FOREIGN KEY (`dept_id`) REFERENCES `DEPARTMENT` (`dept_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `STUDENT` (
  `student_id` INT NOT NULL AUTO_INCREMENT,
  `first` VARCHAR(50) NOT NULL,
  `last` VARCHAR(50) NOT NULL,
  `dept_id` INT,
  PRIMARY KEY (`student_id`),
  FOREIGN KEY (`dept_id`) REFERENCES `DEPARTMENT` (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `STUDENT_email` (
  `student_id` INT NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  PRIMARY KEY (`student_id`, `email`),
  FOREIGN KEY (`student_id`) REFERENCES `STUDENT` (`student_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `SEMESTER` (
  `term` CHAR(6) NOT NULL,
  PRIMARY KEY (`term`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `EMPLOYEE` (
  `emp_id` INT NOT NULL AUTO_INCREMENT,
  `supervisor_emp_id` INT,
  PRIMARY KEY (`emp_id`),
  FOREIGN KEY (`supervisor_emp_id`) REFERENCES `EMPLOYEE` (`emp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `enrolls` (
  `student_id` INT NOT NULL,
  `dept_id` INT NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `grade` DECIMAL(2, 1),
  PRIMARY KEY (`student_id`, `dept_id`, `code`),
  FOREIGN KEY (`student_id`) REFERENCES `STUDENT` (`student_id`),
  FOREIGN KEY (`dept_id`, `code`) REFERENCES `COURSE` (`dept_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `takes` (
  `student_id` INT NOT NULL,
  `dept_id` INT NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `term` CHAR(6) NOT NULL,
  PRIMARY KEY (`student_id`, `dept_id`, `code`),
  FOREIGN KEY (`student_id`) REFERENCES `STUDENT` (`student_id`),
  FOREIGN KEY (`dept_id`, `code`) REFERENCES `COURSE` (`dept_id`, `code`),
  FOREIGN KEY (`term`) REFERENCES `SEMESTER` (`term`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
