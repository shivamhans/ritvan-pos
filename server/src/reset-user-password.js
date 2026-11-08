import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const [rawEmail, password] = process.argv.slice(2);
const email = String(rawEmail || '').trim().toLowerCase();
if (!email || !password || String(password).length < 12 || String(password).length > 200) {
  console.error('Password was NOT changed. Provide an email and a password 12–200 characters long.');
  console.error('Usage: node src/reset-user-password.js admin@example.com "A-new-strong-password-12+"');
  process.exit(1);
}
try {
  const [rows] = await pool.execute('SELECT id, email, role FROM users WHERE email = ? LIMIT 1', [email]);
  const user = rows[0];
  if (!user) {
    console.error('No Ritvan account exists for that email. Create the first Admin with src/seed-admin.js.');
    process.exitCode = 1;
  } else {
    const hash = await bcrypt.hash(String(password), 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    await pool.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json, reason) VALUES (NULL, ?, ?, ?, ?, ?)',
      ['STAFF_PASSWORD_RESET_CLI', 'USER', user.id, JSON.stringify({ email: user.email, role: user.role }), 'Local command-line password reset']);
    console.log('Password reset successfully for ' + user.email + '.');
    console.log('Sign in using this email and the new password. The password is not printed.');
  }
} catch (error) {
  console.error(error.message || 'Password reset failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
