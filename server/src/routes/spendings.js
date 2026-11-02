import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'];
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(String(value) + 'T00:00:00Z'));
const money2 = value => Number(Number(value || 0).toFixed(2));
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const dateOnly = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
const normalize = row => ({
  id: Number(row.id),
  spendingDate: dateOnly(row.spendingDate),
  category: row.category,
  description: row.description,
  amount: money2(row.amount),
  paymentMode: row.paymentMode,
  paidTo: row.paidTo || '',
  referenceNo: row.referenceNo || '',
  notes: row.notes || '',
  status: row.status,
  voidReason: row.voidReason || '',
  createdBy: row.createdBy || '—',
  updatedBy: row.updatedBy || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

router.use(requireAuth, requireModuleAccessFor(['Spendings'], ['Spendings']));
router.use((req, res, next) => {
  if (['Admin', 'Manager'].includes(req.user.role)) return next();
  return res.status(403).json({ error: 'Only Admins and Managers can view or manage operating spendings.' });
});

async function writeAudit(connection, userId, action, id, before, after, reason = null) {
  await connection.execute(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, action, 'SPENDING', id, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, reason]
  );
}

function validatePayload(body = {}) {
  const spendingDate = String(body.spendingDate || '').trim();
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);
  const paymentMode = String(body.paymentMode || '').trim().toUpperCase();
  const paidTo = String(body.paidTo || '').trim();
  const referenceNo = String(body.referenceNo || '').trim();
  const notes = String(body.notes || '').trim();
  if (!isoDate(spendingDate)) return { error: 'Choose a valid spending date.' };
  if (!category || category.length > 100) return { error: 'Category is required and must be 100 characters or fewer.' };
  if (description.length < 3 || description.length > 255) return { error: 'Enter a reason of 3–255 characters.' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999999.99) return { error: 'Enter a valid amount greater than zero.' };
  if (!PAYMENT_MODES.includes(paymentMode)) return { error: 'Choose a valid payment mode.' };
  if (paidTo.length > 140 || referenceNo.length > 120 || notes.length > 500) return { error: 'One or more optional fields exceed their allowed length.' };
  return { values: { spendingDate, category, description, amount: money2(amount), paymentMode, paidTo: paidTo || null, referenceNo: referenceNo || null, notes: notes || null } };
}

router.get('/', async (req, res, next) => {
  try {
    const today = new Date();
    const toDefault = today.toISOString().slice(0, 10);
    const start = new Date(today); start.setUTCDate(start.getUTCDate() - 29);
    const fromDefault = start.toISOString().slice(0, 10);
    const from = String(req.query.from || fromDefault);
    const to = String(req.query.to || toDefault);
    if (!isoDate(from) || !isoDate(to) || from > to) return res.status(400).json({ error: 'Use valid from/to dates, with from on or before to.' });
    if ((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 > 365) {
      return res.status(400).json({ error: 'Spending date range cannot exceed 366 days.' });
    }
    const status = String(req.query.status || 'ALL').toUpperCase();
    if (!['ALL', 'RECORDED', 'VOID'].includes(status)) return res.status(400).json({ error: 'Invalid spending status filter.' });
    const statusSql = status === 'ALL' ? '' : ' AND s.status = ?';
    const params = status === 'ALL' ? [from, to] : [from, to, status];
    const [rows] = await pool.execute(`
      SELECT s.id, s.spending_date AS spendingDate, s.category, s.description, s.amount,
        s.payment_mode AS paymentMode, s.paid_to AS paidTo, s.reference_no AS referenceNo,
        s.notes, s.status, s.void_reason AS voidReason, creator.name AS createdBy,
        updater.name AS updatedBy, s.created_at AS createdAt, s.updated_at AS updatedAt
      FROM spendings s LEFT JOIN users creator ON creator.id = s.created_by
      LEFT JOIN users updater ON updater.id = s.updated_by
      WHERE s.spending_date BETWEEN ? AND ?${statusSql}
      ORDER BY s.spending_date DESC, s.id DESC LIMIT 500
    `, params);
    const [summaryRows] = await pool.execute(`
      SELECT COUNT(*) AS spendingCount, COALESCE(SUM(amount), 0) AS totalAmount,
        COALESCE(SUM(CASE WHEN spending_date = CURDATE() THEN amount ELSE 0 END), 0) AS todayAmount,
        COALESCE(SUM(CASE WHEN DATE_FORMAT(spending_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN amount ELSE 0 END), 0) AS monthAmount
      FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
    `, [from, to]);
    const [categoryRows] = await pool.execute(`
      SELECT category, COUNT(*) AS recordCount, COALESCE(SUM(amount), 0) AS amount
      FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
      GROUP BY category ORDER BY amount DESC, category LIMIT 12
    `, [from, to]);
    const [paymentRows] = await pool.execute(`
      SELECT payment_mode AS paymentMode, COUNT(*) AS recordCount, COALESCE(SUM(amount), 0) AS amount
      FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
      GROUP BY payment_mode ORDER BY amount DESC
    `, [from, to]);
    const summary = summaryRows[0];
    res.json({
      period: { from, to },
      summary: {
        spendingCount: Number(summary.spendingCount || 0),
        totalAmount: money2(summary.totalAmount),
        todayAmount: money2(summary.todayAmount),
        monthAmount: money2(summary.monthAmount),
        categories: categoryRows.map(row => ({ category: row.category, recordCount: Number(row.recordCount), amount: money2(row.amount) })),
        paymentModes: paymentRows.map(row => ({ paymentMode: row.paymentMode, recordCount: Number(row.recordCount), amount: money2(row.amount) })),
      },
      spendings: rows.map(normalize),
      limit: 500,
    });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE' && String(error.message || '').includes('spendings')) {
      return res.status(503).json({ error: 'The spendings table is not installed yet. Back up the database, then run the updated database/ritvan-pos-all-in-one.sql against the active Ritvan database.' });
    }
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const checked = validatePayload(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const v = checked.values;
    const [result] = await connection.execute(`
      INSERT INTO spendings (spending_date, category, description, amount, payment_mode, paid_to, reference_no, notes, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [v.spendingDate, v.category, v.description, v.amount, v.paymentMode, v.paidTo, v.referenceNo, v.notes, req.user.sub, req.user.sub]);
    const id = Number(result.insertId);
    const after = { ...v, id, status: 'RECORDED' };
    await writeAudit(connection, req.user.sub, 'SPENDING_CREATED', id, null, after, v.description);
    await connection.commit();
    res.status(201).json({ spending: after, message: 'Spending recorded.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.patch('/:id', async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid spending ID.' });
  const checked = validatePayload(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, spending_date AS spendingDate, category, description, amount, payment_mode AS paymentMode, paid_to AS paidTo, reference_no AS referenceNo, notes, status FROM spendings WHERE id = ? FOR UPDATE', [req.params.id]);
    const before = rows[0];
    if (!before) { await connection.rollback(); return res.status(404).json({ error: 'Spending record was not found.' }); }
    if (before.status !== 'RECORDED') { await connection.rollback(); return res.status(409).json({ error: 'Voided spending records cannot be edited.' }); }
    const v = checked.values;
    await connection.execute(`
      UPDATE spendings SET spending_date = ?, category = ?, description = ?, amount = ?,
        payment_mode = ?, paid_to = ?, reference_no = ?, notes = ?, updated_by = ?
      WHERE id = ?
    `, [v.spendingDate, v.category, v.description, v.amount, v.paymentMode, v.paidTo, v.referenceNo, v.notes, req.user.sub, req.params.id]);
    const after = { id: Number(req.params.id), ...v, status: 'RECORDED' };
    await writeAudit(connection, req.user.sub, 'SPENDING_UPDATED', Number(req.params.id), before, after, v.description);
    await connection.commit();
    res.json({ spending: after, message: 'Spending updated.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

router.post('/:id/void', async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid spending ID.' });
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'Enter a void reason of 5–500 characters.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, spending_date AS spendingDate, category, description, amount, payment_mode AS paymentMode, status FROM spendings WHERE id = ? FOR UPDATE', [req.params.id]);
    const before = rows[0];
    if (!before) { await connection.rollback(); return res.status(404).json({ error: 'Spending record was not found.' }); }
    if (before.status !== 'RECORDED') { await connection.rollback(); return res.status(409).json({ error: 'This spending record is already voided.' }); }
    await connection.execute("UPDATE spendings SET status = 'VOID', void_reason = ?, updated_by = ? WHERE id = ?", [reason, req.user.sub, req.params.id]);
    const after = { ...before, id: Number(req.params.id), status: 'VOID', voidReason: reason };
    await writeAudit(connection, req.user.sub, 'SPENDING_VOIDED', Number(req.params.id), before, after, reason);
    await connection.commit();
    res.json({ spending: after, message: 'Spending voided. The original record remains in history.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

export default router;
