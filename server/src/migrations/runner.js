import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config({ path: process.env.RITVAN_ENV_PATH || undefined });
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.join(here, 'scripts');

function safeName(value) { return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_'); }

async function createDatabaseBackup(migrationName) {
  const dbName = process.env.DB_NAME || 'ritvan_pos';
  const backupDirectory = process.env.RITVAN_BACKUP_DIR || path.resolve(process.cwd(), 'database-backups');
  await fs.mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(backupDirectory, `${timestamp}-${safeName(migrationName)}.sql`);
  const executable = process.env.MYSQLDUMP_PATH || 'mysqldump';
  const args = [
    '--host=' + (process.env.DB_HOST || '127.0.0.1'),
    '--port=' + String(process.env.DB_PORT || 3306),
    '--user=' + (process.env.DB_USER || 'root'),
    '--single-transaction', '--routines', '--triggers', '--hex-blob', '--databases', dbName,
  ];
  const output = createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
  const child = spawn(executable, args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
  child.stdout.pipe(output);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => {
      output.end();
      output.once('finish', () => code === 0 ? resolve() : reject(new Error(`mysqldump exited with code ${code}: ${stderr}`)));
    });
  }).catch(async error => {
    output.destroy();
    await fs.rm(outputPath, { force: true }).catch(() => {});
    throw new Error(`Database backup failed; migration "${migrationName}" was not run. Check MYSQLDUMP_PATH and MySQL permissions. ${error.message}`);
  });
  const stat = await fs.stat(outputPath);
  if (stat.size < 100) {
    await fs.rm(outputPath, { force: true });
    throw new Error(`Database backup for "${migrationName}" is unexpectedly small; migration was not run.`);
  }
  return { path: outputPath, bytes: stat.size };
}

export async function runPendingMigrations() {
  let connection;
  try { connection = await pool.getConnection(); }
  catch (error) {
    console.warn('[Ritvan migrations] MySQL is unavailable; migrations will retry on next launch:', error.message);
    return { skipped: true, reason: 'database-unavailable' };
  }
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS ritvan_schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    let entries = [];
    try { entries = await fs.readdir(migrationDirectory); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const files = entries.filter(name => /^\d{3,}[-_][a-zA-Z0-9_.-]+\.js$/.test(name)).sort();
    let appliedCount = 0;
    for (const name of files) {
      const absolutePath = path.join(migrationDirectory, name);
      const source = await fs.readFile(absolutePath, 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const [existing] = await connection.query('SELECT checksum FROM ritvan_schema_migrations WHERE name = ?', [name]);
      if (existing.length) {
        if (existing[0].checksum !== checksum) throw new Error(`Applied migration "${name}" has changed. Add a new migration instead of editing one already applied.`);
        continue;
      }
      const backup = await createDatabaseBackup(name);
      console.info(`[Ritvan migrations] Backup created: ${backup.path} (${backup.bytes} bytes)`);
      const migration = await import(pathToFileURL(absolutePath).href);
      if (typeof migration.up !== 'function') throw new Error(`Migration "${name}" must export async up({ connection, pool }).`);
      await migration.up({ connection, pool });
      await connection.query('INSERT INTO ritvan_schema_migrations (name, checksum) VALUES (?, ?)', [name, checksum]);
      appliedCount += 1;
      console.info(`[Ritvan migrations] Applied ${name}`);
    }
    return { skipped: false, applied: appliedCount };
  } finally { connection.release(); }
}
