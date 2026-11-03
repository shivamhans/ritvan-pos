-- Ritvan POS Phase 7: optional business classification for customers.
-- Back up ritvan_pos before running. This migration adds one default-false
-- flag and preserves all existing customer and sales records.
USE ritvan_pos;

SET @ritvan_has_customer_business = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'customers' AND column_name = 'is_business'
);
SET @ritvan_customer_business_sql = IF(
  @ritvan_has_customer_business = 0,
  'ALTER TABLE customers ADD COLUMN is_business BOOLEAN NOT NULL DEFAULT FALSE AFTER notes',
  'SELECT ''customers.is_business already exists'' AS migration_status'
);
PREPARE ritvan_customer_business_stmt FROM @ritvan_customer_business_sql;
EXECUTE ritvan_customer_business_stmt;
DEALLOCATE PREPARE ritvan_customer_business_stmt;

SELECT 'Phase 7 business-customer migration completed' AS migration_status;
