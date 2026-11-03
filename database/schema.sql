-- Ritvan POS schema (MySQL 8.0+)
-- Single business / single store v1. No business_id/store_id tenancy columns.
-- Run this only in a dedicated development database after backing up any existing data.
CREATE DATABASE IF NOT EXISTS ritvan_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ritvan_pos;

CREATE TABLE IF NOT EXISTS business_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  business_name VARCHAR(140) NOT NULL DEFAULT 'Ritvan Store',
  currency_code CHAR(3) NOT NULL DEFAULT 'INR',
  currency_symbol VARCHAR(8) NOT NULL DEFAULT '₹',
  locale VARCHAR(20) NOT NULL DEFAULT 'en-IN',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  valuation_method ENUM('WEIGHTED_AVG') NOT NULL DEFAULT 'WEIGHTED_AVG',
  receipt_footer VARCHAR(255) NULL,
  logo_data MEDIUMTEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_single_settings_row CHECK (id = 1)
) ENGINE=InnoDB;
INSERT IGNORE INTO business_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(24) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Admin','Manager','Cashier') NOT NULL DEFAULT 'Cashier',
  permissions_json JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  contact_name VARCHAR(140) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  notes TEXT NULL,
  is_business BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_name (name),
  INDEX idx_customers_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  barcode VARCHAR(100) NULL UNIQUE,
  category_id BIGINT UNSIGNED NULL,
  description TEXT NULL,
  image_data MEDIUMTEXT NULL,
  selling_price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  avg_cost DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  qty_on_hand INT NOT NULL DEFAULT 0,
  reorder_threshold INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_items_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_items_selling_price CHECK (selling_price >= 0),
  CONSTRAINT chk_items_avg_cost CHECK (avg_cost >= 0),
  CONSTRAINT chk_items_reorder CHECK (reorder_threshold >= 0),
  INDEX idx_items_name (name),
  INDEX idx_items_category (category_id),
  INDEX idx_items_stock (qty_on_hand)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_no VARCHAR(40) NOT NULL UNIQUE,
  supplier_id BIGINT UNSIGNED NULL,
  status ENUM('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  purchase_date DATE NOT NULL,
  subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  additional_cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  received_by BIGINT UNSIGNED NULL,
  received_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchases_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchases_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_purchases_date (purchase_date),
  INDEX idx_purchases_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(18,4) NOT NULL,
  line_total DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  CONSTRAINT fk_purchase_items_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT chk_purchase_items_qty CHECK (quantity_ordered > 0 AND quantity_received >= 0),
  INDEX idx_purchase_items_item (item_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(60) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NULL,
  cashier_id BIGINT UNSIGNED NOT NULL,
  status ENUM('COMPLETED','VOID') NOT NULL DEFAULT 'COMPLETED',
  subtotal DECIMAL(18,2) NOT NULL,
  discount_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  tax_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(18,2) NOT NULL,
  payment_status ENUM('PAID','CREDIT','VOID') NOT NULL DEFAULT 'PAID',
  negative_stock_override BOOLEAN NOT NULL DEFAULT FALSE,
  stock_override_reason VARCHAR(500) NULL,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(id),
  CONSTRAINT chk_sales_amounts CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND total_amount >= 0),
  INDEX idx_sales_completed (completed_at),
  INDEX idx_sales_customer (customer_id),
  INDEX idx_sales_cashier (cashier_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  item_name_snapshot VARCHAR(200) NOT NULL,
  sku_snapshot VARCHAR(80) NOT NULL,
  quantity INT NOT NULL,
  unit_price_actual DECIMAL(18,2) NOT NULL,
  unit_cost_snapshot DECIMAL(18,4) NOT NULL,
  discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  price_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason VARCHAR(500) NULL,
  provisional_cost BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_sale_items_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT chk_sale_items_qty CHECK (quantity > 0),
  INDEX idx_sale_items_item (item_id),
  INDEX idx_sale_items_sale (sale_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  method ENUM('CASH','UPI','CARD') NOT NULL,
  amount_received DECIMAL(18,2) NOT NULL,
  change_due DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  reference_no VARCHAR(120) NULL,
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT chk_payment_amounts CHECK (amount_received >= 0 AND change_due >= 0),
  INDEX idx_payments_sale_id (sale_id),
  INDEX idx_payments_method_paid_at (method, paid_at)
) ENGINE=InnoDB;

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
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('OPENING_STOCK','PURCHASE_RECEIPT','SALE','RETURN_RESTOCK','SUPPLIER_RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT','DAMAGE_WRITE_OFF','REVERSAL') NOT NULL,
  qty_delta INT NOT NULL,
  unit_cost_at_time DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  reference_type VARCHAR(40) NULL,
  reference_id BIGINT UNSIGNED NULL,
  reason VARCHAR(500) NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_movements_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_stock_movements_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_stock_movements_item_date (item_id, created_at),
  INDEX idx_stock_movements_reference (reference_type, reference_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS returns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  return_no VARCHAR(50) NOT NULL UNIQUE,
  sale_id BIGINT UNSIGNED NOT NULL,
  processed_by BIGINT UNSIGNED NOT NULL,
  status ENUM('DRAFT','COMPLETED','VOID') NOT NULL DEFAULT 'DRAFT',
  refund_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  CONSTRAINT fk_returns_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_returns_user FOREIGN KEY (processed_by) REFERENCES users(id),
  INDEX idx_returns_sale (sale_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS return_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT UNSIGNED NOT NULL,
  sale_item_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  restock BOOLEAN NOT NULL DEFAULT FALSE,
  condition_note VARCHAR(300) NULL,
  refund_amount DECIMAL(18,2) NOT NULL,
  CONSTRAINT fk_return_items_return FOREIGN KEY (return_id) REFERENCES returns(id),
  CONSTRAINT fk_return_items_sale_item FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  CONSTRAINT chk_return_items_qty CHECK (quantity > 0),
  INDEX idx_return_items_sale_item (sale_item_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spendings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  spending_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  payment_mode ENUM('CASH','UPI','CARD','BANK_TRANSFER','OTHER') NOT NULL,
  paid_to VARCHAR(140) NULL,
  reference_no VARCHAR(120) NULL,
  notes VARCHAR(500) NULL,
  status ENUM('RECORDED','VOID') NOT NULL DEFAULT 'RECORDED',
  void_reason VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_spendings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_spendings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_spendings_amount CHECK (amount > 0),
  INDEX idx_spendings_date_status (spending_date, status, id),
  INDEX idx_spendings_category_date (category, spending_date),
  INDEX idx_spendings_payment_date (payment_mode, spending_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- Add an initial Admin through the server seed script; never store a plaintext password.

-- Admin workflow for negative-stock overrides. One row is created for each oversold sale line.
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


-- Persist one declared manual refund settlement record per return.
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

-- Phase 6: employee directory, payroll, and staff expenses.
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  aadhaar_encrypted TEXT NULL,
  aadhaar_last4 CHAR(4) NULL,
  photo_data MEDIUMTEXT NULL,
  date_of_joining DATE NOT NULL,
  monthly_salary DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  job_role VARCHAR(100) NOT NULL,
  salary_due_day TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employees_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_employees_salary CHECK (monthly_salary >= 0),
  CONSTRAINT chk_employees_salary_due_day CHECK (salary_due_day BETWEEN 1 AND 28),
  INDEX idx_employees_active_name (is_active, name),
  INDEX idx_employees_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  expense_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  amount DECIMAL(18,2) NOT NULL,
  payment_mode ENUM('CASH','UPI','CARD','BANK_TRANSFER','OTHER') NULL,
  settlement_mode ENUM('COMPANY_PAID','DEDUCT_NEXT_MONTH') NOT NULL,
  deduction_month DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_expenses_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employee_expenses_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_employee_expenses_amount CHECK (amount > 0),
  CONSTRAINT chk_employee_expense_settlement CHECK (
    (settlement_mode = 'COMPANY_PAID' AND payment_mode IS NOT NULL AND deduction_month IS NULL)
    OR
    (settlement_mode = 'DEDUCT_NEXT_MONTH' AND payment_mode IS NULL AND deduction_month IS NOT NULL)
  ),
  INDEX idx_employee_expenses_date (expense_date, id),
  INDEX idx_employee_expenses_employee_date (employee_id, expense_date),
  INDEX idx_employee_expenses_deduction (employee_id, settlement_mode, deduction_month)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_payroll (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  payroll_month DATE NOT NULL,
  due_date DATE NOT NULL,
  base_salary DECIMAL(18,2) NOT NULL,
  deductions DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  payable_amount DECIMAL(18,2) NOT NULL,
  status ENUM('UNPAID','PAID') NOT NULL DEFAULT 'UNPAID',
  paid_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NULL,
  marked_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_payroll_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employee_payroll_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_employee_payroll_marked_by FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_employee_payroll_amounts CHECK (base_salary >= 0 AND deductions >= 0 AND payable_amount >= 0),
  UNIQUE KEY uq_employee_payroll_month (employee_id, payroll_month),
  INDEX idx_employee_payroll_due_status (status, due_date),
  INDEX idx_employee_payroll_paid_at (paid_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_payroll_deductions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payroll_id BIGINT UNSIGNED NOT NULL,
  expense_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_payroll_deductions_payroll FOREIGN KEY (payroll_id) REFERENCES employee_payroll(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employee_payroll_deductions_expense FOREIGN KEY (expense_id) REFERENCES employee_expenses(id) ON DELETE RESTRICT,
  CONSTRAINT chk_employee_payroll_deduction_amount CHECK (amount > 0),
  UNIQUE KEY uq_employee_payroll_deduction (payroll_id, expense_id),
  INDEX idx_employee_payroll_deduction_expense (expense_id)
) ENGINE=InnoDB;
