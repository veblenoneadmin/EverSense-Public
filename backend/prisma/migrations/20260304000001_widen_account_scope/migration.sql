-- Widen account.scope column from VARCHAR(191) to TEXT
-- Google OAuth returns scope strings longer than 191 chars
-- Uses INFORMATION_SCHEMA so this works regardless of table-name casing
SET @tbl = (
  SELECT TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND LOWER(TABLE_NAME) = 'account'
  LIMIT 1
);

SET @col_type = (
  SELECT DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND LOWER(TABLE_NAME) = 'account'
    AND COLUMN_NAME = 'scope'
  LIMIT 1
);

SET @sql = IF(
  @tbl IS NOT NULL AND @col_type IS NOT NULL AND @col_type NOT IN ('text','mediumtext','longtext'),
  CONCAT('ALTER TABLE `', @tbl, '` MODIFY COLUMN `scope` TEXT NULL'),
  'SELECT 1'
);

PREPARE dynamic_stmt FROM @sql;
EXECUTE dynamic_stmt;
DEALLOCATE PREPARE dynamic_stmt;
