import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, allowRoles('Admin'));

function schemaPath() {
  return process.env.RITVAN_SCHEMA_PATH || path.resolve(process.cwd(), '../database/schema.sql');
}

async function inspectMissingTables(connection) {
  const source = await fs.readFile(schemaPath(), 'utf8');
  const statements = [...source.matchAll(/CREATE TABLE IF NOT EXISTS\s+`?([a-zA-Z0-9_]+)`?[\s\S]*?ENGINE=InnoDB\s*;/gi)]
    .map(match => ({ name: match[1], sql: match[0] }));
  if (!statements.length) throw new Error('No CREATE TABLE definitions were found in the packaged schema file.');
  const [rows] = await connection.execute(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
  );
  const existing = new Set(rows.map(row => row.name));
  return statements.filter(item => !existing.has(item.name));
}

function createBackup() {
  return new Promise((resolve, reject) => {
    const dbName = process.env.DB_NAME || 'ritvan_pos';
    const folder = process.env.RITVAN_BACKUP_DIR || path.resolve(process.cwd(), 'database-backups');
    fs.mkdir(folder, { recursive: true }).then(() => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(folder, stamp + '-before-missing-table-repair.sql');
      const args = [
        '--host=' + (process.env.DB_HOST || '127.0.0.1'),
        '--port=' + String(process.env.DB_PORT || 3306),
        '--user=' + (process.env.DB_USER || 'root'),
        '--single-transaction', '--routines', '--triggers', '--hex-blob',
        '--databases', dbName,
      ];
      const child = spawn(process.env.MYSQLDUMP_PATH || 'mysqldump', args, {
        env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
        windowsHide: true,
      });
      const output = [];
      let stderr = '';
      child.stdout.on('data', chunk => output.push(chunk));
      child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-3000); });
      child.once('error', reject);
      child.once('close', async code => {
        if (code !== 0) return reject(new Error('Database backup failed. No repair was applied. ' + stderr));
        try {
          const bytes = output.reduce((sum, chunk) => sum + chunk.length, 0);
          if (bytes < 100) throw new Error('Backup file was unexpectedly small.');
          await fs.writeFile(file, Buffer.concat(output), { flag: 'wx', mode: 0o600 });
          resolve({ file, bytes });
        } catch (error) { reject(error); }
      });
    }).catch(reject);
  });
}

router.get('/missing', async (_req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const missing = await inspectMissingTables(connection);
    res.json({ database: process.env.DB_NAME || 'ritvan_pos', missing: missing.map(item => item.name), count: missing.length });
  } catch (error) { next(error); }
  finally { connection?.release(); }
});

router.post('/repair-missing-tables', async (req, res, next) => {
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Explicit Admin confirmation is required.' });
  let connection;
  try {
    connection = await pool.getConnection();
    const missing = await inspectMissingTables(connection);
    if (!missing.length) return res.json({ repaired: [], message: 'No missing tables were found.' });
    const backup = await createBackup();
    const repaired = [];
    for (const item of missing) {
      await connection.query(item.sql);
      repaired.push(item.name);
    }
    res.json({ repaired, backup: { file: backup.file, bytes: backup.bytes }, message: 'Only missing tables were created. Existing tables and rows were not altered.' });
  } catch (error) { next(error); }
  finally { connection?.release(); }
});

export default router;
