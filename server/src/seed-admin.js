import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 12) {
  console.error('Admin account was NOT created. Passwords must be at least 12 characters.');
  console.error('Usage: node src/seed-admin.js "Admin Name" admin@example.com "A-strong-password-12+"');
  process.exit(1);
}
try {
  const hash = await bcrypt.hash(password, 12);
  await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'Admin\')', [name, email.toLowerCase(), hash]);
  console.log(`Admin created: ${email.toLowerCase()}`);
} catch (error) {
  console.error(error.code === 'ER_DUP_ENTRY' ? 'That email already exists.' : error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
