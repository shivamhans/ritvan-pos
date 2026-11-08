-- Ritvan POS Phase 5: store logo and customer Khata / credit ledger.
-- Run against ritvan_pos after backing up the database. This migration is repeatable
-- and never drops or rewrites existing sale, customer, payment, or stock records.
USE ritvan_pos;

SET @ritvan_has_logo_data = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'business_settings' AND column_name = 'logo_data'
);
SET @ritvan_logo_sql = IF(
  @ritvan_has_logo_data = 0,
  'ALTER TABLE business_settings ADD COLUMN logo_data MEDIUMTEXT NULL AFTER receipt_footer',
  'SELECT ''business_settings.logo_data already exists'' AS migration_status'
);
PREPARE ritvan_logo_stmt FROM @ritvan_logo_sql;
EXECUTE ritvan_logo_stmt;
DEALLOCATE PREPARE ritvan_logo_stmt;

ALTER TABLE sales MODIFY COLUMN payment_status ENUM('PAID','CREDIT','VOID') NOT NULL DEFAULT 'PAID';

CREATE TABLE IF NOT EXISTS customer_credit_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  sale_id BIGINT UNSIGNED NULL,
  entry_type ENUM('CREDIT_SALE','REPAYMENT') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  method ENUM('CASH','UPI','CARD') NULL,
  reference_no VARCHAR(120) NULL,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_credit_ledger_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_credit_ledger_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_credit_ledger_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_credit_ledger_amount CHECK (amount > 0),
  CONSTRAINT chk_credit_ledger_sale_entry CHECK ((entry_type = 'CREDIT_SALE' AND sale_id IS NOT NULL AND method IS NULL) OR (entry_type = 'REPAYMENT' AND sale_id IS NULL AND method IS NOT NULL)),
  UNIQUE KEY uq_credit_ledger_sale (sale_id),
  INDEX idx_credit_ledger_customer_created (customer_id, created_at),
  INDEX idx_credit_ledger_type_created (entry_type, created_at)
) ENGINE=InnoDB;

SELECT 'Phase 5 Khata/logo migration completed' AS migration_status;
