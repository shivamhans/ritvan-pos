-- Ritvan POS Phase 3/4 upgrade migration
-- Safe to run against an existing ritvan_pos database; creates only the tables
-- added after the original schema. Does not drop, rename, or rewrite existing rows.
USE ritvan_pos;

-- Add per-user permission configuration safely for existing databases.
SET @ritvan_has_permissions_json = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'permissions_json'
);
SET @ritvan_permissions_sql = IF(
  @ritvan_has_permissions_json = 0,
  'ALTER TABLE users ADD COLUMN permissions_json JSON NULL AFTER role',
  'SELECT ''users.permissions_json already exists'' AS migration_status'
);
PREPARE ritvan_permissions_stmt FROM @ritvan_permissions_sql;
EXECUTE ritvan_permissions_stmt;
DEALLOCATE PREPARE ritvan_permissions_stmt;


-- Add optional item photos safely when upgrading an existing database.
SET @ritvan_has_item_image = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'items' AND column_name = 'image_data'
);
SET @ritvan_item_image_sql = IF(
  @ritvan_has_item_image = 0,
  'ALTER TABLE items ADD COLUMN image_data MEDIUMTEXT NULL AFTER description',
  'SELECT ''items.image_data already exists'' AS migration_status'
);
PREPARE ritvan_item_image_stmt FROM @ritvan_item_image_sql;
EXECUTE ritvan_item_image_stmt;
DEALLOCATE PREPARE ritvan_item_image_stmt;


CREATE TABLE IF NOT EXISTS negative_stock_reconciliation (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  sale_item_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  shortage_qty INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_counted_qty INT NULL,
  resolution_reason VARCHAR(500) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_negative_reconciliation_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_negative_reconciliation_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  CONSTRAINT fk_negative_reconciliation_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_negative_reconciliation_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_negative_reconciliation_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_negative_reconciliation_shortage CHECK (shortage_qty > 0),
  CONSTRAINT chk_negative_reconciliation_count CHECK (resolved_counted_qty IS NULL OR resolved_counted_qty >= 0),
  INDEX idx_negative_reconciliation_item_status (item_id, status),
  INDEX idx_negative_reconciliation_sale (sale_id),
  INDEX idx_negative_reconciliation_status_created (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS return_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT UNSIGNED NOT NULL UNIQUE,
  method ENUM('CASH','UPI','CARD') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  reference_no VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_return_payments_return FOREIGN KEY (return_id) REFERENCES returns(id),
  CONSTRAINT chk_return_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB;
