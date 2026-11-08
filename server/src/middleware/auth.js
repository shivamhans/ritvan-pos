import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { effectivePermissions } from './permissions.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session is invalid or expired.' });
  }
  try {
    let rows;
    try {
      [rows] = await pool.execute('SELECT id, name, email, phone, role, is_active AS isActive, permissions_json AS permissionsJson, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    } catch (error) {
      // Keep existing customer databases usable until the additive phone-column
      // migration is applied; authentication itself must not depend on that field.
      if (error.code !== 'ER_BAD_FIELD_ERROR' || !String(error.message || '').toLowerCase().includes('phone')) throw error;
      [rows] = await pool.execute('SELECT id, name, email, NULL AS phone, role, is_active AS isActive, permissions_json AS permissionsJson, created_at AS createdAt, updated_at AS updatedAt FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    }
    const user = rows[0];
    if (!user || !Boolean(Number(user.isActive))) return res.status(401).json({ error: 'This account is inactive or no longer exists. Sign in again or contact an Admin.' });
    req.user = { ...claims, sub: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role, permissions: effectivePermissions(user.role, user.permissionsJson), createdAt: user.createdAt, updatedAt: user.updatedAt };
    next();
  } catch (error) { next(error); }
}
export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
