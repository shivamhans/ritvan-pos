import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { effectivePermissions } from '../middleware/permissions.js';

const router = Router();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const safeUser = row => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone || '',
  role: row.role,
  permissions: effectivePermissions(row.role, row.permissionsJson),
  isActive: Boolean(Number(row.isActive)),
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: {
    id: req.user.sub,
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone || '',
    role: req.user.role,
    permissions: req.user.permissions,
    updatedAt: req.user.updatedAt || null,
  } });
});

// A user may edit their own personal details, but never their role, permissions or active status.
router.patch('/me', requireAuth, async (req, res, next) => {
  const body = req.body || {};
  const name = Object.hasOwn(body, 'name') ? String(body.name || '').trim() : undefined;
  const email = Object.hasOwn(body, 'email') ? String(body.email || '').trim().toLowerCase() : undefined;
  const phone = Object.hasOwn(body, 'phone') ? String(body.phone || '').trim() : undefined;
  const hasPasswordFields = Object.hasOwn(body, 'currentPassword') || Object.hasOwn(body, 'newPassword');
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (name !== undefined && (!name || name.length > 140)) {
    return res.status(400).json({ error: 'Name is required and must be 140 characters or fewer.' });
  }
  if (email !== undefined && (email.length > 190 || !validEmail(email))) {
    return res.status(400).json({ error: 'Enter a valid email address (max 190 characters).' });
  }
  if (phone !== undefined && phone.length > 24) {
    return res.status(400).json({ error: 'Phone number must be 24 characters or fewer.' });
  }
  if (phone && (!/^[+0-9().\s-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7)) {
    return res.status(400).json({ error: 'Enter a valid phone number or leave it blank.' });
  }
  if (hasPasswordFields) {
    if (!currentPassword) return res.status(400).json({ error: 'Enter your current password to change it.' });
    if (newPassword.length < 12 || newPassword.length > 200) {
      return res.status(400).json({ error: 'New password must be 12–200 characters long.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'Choose a password different from your current one.' });
    }
  }
  const changesPersonalDetails = name !== undefined || email !== undefined || phone !== undefined;
  if (!changesPersonalDetails && !hasPasswordFields) {
    return res.status(400).json({ error: 'No profile changes were provided.' });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('replace-with')) {
    return res.status(500).json({ error: 'Set a secure JWT_SECRET in the server environment before updating your profile.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let rows;
    let hasPhoneColumn = true;
    try {
      [rows] = await connection.execute(
        'SELECT id, name, email, phone, password_hash AS passwordHash, role, permissions_json AS permissionsJson, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ? FOR UPDATE',
        [req.user.sub]
      );
    } catch (error) {
      if (error.code !== 'ER_BAD_FIELD_ERROR' || !String(error.message || '').toLowerCase().includes('phone')) throw error;
      hasPhoneColumn = false;
      [rows] = await connection.execute(
        'SELECT id, name, email, NULL AS phone, password_hash AS passwordHash, role, permissions_json AS permissionsJson, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ? FOR UPDATE',
        [req.user.sub]
      );
    }
    const before = rows[0];
    if (!before || !Boolean(Number(before.isActive))) {
      await connection.rollback();
      return res.status(401).json({ error: 'This account is inactive or no longer exists. Sign in again or contact an Admin.' });
    }

    if (hasPasswordFields && !(await bcrypt.compare(currentPassword, before.passwordHash))) {
      await connection.rollback();
      return res.status(400).json({ error: 'Your current password is incorrect.' });
    }

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (phone !== undefined && hasPhoneColumn) { fields.push('phone = ?'); values.push(phone || null); }
    if (phone !== undefined && !hasPhoneColumn && fields.length === 0 && !hasPasswordFields) {
      await connection.rollback();
      return res.status(409).json({ error: 'Phone saving needs the profile database update. Run the updated database/ritvan-pos-all-in-one.sql against this database, then try again.' });
    }
    if (hasPasswordFields) {
      fields.push('password_hash = ?');
      values.push(await bcrypt.hash(newPassword, 12));
    }

    await connection.execute('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', [...values, before.id]);
    const [afterRows] = await connection.execute(
      hasPhoneColumn
        ? 'SELECT id, name, email, phone, role, permissions_json AS permissionsJson, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?'
        : 'SELECT id, name, email, NULL AS phone, role, permissions_json AS permissionsJson, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ?',
      [before.id]
    );
    const after = afterRows[0];
    const auditBefore = { id: before.id, name: before.name, email: before.email, phone: before.phone || '', role: before.role };
    const auditAfter = { id: after.id, name: after.name, email: after.email, phone: after.phone || '', role: after.role, passwordChanged: hasPasswordFields };
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
      [before.id, hasPasswordFields ? 'PROFILE_PASSWORD_CHANGED' : 'PROFILE_UPDATED', 'USER', before.id, JSON.stringify(auditBefore), JSON.stringify(auditAfter)]
    );
    await connection.commit();

    const user = safeUser(after);
    const token = jwt.sign(
      { sub: after.id, name: after.name, email: after.email, role: after.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    res.json({
      user, token,
      message: hasPasswordFields ? 'Profile and password updated.' : 'Profile updated.',
      ...(phone !== undefined && !hasPhoneColumn ? { warning: 'Name and email were saved, but the phone number was not saved because users.phone is missing. Run the updated database/ritvan-pos-all-in-one.sql to enable phone storage.' } : {}),
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with that email address already exists.' });
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    let rows;
    try {
      [rows] = await pool.execute('SELECT id, name, email, phone, password_hash, role, is_active, permissions_json AS permissionsJson FROM users WHERE email = ? LIMIT 1', [email]);
    } catch (error) {
      // Older customer databases may not have the optional profile phone column yet.
      if (error.code !== 'ER_BAD_FIELD_ERROR' || !String(error.message || '').toLowerCase().includes('phone')) throw error;
      [rows] = await pool.execute('SELECT id, name, email, NULL AS phone, password_hash, role, is_active, permissions_json AS permissionsJson FROM users WHERE email = ? LIMIT 1', [email]);
    }
    const user = rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('replace-with')) {
      return res.status(500).json({ error: 'Set a secure JWT_SECRET in the server environment before logging in.' });
    }
    await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    const token = jwt.sign({ sub: user.id, name: user.name, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role, permissions: effectivePermissions(user.role, user.permissionsJson) } });
  } catch (error) { next(error); }
});
export default router;
