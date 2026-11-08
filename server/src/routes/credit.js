import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth);
const money2 = value => Number(Number(value || 0).toFixed(2));
const canViewKhata = user => user?.role === 'Admin' || (
  user?.permissions?.modules?.includes('Customers') &&
  user?.permissions?.columns?.Customers?.includes('outstandingBalance')
);

async function getCustomerBalance(connection, customerId, lockCustomer = false) {
  if (lockCustomer) {
    // Lock the customer row to serialize balance-changing operations. Repayment remains
    // allowed for inactive customers so an existing debt can still be settled.
    const [customers] = await connection.execute('SELECT id FROM customers WHERE id = ? FOR UPDATE', [customerId]);
    if (!customers[0]) return { error: 'Customer not found.' };
  }
  const [rows] = await connection.execute(`
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_SALE' THEN amount ELSE -amount END), 0) AS balance
    FROM customer_credit_ledger WHERE customer_id = ?
  `, [customerId]);
  return { balance: money2(rows[0]?.balance || 0) };
}

router.get('/summary', requireModuleAccessFor(['Dashboard', 'Customers']), async (req, res, next) => {
  if (!canViewKhata(req.user)) return res.status(403).json({ error: 'Your account is not allowed to view Khata balances.' });
  try {
    const [rows] = await pool.execute(`
      SELECT COALESCE(SUM(balance), 0) AS outstandingTotal, COUNT(*) AS customersOwing
      FROM (
        SELECT customer_id, SUM(CASE WHEN entry_type = 'CREDIT_SALE' THEN amount ELSE -amount END) AS balance
        FROM customer_credit_ledger GROUP BY customer_id
      ) balances WHERE balance > 0
    `);
    res.json({ outstandingTotal: money2(rows[0]?.outstandingTotal || 0), customersOwing: Number(rows[0]?.customersOwing || 0) });
  } catch (error) { next(error); }
});

router.get('/customers/:id/ledger', requireModuleAccessFor(['Customers', 'Point of Sale']), async (req, res, next) => {
  const customerId = Number(req.params.id);
  if (!Number.isSafeInteger(customerId) || customerId < 1) return res.status(400).json({ error: 'Invalid customer ID.' });
  if (!canViewKhata(req.user)) return res.status(403).json({ error: 'Your account is not allowed to view individual Khata ledgers.' });
  try {
    const [customerRows] = await pool.execute('SELECT id, name, phone FROM customers WHERE id = ?', [customerId]);
    if (!customerRows[0]) return res.status(404).json({ error: 'Customer not found.' });
    const [entries] = await pool.execute(`
      SELECT id, entry_type AS entryType, sale_id AS saleId, amount, method, reference_no AS referenceNo, notes, created_at AS createdAt
      FROM customer_credit_ledger WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 250
    `, [customerId]);
    const balance = await getCustomerBalance(pool, customerId);
    res.json({ customer: customerRows[0], entries, outstandingBalance: balance.balance });
  } catch (error) { next(error); }
});

router.post('/repayments', requireModuleAccessFor(['Customers'], ['Customers']), async (req, res, next) => {
  const customerId = Number(req.body?.customerId);
  if (!canViewKhata(req.user)) return res.status(403).json({ error: 'Your account is not allowed to record Khata repayments.' });
  const amount = Number(req.body?.amount);
  const method = String(req.body?.method || '');
  const referenceNo = req.body?.referenceNo == null ? null : String(req.body.referenceNo).trim() || null;
  const notes = req.body?.notes == null ? null : String(req.body.notes).trim() || null;
  if (!Number.isSafeInteger(customerId) || customerId < 1) return res.status(400).json({ error: 'Choose a registered customer.' });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999999) return res.status(400).json({ error: 'Repayment amount must be a positive valid amount.' });
  if (!['Cash', 'UPI', 'Card'].includes(method)) return res.status(400).json({ error: 'Choose Cash, UPI, or Card as the repayment method.' });
  if (referenceNo && referenceNo.length > 120) return res.status(400).json({ error: 'Payment reference must be 120 characters or fewer.' });
  if (notes && notes.length > 500) return res.status(400).json({ error: 'Notes must be 500 characters or fewer.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const current = await getCustomerBalance(connection, customerId, true);
    if (current.error) { await connection.rollback(); return res.status(404).json({ error: current.error }); }
    if (current.balance <= 0) { await connection.rollback(); return res.status(409).json({ error: 'This customer has no outstanding Khata balance.' }); }
    const roundedAmount = money2(amount);
    if (roundedAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Repayment amount must be at least 0.01.' });
    }
    if (roundedAmount > current.balance) { await connection.rollback(); return res.status(400).json({ error: `Repayment cannot exceed the outstanding balance of ${current.balance.toFixed(2)}.` }); }
    const [result] = await connection.execute(`
      INSERT INTO customer_credit_ledger (customer_id, sale_id, entry_type, amount, method, reference_no, notes, created_by)
      VALUES (?, NULL, 'REPAYMENT', ?, ?, ?, ?, ?)
    `, [customerId, roundedAmount, method.toUpperCase(), referenceNo, notes, req.user.sub]);
    const nextBalance = money2(current.balance - roundedAmount);
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'CUSTOMER_KHATA_REPAYMENT', 'CUSTOMER', customerId, JSON.stringify({ outstandingBalance: current.balance }), JSON.stringify({ outstandingBalance: nextBalance, repaymentAmount: roundedAmount, method }), notes || `Repayment ledger entry ${result.insertId}`]
    );
    await connection.commit();
    res.status(201).json({ repayment: { id: result.insertId, customerId, amount: roundedAmount, method, referenceNo, notes }, outstandingBalance: nextBalance, message: nextBalance === 0 ? 'Khata balance fully settled.' : 'Repayment recorded.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

export default router;
