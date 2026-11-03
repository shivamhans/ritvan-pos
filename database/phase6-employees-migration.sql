-- Ritvan POS Phase 6: employee directory, payroll, and staff expenses.
-- Back up ritvan_pos before running. This migration only creates new tables
-- and does not delete or rewrite existing business records.
USE ritvan_pos;

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

SELECT 'Phase 6 employee directory/payroll migration completed' AS migration_status;
