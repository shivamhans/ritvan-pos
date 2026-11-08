import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Dashboard', 'Point of Sale', 'Items', 'Categories', 'Purchases'], ['Categories']));

router.get('/', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === '1' && ['Admin', 'Manager'].includes(req.user.role);
    const [rows] = await pool.execute(`
      SELECT c.id, c.name, c.description, c.is_active AS isActive, COUNT(i.id) AS itemCount
      FROM categories c LEFT JOIN items i ON i.category_id = c.id
      ${includeInactive ? '' : 'WHERE c.is_active = 1'}
      GROUP BY c.id, c.name, c.description, c.is_active ORDER BY c.name
    `);
    res.json({ categories: rows });
  } catch (error) { next(error); }
});

router.post('/', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const description = req.body?.description == null ? null : String(req.body.description).trim();
    if (!name || name.length > 120) return res.status(400).json({ error: 'Category name is required (max 120 characters).' });
    if (description?.length > 500) return res.status(400).json({ error: 'Description must be 500 characters or fewer.' });
    const [result] = await pool.execute('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
    await pool.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)', [req.user.sub, 'CATEGORY_CREATED', 'CATEGORY', result.insertId, JSON.stringify({ name, description })]);
    res.status(201).json({ category: { id: result.insertId, name, description, isActive: 1, itemCount: 0 } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A category with this name already exists.' });
    next(error);
  }
});

router.patch('/:id', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid category ID.' });
  const fields = [];
  const values = [];
  if (Object.hasOwn(req.body || {}, 'name')) {
    const name = String(req.body.name || '').trim();
    if (!name || name.length > 120) return res.status(400).json({ error: 'Category name is required (max 120 characters).' });
    fields.push('name = ?'); values.push(name);
  }
  if (Object.hasOwn(req.body || {}, 'description')) {
    const description = req.body.description == null ? null : String(req.body.description).trim();
    if (description?.length > 500) return res.status(400).json({ error: 'Description must be 500 characters or fewer.' });
    fields.push('description = ?'); values.push(description || null);
  }
  if (Object.hasOwn(req.body || {}, 'isActive')) {
    if (![true, false, 0, 1].includes(req.body.isActive)) return res.status(400).json({ error: 'isActive must be a boolean.' });
    fields.push('is_active = ?'); values.push(req.body.isActive ? 1 : 0);
  }
  if (!fields.length) return res.status(400).json({ error: 'Provide name, description, or isActive to update.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, name, description, is_active AS isActive FROM categories WHERE id = ? FOR UPDATE', [id]);
    if (!rows[0]) { await connection.rollback(); return res.status(404).json({ error: 'Category not found.' }); }
    const before = rows[0];
    await connection.execute(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    const [updated] = await connection.execute('SELECT id, name, description, is_active AS isActive FROM categories WHERE id = ?', [id]);
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)', [req.user.sub, 'CATEGORY_UPDATED', 'CATEGORY', id, JSON.stringify(before), JSON.stringify(updated[0])]);
    await connection.commit();
    res.json({ category: updated[0] });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A category with this name already exists.' });
    next(error);
  } finally { connection.release(); }
});

export default router;
