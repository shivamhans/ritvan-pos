import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Purchases', 'Suppliers'], ['Suppliers']));
const clean = value => value == null ? null : String(value).trim() || null;

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const includeInactive = req.query.includeInactive === '1' && ['Admin', 'Manager'].includes(req.user.role);
    const [suppliers] = await pool.execute(`
      SELECT s.id, s.name, s.contact_name AS contactName, s.email, s.phone, s.address, s.notes, s.is_active AS isActive,
        COUNT(DISTINCT p.id) AS purchaseCount, MAX(p.purchase_date) AS lastPurchaseDate
      FROM suppliers s LEFT JOIN purchases p ON p.supplier_id = s.id
      WHERE (? = '' OR s.name LIKE ? OR COALESCE(s.contact_name,'') LIKE ? OR COALESCE(s.email,'') LIKE ? OR COALESCE(s.phone,'') LIKE ?)
        ${includeInactive ? '' : 'AND s.is_active = 1'}
      GROUP BY s.id ORDER BY s.name LIMIT 250
    `, [q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
    res.json({ suppliers });
  } catch (error) { next(error); }
});

router.post('/', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const contactName = clean(req.body?.contactName);
    const email = clean(req.body?.email)?.toLowerCase() || null;
    const phone = clean(req.body?.phone);
    const address = clean(req.body?.address);
    const notes = clean(req.body?.notes);
    if (!name || name.length > 180) return res.status(400).json({ error: 'Supplier name is required (max 180 characters).' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if ([contactName, email, phone].some(v => v && v.length > 190)) return res.status(400).json({ error: 'Contact fields exceed the allowed length.' });
    const [r] = await pool.execute('INSERT INTO suppliers (name, contact_name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?)', [name, contactName, email, phone, address, notes]);
    await pool.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)', [req.user.sub, 'SUPPLIER_CREATED', 'SUPPLIER', r.insertId, JSON.stringify({ name, contactName, email, phone })]);
    res.status(201).json({ supplier: { id: r.insertId, name, contactName, email, phone, address, notes, isActive: 1, purchaseCount: 0 } });
  } catch (error) { next(error); }
});

router.patch('/:id', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid supplier ID.' });
  const map = { name: 'name', contactName: 'contact_name', email: 'email', phone: 'phone', address: 'address', notes: 'notes', isActive: 'is_active' };
  const fields = []; const values = [];
  for (const [key, column] of Object.entries(map)) {
    if (!Object.hasOwn(req.body || {}, key)) continue;
    let value = req.body[key];
    if (key === 'isActive') {
      if (![true, false, 0, 1].includes(value)) return res.status(400).json({ error: 'isActive must be a boolean.' });
      value = value ? 1 : 0;
    } else {
      value = clean(value);
      if (key === 'name' && (!value || value.length > 180)) return res.status(400).json({ error: 'Supplier name is required (max 180 characters).' });
      if (key === 'email' && value) {
        value = value.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ error: 'Enter a valid email address.' });
      }
    }
    fields.push(`${column} = ?`); values.push(value);
  }
  if (!fields.length) return res.status(400).json({ error: 'No editable supplier fields supplied.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, name, contact_name AS contactName, email, phone, address, notes, is_active AS isActive FROM suppliers WHERE id = ? FOR UPDATE', [id]);
    if (!rows[0]) { await connection.rollback(); return res.status(404).json({ error: 'Supplier not found.' }); }
    const before = rows[0];
    await connection.execute(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    const [after] = await connection.execute('SELECT id, name, contact_name AS contactName, email, phone, address, notes, is_active AS isActive FROM suppliers WHERE id = ?', [id]);
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)', [req.user.sub, 'SUPPLIER_UPDATED', 'SUPPLIER', id, JSON.stringify(before), JSON.stringify(after[0])]);
    await connection.commit();
    res.json({ supplier: after[0] });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

export default router;
