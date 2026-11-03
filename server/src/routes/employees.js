import { Router } from 'express';
import { createCipheriv, randomBytes } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
// Employee profiles, payroll and government-ID metadata are restricted to Admin.
router.use(requireAuth, allowRoles('Admin'), requireModuleAccessFor(['Employees']));

const money2 = value => Number(Number(value || 0).toFixed(2));
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const own = (object, key) => Object.hasOwn(object || {}, key);
const dateRE = /^\d{4}-\d{2}-\d{2}$/;
const monthRE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isDate(value) {
  if (!dateRE.test(String(value || ''))) return false;
  const parsed = new Date(String(value) + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function isMonth(value) {
  if (!monthRE.test(String(value || ''))) return false;
  return isDate(String(value) + '-01');
}
function startOfMonth(value) { return String(value).slice(0, 7) + '-01'; }
function nextMonth(value) {
  const date = new Date(String(value) + 'T00:00:00.000Z');
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}
function dateForDueDay(month, day) {
  const year = Number(String(month).slice(0, 4));
  const monthNo = Number(String(month).slice(5, 7));
  const safeDay = Math.max(1, Math.min(28, Number(day) || 1));
  return year + '-' + String(monthNo).padStart(2, '0') + '-' + String(safeDay).padStart(2, '0');
}
function employeePiiKey() {
  const value = String(process.env.EMPLOYEE_PII_ENCRYPTION_KEY || '').trim();
  return /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, 'hex') : null;
}
function normalizeAadhaar(value) {
  const digits = String(value || '').replace(/[\s-]/g, '');
  if (!digits) return '';
  if (!/^\d{12}$/.test(digits) || /^([0-9])\1{11}$/.test(digits)) {
    throw Object.assign(new Error('Aadhaar must contain 12 digits. It is optional.'), { status: 400 });
  }
  return digits;
}
function encryptAadhaar(value) {
  const digits = normalizeAadhaar(value);
  if (!digits) return { encrypted: null, last4: null };
  const key = employeePiiKey();
  if (!key) {
    throw Object.assign(new Error('Aadhaar storage is not configured. Add EMPLOYEE_PII_ENCRYPTION_KEY to server/.env, restart the API, or leave Aadhaar blank.'), { status: 503 });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // The application never returns the encrypted value or plaintext Aadhaar.
  return { encrypted: [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.'), last4: digits.slice(-4) };
}
function normalizePhoto(value) {
  if (value == null || value === '') return null;
  const photo = String(value);
  if (photo.length > 220000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
    throw Object.assign(new Error('Employee photo must be a compressed JPEG image under approximately 160 KB.'), { status: 400 });
  }
  return photo;
}
function normalizeEmployeeFields(body, { partial = false } = {}) {
  const fields = [];
  const values = [];
  const add = (key, column, value) => { fields.push(column + ' = ?'); values.push(value); };
  const should = key => !partial || own(body, key);

  if (should('name')) {
    const name = String(body.name || '').trim();
    if (!name || name.length > 180) throw Object.assign(new Error('Employee name is required (max 180 characters).'), { status: 400 });
    add('name', 'name', name);
  }
  if (should('phone')) {
    const phone = String(body.phone || '').trim();
    const digits = phone.replace(/\D/g, '');
    if (!phone || digits.length < 7 || digits.length > 15 || phone.length > 24) {
      throw Object.assign(new Error('Enter a valid employee phone number.'), { status: 400 });
    }
    add('phone', 'phone', phone);
  }
  if (should('dateOfJoining')) {
    const date = String(body.dateOfJoining || '');
    if (!isDate(date)) throw Object.assign(new Error('Enter a valid date of joining.'), { status: 400 });
    add('dateOfJoining', 'date_of_joining', date);
  }
  if (should('monthlySalary')) {
    const salary = Number(body.monthlySalary);
    if (!Number.isFinite(salary) || salary < 0 || salary > 99999999999999) {
      throw Object.assign(new Error('Monthly salary must be a non-negative valid amount.'), { status: 400 });
    }
    add('monthlySalary', 'monthly_salary', money2(salary));
  }
  if (should('jobRole')) {
    const role = String(body.jobRole || '').trim();
    if (!role || role.length > 100) throw Object.assign(new Error('Employee role/title is required (max 100 characters).'), { status: 400 });
    add('jobRole', 'job_role', role);
  }
  if (should('salaryDueDay')) {
    const dueDay = Number(body.salaryDueDay);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      throw Object.assign(new Error('Monthly salary due day must be between 1 and 28.'), { status: 400 });
    }
    add('salaryDueDay', 'salary_due_day', dueDay);
  }
  if (own(body, 'photoData')) add('photoData', 'photo_data', normalizePhoto(body.photoData));
  if (own(body, 'isActive')) {
    if (![true, false, 0, 1].includes(body.isActive)) throw Object.assign(new Error('isActive must be a boolean.'), { status: 400 });
    add('isActive', 'is_active', body.isActive ? 1 : 0);
  }
  if (own(body, 'aadhaar')) {
    const aadhaar = encryptAadhaar(body.aadhaar);
    add('aadhaarEncrypted', 'aadhaar_encrypted', aadhaar.encrypted);
    add('aadhaarLast4', 'aadhaar_last4', aadhaar.last4);
  }
  return { fields, values };
}
function auditSummary(employee) {
  if (!employee) return null;
  return {
    id: employee.id,
    name: employee.name,
    phone: employee.phone,
    jobRole: employee.jobRole,
    monthlySalary: employee.monthlySalary,
    salaryDueDay: employee.salaryDueDay,
    dateOfJoining: employee.dateOfJoining,
    aadhaarLast4: employee.aadhaarLast4 || null,
    isActive: employee.isActive,
  };
}
function publicEmployee(row) {
  return {
    ...row,
    monthlySalary: money2(row.monthlySalary),
    isActive: Boolean(Number(row.isActive)),
    hasAadhaar: Boolean(row.aadhaarLast4),
    photoData: row.photoData || null,
    aadhaarLast4: row.aadhaarLast4 || null,
  };
}
const employeeSelect = `
  SELECT id, name, phone, aadhaar_last4 AS aadhaarLast4, photo_data AS photoData,
    DATE_FORMAT(date_of_joining, '%Y-%m-%d') AS dateOfJoining,
    monthly_salary AS monthlySalary, job_role AS jobRole, salary_due_day AS salaryDueDay,
    is_active AS isActive, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt,
    DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%s') AS updatedAt
  FROM employees
`;
const payrollSelect = `
  SELECT p.id, p.employee_id AS employeeId, e.name AS employeeName, e.job_role AS jobRole,
    e.phone, e.photo_data AS photoData,
    DATE_FORMAT(p.payroll_month, '%Y-%m') AS payrollMonth,
    DATE_FORMAT(p.due_date, '%Y-%m-%d') AS dueDate,
    p.base_salary AS baseSalary, p.deductions, p.payable_amount AS payableAmount,
    p.status, DATE_FORMAT(p.paid_at, '%Y-%m-%dT%H:%i:%s') AS paidAt,
    p.notes, DATE_FORMAT(p.created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt
  FROM employee_payroll p JOIN employees e ON e.id = p.employee_id
`;
const expenseSelect = `
  SELECT x.id, x.employee_id AS employeeId, e.name AS employeeName, e.job_role AS jobRole,
    DATE_FORMAT(x.expense_date, '%Y-%m-%d') AS expenseDate, x.description, x.category,
    x.amount, x.payment_mode AS paymentMode, x.settlement_mode AS settlementMode,
    DATE_FORMAT(x.deduction_month, '%Y-%m') AS deductionMonth,
    DATE_FORMAT(x.created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt, u.name AS recordedBy
  FROM employee_expenses x JOIN employees e ON e.id = x.employee_id
  LEFT JOIN users u ON u.id = x.created_by
`;

router.get('/', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const fromDefault = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const from = String(req.query.from || fromDefault);
    const to = String(req.query.to || today);
    if (!isDate(from) || !isDate(to) || from > to) return res.status(400).json({ error: 'Use valid from/to dates in YYYY-MM-DD format.' });
    const q = String(req.query.q || '').trim();
    const includeInactive = req.query.includeInactive === '1';
    const where = `WHERE (? = '' OR e.name LIKE ? OR e.phone LIKE ? OR e.job_role LIKE ? OR e.aadhaar_last4 LIKE ?) ${includeInactive ? '' : 'AND e.is_active = 1'}`;
    const [employees] = await pool.execute(`
      SELECT e.id, e.name, e.phone, e.aadhaar_last4 AS aadhaarLast4, e.photo_data AS photoData,
        DATE_FORMAT(e.date_of_joining, '%Y-%m-%d') AS dateOfJoining,
        e.monthly_salary AS monthlySalary, e.job_role AS jobRole, e.salary_due_day AS salaryDueDay,
        e.is_active AS isActive, DATE_FORMAT(e.created_at, '%Y-%m-%dT%H:%i:%s') AS createdAt
      FROM employees e ${where}
      ORDER BY e.is_active DESC, e.name LIMIT 250
    `, [q, '%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%']);
    const [employeeCounts] = await pool.execute('SELECT COUNT(*) AS totalEmployees, COALESCE(SUM(monthly_salary),0) AS monthlyPayroll FROM employees WHERE is_active = 1');
    const [paidRows] = await pool.execute(`
      SELECT COALESCE(SUM(payable_amount),0) AS salaryPaid
      FROM employee_payroll WHERE status = 'PAID' AND DATE(paid_at) BETWEEN ? AND ?
    `, [from, to]);
    const [dueRows] = await pool.execute(`
      SELECT COALESCE(SUM(payable_amount),0) AS salaryDue
      FROM employee_payroll WHERE status = 'UNPAID' AND due_date BETWEEN ? AND ?
    `, [from, to]);
    const [expenseRows] = await pool.execute(`
      SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS expenseCount,
        COALESCE(SUM(CASE WHEN settlement_mode = 'COMPANY_PAID' THEN amount ELSE 0 END),0) AS companyPaid,
        COALESCE(SUM(CASE WHEN settlement_mode = 'DEDUCT_NEXT_MONTH' THEN amount ELSE 0 END),0) AS salaryDeductions
      FROM employee_expenses WHERE expense_date BETWEEN ? AND ?
    `, [from, to]);
    res.json({
      period: { from, to },
      employees: employees.map(publicEmployee),
      summary: {
        activeEmployees: Number(employeeCounts[0]?.totalEmployees || 0),
        monthlyPayroll: money2(employeeCounts[0]?.monthlyPayroll || 0),
        salaryPaid: money2(paidRows[0]?.salaryPaid || 0),
        salaryDue: money2(dueRows[0]?.salaryDue || 0),
        expensesTotal: money2(expenseRows[0]?.total || 0),
        companyPaidExpenses: money2(expenseRows[0]?.companyPaid || 0),
        salaryDeductions: money2(expenseRows[0]?.salaryDeductions || 0),
        expenseCount: Number(expenseRows[0]?.expenseCount || 0),
      },
    });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  const body = req.body || {};
  let normalized;
  try {
    normalized = normalizeEmployeeFields(body);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const columns = normalized.fields.map(field => field.split(' = ')[0]).join(', ');
      const sqlColumns = normalized.fields.map(field => field.split(' = ')[0]);
      const dbColumns = { name: 'name', phone: 'phone', date_of_joining: 'date_of_joining', monthly_salary: 'monthly_salary', job_role: 'job_role', salary_due_day: 'salary_due_day', photo_data: 'photo_data', aadhaar_encrypted: 'aadhaar_encrypted', aadhaar_last4: 'aadhaar_last4', is_active: 'is_active' };
      const actualColumns = sqlColumns.map(column => dbColumns[column]).filter(Boolean);
      const [result] = await connection.execute(
        'INSERT INTO employees (' + actualColumns.join(', ') + ', created_by) VALUES (' + actualColumns.map(() => '?').concat('?').join(', ') + ')',
        normalized.values.concat([req.user.sub])
      );
      const [rows] = await connection.execute(employeeSelect + ' WHERE id = ?', [result.insertId]);
      const employee = publicEmployee(rows[0]);
      await connection.execute(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)',
        [req.user.sub, 'EMPLOYEE_CREATED', 'EMPLOYEE', result.insertId, JSON.stringify(auditSummary(employee))]
      );
      await connection.commit();
      res.status(201).json({ employee, message: 'Employee profile created.' });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally { connection.release(); }
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Employee could not be saved.' });
  }
});

router.patch('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid employee ID.' });
  try {
    const { fields, values } = normalizeEmployeeFields(req.body || {}, { partial: true });
    if (!fields.length) return res.status(400).json({ error: 'No employee fields supplied.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [beforeRows] = await connection.execute(employeeSelect + ' WHERE id = ? FOR UPDATE', [id]);
      if (!beforeRows[0]) { await connection.rollback(); return res.status(404).json({ error: 'Employee not found.' }); }
      const before = publicEmployee(beforeRows[0]);
      const map = {
        name: 'name', phone: 'phone', date_of_joining: 'date_of_joining', monthly_salary: 'monthly_salary',
        job_role: 'job_role', salary_due_day: 'salary_due_day', photo_data: 'photo_data',
        aadhaar_encrypted: 'aadhaar_encrypted', aadhaar_last4: 'aadhaar_last4', is_active: 'is_active',
      };
      const assignments = fields.map(field => map[field.split(' = ')[0]]);
      if (assignments.some(column => !column)) throw new Error('Invalid employee field mapping.');
      await connection.execute('UPDATE employees SET ' + assignments.map(column => column + ' = ?').join(', ') + ' WHERE id = ?', [...values, id]);
      const [afterRows] = await connection.execute(employeeSelect + ' WHERE id = ?', [id]);
      const after = publicEmployee(afterRows[0]);
      await connection.execute(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.sub, 'EMPLOYEE_UPDATED', 'EMPLOYEE', id, JSON.stringify(auditSummary(before)), JSON.stringify(auditSummary(after))]
      );
      await connection.commit();
      res.json({ employee: after, message: 'Employee details updated.' });
    } catch (error) {
      await connection.rollback();
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    } finally { connection.release(); }
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Employee could not be updated.' });
  }
});

router.get('/expenses', async (req, res, next) => {
  try {
    const from = String(req.query.from || '1970-01-01');
    const to = String(req.query.to || new Date().toISOString().slice(0, 10));
    if (!isDate(from) || !isDate(to) || from > to) return res.status(400).json({ error: 'Use valid from/to dates in YYYY-MM-DD format.' });
    const [expenses] = await pool.execute(expenseSelect + ' WHERE x.expense_date BETWEEN ? AND ? ORDER BY x.expense_date DESC, x.id DESC LIMIT 500', [from, to]);
    res.json({ expenses: expenses.map(row => ({ ...row, amount: money2(row.amount) })) });
  } catch (error) { next(error); }
});

router.get('/payroll', async (req, res, next) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  if (!isMonth(month)) return res.status(400).json({ error: 'Use a valid payroll month in YYYY-MM format.' });
  try {
    const [rows] = await pool.execute(payrollSelect + ' WHERE p.payroll_month = ? ORDER BY e.is_active DESC, e.name', [month + '-01']);
    res.json({ month, payroll: rows.map(row => ({ ...row, baseSalary: money2(row.baseSalary), deductions: money2(row.deductions), payableAmount: money2(row.payableAmount) })) });
  } catch (error) { next(error); }
});

router.post('/payroll/generate', async (req, res, next) => {
  const month = String(req.body?.month || '');
  if (!isMonth(month)) return res.status(400).json({ error: 'Choose a valid payroll month.' });
  const payrollMonth = month + '-01';
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [employees] = await connection.execute('SELECT id, monthly_salary AS monthlySalary, salary_due_day AS salaryDueDay FROM employees WHERE is_active = 1 ORDER BY id FOR UPDATE');
    let generated = 0;
    let skipped = 0;
    for (const employee of employees) {
      const [existing] = await connection.execute('SELECT id FROM employee_payroll WHERE employee_id = ? AND payroll_month = ? FOR UPDATE', [employee.id, payrollMonth]);
      if (existing[0]) { skipped++; continue; }
      const baseSalary = money2(employee.monthlySalary);
      const dueDate = dateForDueDay(payrollMonth, employee.salaryDueDay);
      const [insert] = await connection.execute(
        "INSERT INTO employee_payroll (employee_id, payroll_month, base_salary, deductions, payable_amount, status, due_date, created_by) VALUES (?, ?, ?, 0, ?, 'UNPAID', ?, ?)",
        [employee.id, payrollMonth, baseSalary, baseSalary, dueDate, req.user.sub]
      );
      let remainingPay = baseSalary;
      let totalDeductions = 0;
      const [deductions] = await connection.execute(`
        SELECT x.id, x.amount,
          COALESCE((SELECT SUM(d.amount) FROM employee_payroll_deductions d WHERE d.expense_id = x.id), 0) AS allocated
        FROM employee_expenses x
        WHERE x.employee_id = ? AND x.settlement_mode = 'DEDUCT_NEXT_MONTH' AND x.deduction_month <= ?
        ORDER BY x.deduction_month, x.id FOR UPDATE
      `, [employee.id, payrollMonth]);
      for (const expense of deductions) {
        const outstanding = money2(Number(expense.amount) - Number(expense.allocated || 0));
        if (outstanding <= 0 || remainingPay <= 0) continue;
        const allocation = money2(Math.min(outstanding, remainingPay));
        if (allocation <= 0) continue;
        await connection.execute('INSERT INTO employee_payroll_deductions (payroll_id, expense_id, amount) VALUES (?, ?, ?)', [insert.insertId, expense.id, allocation]);
        remainingPay = money2(remainingPay - allocation);
        totalDeductions = money2(totalDeductions + allocation);
      }
      await connection.execute('UPDATE employee_payroll SET deductions = ?, payable_amount = ? WHERE id = ?', [totalDeductions, remainingPay, insert.insertId]);
      await connection.execute(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.sub, 'EMPLOYEE_PAYROLL_GENERATED', 'EMPLOYEE_PAYROLL', insert.insertId, JSON.stringify({ employeeId: employee.id, month, baseSalary, deductions: totalDeductions, payableAmount: remainingPay }), 'Monthly payroll generated.']
      );
      generated++;
    }
    await connection.commit();
    res.status(201).json({ month, generated, skipped, message: generated ? 'Payroll generated; scheduled salary deductions were allocated in order.' : 'Payroll already exists for all active employees in this month.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.patch('/payroll/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const notes = req.body?.notes == null ? null : String(req.body.notes).trim() || null;
  if (!validId(id)) return res.status(400).json({ error: 'Invalid payroll record ID.' });
  if (!['PAID', 'UNPAID'].includes(status)) return res.status(400).json({ error: 'Payroll status must be PAID or UNPAID.' });
  if (notes && notes.length > 500) return res.status(400).json({ error: 'Payroll notes must be 500 characters or fewer.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(payrollSelect + ' WHERE p.id = ? FOR UPDATE', [id]);
    if (!rows[0]) { await connection.rollback(); return res.status(404).json({ error: 'Payroll record not found. Generate this month first.' }); }
    const before = rows[0];
    await connection.execute(
      "UPDATE employee_payroll SET status = ?, paid_at = CASE WHEN ? = 'PAID' THEN CURRENT_TIMESTAMP ELSE NULL END, marked_by = ?, notes = ? WHERE id = ?",
      [status, status, req.user.sub, notes ?? before.notes, id]
    );
    const [afterRows] = await connection.execute(payrollSelect + ' WHERE p.id = ?', [id]);
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.sub, status === 'PAID' ? 'EMPLOYEE_SALARY_MARKED_PAID' : 'EMPLOYEE_SALARY_MARKED_UNPAID', 'EMPLOYEE_PAYROLL', id, JSON.stringify({ status: before.status, paidAt: before.paidAt, payableAmount: before.payableAmount }), JSON.stringify({ status, paidAt: afterRows[0].paidAt, payableAmount: afterRows[0].payableAmount })]
    );
    await connection.commit();
    const after = afterRows[0];
    res.json({ payroll: { ...after, baseSalary: money2(after.baseSalary), deductions: money2(after.deductions), payableAmount: money2(after.payableAmount) }, message: status === 'PAID' ? 'Salary marked as paid.' : 'Salary marked as unpaid.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.post('/:id/expenses', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid employee ID.' });
  const body = req.body || {};
  const expenseDate = String(body.expenseDate || new Date().toISOString().slice(0, 10));
  const description = String(body.description || '').trim();
  const category = String(body.category || 'Other').trim();
  const amount = Number(body.amount);
  const settlementMode = String(body.settlementMode || '');
  let paymentMode = String(body.paymentMode || '');
  if (!isDate(expenseDate)) return res.status(400).json({ error: 'Enter a valid expense date.' });
  if (!description || description.length > 255) return res.status(400).json({ error: 'Expense description is required (max 255 characters).' });
  if (!category || category.length > 100) return res.status(400).json({ error: 'Expense category is required (max 100 characters).' });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999999999) return res.status(400).json({ error: 'Expense amount must be a positive valid amount.' });
  if (!['COMPANY_PAID', 'DEDUCT_NEXT_MONTH'].includes(settlementMode)) return res.status(400).json({ error: 'Choose a valid expense treatment.' });
  if (settlementMode === 'COMPANY_PAID' && !['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'].includes(paymentMode)) return res.status(400).json({ error: 'Choose how the company paid this expense.' });
  if (settlementMode === 'DEDUCT_NEXT_MONTH') paymentMode = '';
  const deductionMonth = settlementMode === 'DEDUCT_NEXT_MONTH' ? nextMonth(expenseDate) : null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [employees] = await connection.execute('SELECT id, name FROM employees WHERE id = ? FOR UPDATE', [id]);
    if (!employees[0]) { await connection.rollback(); return res.status(404).json({ error: 'Employee not found.' }); }
    if (deductionMonth) {
      const [existing] = await connection.execute('SELECT id FROM employee_payroll WHERE employee_id = ? AND payroll_month = ? LIMIT 1 FOR UPDATE', [id, deductionMonth]);
      if (existing[0]) {
        await connection.rollback();
        return res.status(409).json({ error: 'Payroll for ' + deductionMonth.slice(0, 7) + ' has already been generated. This expense cannot be added to that locked payroll; record it for the next salary cycle instead.' });
      }
    }
    const [result] = await connection.execute(
      'INSERT INTO employee_expenses (employee_id, expense_date, description, category, amount, payment_mode, settlement_mode, deduction_month, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, expenseDate, description, category, money2(amount), paymentMode || null, settlementMode, deductionMonth, req.user.sub]
    );
    const [rows] = await connection.execute(expenseSelect + ' WHERE x.id = ?', [result.insertId]);
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'EMPLOYEE_EXPENSE_RECORDED', 'EMPLOYEE', id, JSON.stringify({ expenseId: result.insertId, description, amount: money2(amount), category, settlementMode, paymentMode: paymentMode || null, deductionMonth }), description]
    );
    await connection.commit();
    res.status(201).json({ expense: { ...rows[0], amount: money2(rows[0].amount) }, message: settlementMode === 'DEDUCT_NEXT_MONTH' ? 'Expense recorded; the deduction is scheduled from ' + deductionMonth.slice(0, 7) + ' payroll.' : 'Employee expense recorded.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid employee ID.' });
  try {
    const [rows] = await pool.execute(employeeSelect + ' WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Employee not found.' });
    const [expenses] = await pool.execute(expenseSelect + ' WHERE x.employee_id = ? ORDER BY x.expense_date DESC, x.id DESC LIMIT 100', [id]);
    const [payroll] = await pool.execute(payrollSelect + ' WHERE p.employee_id = ? ORDER BY p.payroll_month DESC LIMIT 48', [id]);
    const [deductions] = await pool.execute(`
      SELECT d.payroll_id AS payrollId, d.expense_id AS expenseId, d.amount,
        x.description, DATE_FORMAT(x.deduction_month, '%Y-%m') AS scheduledMonth
      FROM employee_payroll_deductions d JOIN employee_expenses x ON x.id = d.expense_id
      JOIN employee_payroll p ON p.id = d.payroll_id
      WHERE p.employee_id = ? ORDER BY p.payroll_month DESC, d.id
    `, [id]);
    res.json({
      employee: publicEmployee(rows[0]),
      expenses: expenses.map(row => ({ ...row, amount: money2(row.amount) })),
      payroll: payroll.map(row => ({ ...row, baseSalary: money2(row.baseSalary), deductions: money2(row.deductions), payableAmount: money2(row.payableAmount) })),
      deductions: deductions.map(row => ({ ...row, amount: money2(row.amount) })),
    });
  } catch (error) { next(error); }
});

export default router;
