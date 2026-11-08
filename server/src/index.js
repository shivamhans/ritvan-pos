import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config({ path: process.env.RITVAN_ENV_PATH || undefined });
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import salesRoutes from './routes/sales.js';
import creditRoutes from './routes/credit.js';
import categoriesRoutes from './routes/categories.js';
import customersRoutes from './routes/customers.js';
import suppliersRoutes from './routes/suppliers.js';
import purchasesRoutes from './routes/purchases.js';
import inventoryRoutes from './routes/inventory.js';
import transactionsRoutes from './routes/transactions.js';
import staffRoutes from './routes/staff.js';
import returnsRoutes from './routes/returns.js';
import settingsRoutes from './routes/settings.js';
import reportsRoutes from './routes/reports.js';
import employeesRoutes from './routes/employees.js';
import spendingsRoutes from './routes/spendings.js';
import databaseMaintenanceRoutes from './routes/database-maintenance.js';

const app = express();
app.use(helmet());
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(',').map(origin => origin.trim()).filter(Boolean);
const lanAccessEnabled = String(process.env.LAN_ACCESS || 'true').toLowerCase() === 'true';

function isPrivateIPv4(hostname) {
  const parts = String(hostname || '').split('.');
  if (parts.length !== 4 || parts.some(part => part.trim() === '' || !Number.isInteger(Number(part)) || Number(part) < 0 || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isAllowedLanOrigin(origin) {
  if (!lanAccessEnabled || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && Boolean(url.port) && isPrivateIPv4(url.hostname) && url.origin === origin;
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    const isLocalViteOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || (process.env.RITVAN_DESKTOP === 'true' && origin === 'null') || configuredOrigins.includes(origin) || isLocalViteOrigin || isAllowedLanOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/database-maintenance', databaseMaintenanceRoutes);
app.get('/', (_req, res) => {
  res.json({ service: 'ritvan-pos-api', status: 'ok', health: '/api/health' });
});

app.get('/api/health', async (_req, res) => {
  let database = 'disconnected';
  try { await pool.query('SELECT 1'); database = 'connected'; } catch { /* health endpoint reports service state */ }
  res.json({ status: 'ok', service: 'ritvan-pos-api', database, time: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/spendings', spendingsRoutes);
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
app.use(express.static(clientDist, { index: false, fallthrough: true }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), error => { if (error) next(); });
});
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : error.message || 'Unexpected server error.' });
});
const port = Number(process.env.PORT || 4001);
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => console.log('Ritvan POS API listening on ' + host + ':' + port));

export { server };
export async function shutdown() {
  await new Promise(resolve => server.close(resolve));
  await pool.end();
}
