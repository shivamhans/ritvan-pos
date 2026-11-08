import { Router } from 'express';
import { pool } from '../db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Point of Sale', 'Customers'], ['Customers']));
const clean = value => value == null ? null : String(value).trim() || null;
const boolValue = value => Boolean(Number(value));

function parseBoolean(value, label) {
  if (![true, false, 0, 1].includes(value)) {
    throw Object.assign(new Error(label + ' must be a boolean.'), { status: 400 });
  }
  return Boolean(value);
}

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const includeInactive = req.query.includeInactive === '1' && ['Admin', 'Manager'].includes(req.user.role);
    const visibleCustomerFilter = includeInactive ? '' : 'WHERE c.is_active = 1';
    const [customers] = await pool.execute(`
      SELECT c.id, c.name, c.email, c.phone, c.notes,
        c.is_business AS isBusiness, c.is_active AS isActive,
        COUNT(DISTINCT CASE WHEN s.status = 'COMPLETED' THEN s.id END) AS orderCount,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END),0) AS totalSpent,
        COALESCE(SUM(CASE WHEN c.is_business = 1 AND s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END),0) AS businessSales,
        MAX(CASE WHEN s.status = 'COMPLETED' THEN s.completed_at END) AS lastPurchaseAt,
        COALESCE((SELECT SUM(CASE WHEN l.entry_type = 'CREDIT_SALE' THEN l.amount ELSE -l.amount END)
          FROM customer_credit_ledger l WHERE l.customer_id = c.id), 0) AS outstandingBalance
      FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
      WHERE (? = '' OR c.name LIKE ? OR COALESCE(c.email,'') LIKE ? OR COALESCE(c.phone,'') LIKE ?)
        ${includeInactive ? '' : 'AND c.is_active = 1'}
      GROUP BY c.id ORDER BY c.is_business DESC, c.name LIMIT 250
    `, [q, `%${q}%`, `%${q}%`, `%${q}%`]);
    const [summaryRows] = await pool.execute(`
      SELECT COUNT(DISTINCT c.id) AS recordCount,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END),0) AS totalCustomerSpend,
        COALESCE(SUM(CASE WHEN c.is_business = 1 AND s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END),0) AS businessSales
      FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
      ${visibleCustomerFilter}
    `);
    const canViewCustomerAnalytics = req.user.role === 'Admin' || req.user.permissions?.modules?.includes('Customers');
    const mayViewKhata = req.user.role === 'Admin' || (
      req.user.permissions?.modules?.includes('Customers') &&
      req.user.permissions?.columns?.Customers?.includes('outstandingBalance')
    );
    const safeCustomers = customers.map(row => ({
      ...row,
      isBusiness: boolValue(row.isBusiness),
      isActive: boolValue(row.isActive),
    })).map(row => {
      if (!canViewCustomerAnalytics) {
        const { orderCount: _orders, totalSpent: _totalSpent, businessSales: _businessSales, lastPurchaseAt: _lastPurchase, ...posCustomer } = row;
        return posCustomer;
      }
      if (mayViewKhata) return row;
      const { outstandingBalance: _hiddenOutstandingBalance, ...safeCustomer } = row;
      return safeCustomer;
    });
    const rawSummary = summaryRows[0] || {};
    res.json({
      customers: safeCustomers,
      summary: canViewCustomerAnalytics ? {
        recordCount: Number(rawSummary.recordCount || 0),
        totalCustomerSpend: Number(Number(rawSummary.totalCustomerSpend || 0).toFixed(2)),
        businessSales: Number(Number(rawSummary.businessSales || 0).toFixed(2)),
      } : null,
    });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = clean(req.body?.email)?.toLowerCase() || null;
    const phone = clean(req.body?.phone);
    const notes = clean(req.body?.notes);
    let isBusiness;
    try { isBusiness = parseBoolean(req.body?.isBusiness ?? false, 'isBusiness'); }
    catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
    if (!name || name.length > 180) return res.status(400).json({ error: 'Customer name is required (max 180 characters).' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (isBusiness && !['Admin', 'Manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Admins and Managers can mark a customer as a business.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO customers (name, email, phone, notes, is_business) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, notes, isBusiness ? 1 : 0]
    );
    const audit = { name, email, phone, notes, isBusiness };
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)',
      [req.user.sub, 'CUSTOMER_CREATED', 'CUSTOMER', result.insertId, JSON.stringify(audit)]
    );
    res.status(201).json({
      customer: {
        id: result.insertId, name, email, phone, notes, isBusiness,
        isActive: true, orderCount: 0, totalSpent: 0, businessSales: 0, outstandingBalance: 0,
      },
    });
  } catch (error) { next(error); }
});

router.patch('/:id', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid customer ID.' });
  const map = { name: 'name', email: 'email', phone: 'phone', notes: 'notes', isBusiness: 'is_business', isActive: 'is_active' };
  const fields = []; const values = [];
  for (const [key, column] of Object.entries(map)) {
    if (!Object.hasOwn(req.body || {}, key)) continue;
    let value = req.body[key];
    if (key === 'isActive' || key === 'isBusiness') {
      try { value = parseBoolean(value, key === 'isBusiness' ? 'Business customer flag' : 'isActive'); }
      catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
      value = value ? 1 : 0;
    } else {
      value = clean(value);
      if (key === 'name' && (!value || value.length > 180)) return res.status(400).json({ error: 'Customer name is required (max 180 characters).' });
      if (key === 'email' && value) {
        value = value.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ error: 'Enter a valid email address.' });
      }
    }
    fields.push(`${column} = ?`); values.push(value);
  }
  if (!fields.length) return res.status(400).json({ error: 'No editable customer fields supplied.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, name, email, phone, notes, is_business AS isBusiness, is_active AS isActive FROM customers WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!rows[0]) { await connection.rollback(); return res.status(404).json({ error: 'Customer not found.' }); }
    const before = { ...rows[0], isBusiness: boolValue(rows[0].isBusiness), isActive: boolValue(rows[0].isActive) };
    await connection.execute(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    const [afterRows] = await connection.execute(
      'SELECT id, name, email, phone, notes, is_business AS isBusiness, is_active AS isActive FROM customers WHERE id = ?',
      [id]
    );
    const after = { ...afterRows[0], isBusiness: boolValue(afterRows[0].isBusiness), isActive: boolValue(afterRows[0].isActive) };
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'CUSTOMER_UPDATED', 'CUSTOMER', id, JSON.stringify(before), JSON.stringify(after)]
    );
    await connection.commit();
    res.json({ customer: after });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

export default router;
