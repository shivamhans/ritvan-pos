import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { effectivePermissions, validatePermissions } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, allowRoles('Admin'));
const validRoles = new Set(['Admin', 'Manager', 'Cashier']);
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const [staff] = await pool.execute(`
      SELECT id, name, email, role, permissions_json AS permissionsJson, is_active AS isActive, last_login_at AS lastLoginAt, created_at AS createdAt
      FROM users
      WHERE (? = '' OR name LIKE ? OR email LIKE ? OR role LIKE ?)
      ORDER BY is_active DESC, role, name LIMIT 250
    `, [q, '%' + q + '%', '%' + q + '%', '%' + q + '%']);
    res.json({ staff: staff.map(row => ({ id: row.id, name: row.name, email: row.email, role: row.role, permissions: effectivePermissions(row.role, row.permissionsJson), isActive: row.isActive, lastLoginAt: row.lastLoginAt, createdAt: row.createdAt })) });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || 'Cashier');
    if (!name || name.length > 140) return res.status(400).json({ error: 'Name is required (max 140 characters).' });
    if (!validEmail(email) || email.length > 190) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 12 || password.length > 200) return res.status(400).json({ error: 'Password must be 12–200 characters long.' });
    if (!validRoles.has(role)) return res.status(400).json({ error: 'Role must be Admin, Manager, or Cashier.' });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
    await pool.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)',
      [req.user.sub, 'STAFF_CREATED', 'USER', result.insertId, JSON.stringify({ name, email, role })]);
    res.status(201).json({ staff: { id: result.insertId, name, email, role, permissions: effectivePermissions(role, null), isActive: 1, lastLoginAt: null } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A staff account with that email already exists.' });
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid staff ID.' });
  const body = req.body || {};
  const allowed = ['name', 'email', 'role', 'isActive', 'password', 'permissions'];
  if (!allowed.some(key => Object.hasOwn(body, key))) return res.status(400).json({ error: 'Provide name, email, role, isActive, password, or permissions.' });
  try {
    if (Object.hasOwn(body, 'name') && (!String(body.name || '').trim() || String(body.name).trim().length > 140)) return res.status(400).json({ error: 'Name is required (max 140 characters).' });
    if (Object.hasOwn(body, 'email') && (!validEmail(String(body.email || '').trim()) || String(body.email).trim().length > 190)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (Object.hasOwn(body, 'role') && !validRoles.has(String(body.role))) return res.status(400).json({ error: 'Role must be Admin, Manager, or Cashier.' });
    if (Object.hasOwn(body, 'isActive') && ![true, false, 0, 1].includes(body.isActive)) return res.status(400).json({ error: 'isActive must be a boolean.' });
    if (Object.hasOwn(body, 'password') && (String(body.password).length < 12 || String(body.password).length > 200)) return res.status(400).json({ error: 'New password must be 12–200 characters long.' });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT id, name, email, role, permissions_json AS permissionsJson, is_active AS isActive FROM users WHERE id = ? FOR UPDATE', [id]);
      const before = rows[0];
      if (!before) { await connection.rollback(); return res.status(404).json({ error: 'Staff account not found.' }); }
      const nextRole = Object.hasOwn(body, 'role') ? String(body.role) : before.role;
      let nextPermissions = effectivePermissions(nextRole, before.permissionsJson);
      if (Object.hasOwn(body, 'permissions')) {
        const validation = validatePermissions(nextRole, body.permissions);
        if (validation.error) { await connection.rollback(); return res.status(400).json({ error: validation.error }); }
        nextPermissions = validation.permissions;
      }
      const nextActive = Object.hasOwn(body, 'isActive') ? Boolean(body.isActive) : Boolean(Number(before.isActive));
      if (id === Number(req.user.sub) && (nextRole !== 'Admin' || !nextActive)) {
        await connection.rollback();
        return res.status(400).json({ error: 'You cannot demote or deactivate your own Admin account.' });
      }
      if (before.role === 'Admin' && Boolean(Number(before.isActive)) && (nextRole !== 'Admin' || !nextActive)) {
        const [admins] = await connection.execute("SELECT id FROM users WHERE role = 'Admin' AND is_active = 1 FOR UPDATE");
        if (admins.length <= 1) { await connection.rollback(); return res.status(409).json({ error: 'The last active Admin cannot be demoted or deactivated.' }); }
      }
      const fields = [];
      const values = [];
      if (Object.hasOwn(body, 'name')) { fields.push('name = ?'); values.push(String(body.name).trim()); }
      if (Object.hasOwn(body, 'email')) { fields.push('email = ?'); values.push(String(body.email).trim().toLowerCase()); }
      if (Object.hasOwn(body, 'role')) { fields.push('role = ?'); values.push(nextRole); }
      if (Object.hasOwn(body, 'isActive')) { fields.push('is_active = ?'); values.push(nextActive ? 1 : 0); }
      if (Object.hasOwn(body, 'password')) { fields.push('password_hash = ?'); values.push(await bcrypt.hash(String(body.password), 12)); }
      if (Object.hasOwn(body, 'permissions')) { fields.push('permissions_json = ?'); values.push(JSON.stringify(nextPermissions)); }
      await connection.execute('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', [...values, id]);
      const [afterRows] = await connection.execute('SELECT id, name, email, role, permissions_json AS permissionsJson, is_active AS isActive, last_login_at AS lastLoginAt FROM users WHERE id = ?', [id]);
      const after = afterRows[0];
      const beforeAudit = { id: before.id, name: before.name, email: before.email, role: before.role, isActive: before.isActive, permissions: effectivePermissions(before.role, before.permissionsJson) };
      const afterAudit = { id: after.id, name: after.name, email: after.email, role: after.role, isActive: after.isActive, permissions: effectivePermissions(after.role, after.permissionsJson) };
      const action = Object.hasOwn(body, 'password') ? 'STAFF_PASSWORD_RESET' : Object.hasOwn(body, 'permissions') ? 'STAFF_PERMISSIONS_UPDATED' : 'STAFF_UPDATED';
      await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.sub, action, 'USER', id, JSON.stringify(beforeAudit), JSON.stringify(afterAudit)]);
      await connection.commit();
      res.json({ staff: { id: after.id, name: after.name, email: after.email, role: after.role, permissions: effectivePermissions(after.role, after.permissionsJson), isActive: after.isActive, lastLoginAt: after.lastLoginAt }, message: Object.hasOwn(body, 'password') ? 'Password reset. The new password is active.' : Object.hasOwn(body, 'permissions') ? 'Staff permissions updated.' : 'Staff account updated.' });
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A staff account with that email already exists.' });
      next(error);
    } finally { connection.release(); }
  } catch (error) { next(error); }
});

export default router;
