import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Dashboard', 'Settings'], ['Settings']));
const currencies = {
  INR: { symbol: '₹' },
  USD: { symbol: '$' },
  GBP: { symbol: '£' },
  EUR: { symbol: '€' },
};

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT business_name AS businessName, currency_code AS currencyCode,
      currency_symbol AS currencySymbol, locale, timezone, logo_data AS logoData, tax_enabled AS taxEnabled,
      valuation_method AS valuationMethod, receipt_footer AS receiptFooter, updated_at AS updatedAt
      FROM business_settings WHERE id = 1`);
    if (!rows[0]) return res.status(500).json({ error: 'Business settings row is missing. Re-run database/schema.sql.' });
    res.json({ settings: { ...rows[0], taxEnabled: Boolean(Number(rows[0].taxEnabled)) } });
  } catch (error) { next(error); }
});

router.patch('/', allowRoles('Admin'), async (req, res, next) => {
  const body = req.body || {};
  const allowed = ['businessName', 'currencyCode', 'locale', 'timezone', 'receiptFooter', 'logoData', 'taxEnabled'];
  if (!allowed.some(key => Object.hasOwn(body, key))) return res.status(400).json({ error: 'No editable business settings supplied.' });
  if (Object.hasOwn(body, 'businessName') && (!String(body.businessName || '').trim() || String(body.businessName).trim().length > 140)) return res.status(400).json({ error: 'Business name is required (max 140 characters).' });
  if (Object.hasOwn(body, 'currencyCode') && !currencies[String(body.currencyCode)]) return res.status(400).json({ error: 'Currency must be INR, USD, GBP, or EUR.' });
  if (Object.hasOwn(body, 'locale') && !['en-IN', 'en-US', 'en-GB'].includes(String(body.locale))) return res.status(400).json({ error: 'Locale must be en-IN, en-US, or en-GB.' });
  if (Object.hasOwn(body, 'timezone') && (!String(body.timezone || '').trim() || String(body.timezone).length > 64)) return res.status(400).json({ error: 'Enter a valid timezone name.' });
  if (Object.hasOwn(body, 'receiptFooter') && body.receiptFooter != null && String(body.receiptFooter).length > 255) return res.status(400).json({ error: 'Receipt footer must be 255 characters or fewer.' });
  if (Object.hasOwn(body, 'logoData')) {
    const logo = body.logoData == null || body.logoData === '' ? null : String(body.logoData);
    if (logo && (logo.length > 700000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo))) return res.status(400).json({ error: 'Store logo must be a compressed JPEG, PNG, or WebP image under 500 KB.' });
  }
  if (Object.hasOwn(body, 'taxEnabled') && body.taxEnabled !== false && body.taxEnabled !== 0) {
    return res.status(409).json({ error: 'Tax cannot be enabled yet: a tax rate and calculation policy must be configured before the POS can safely collect tax.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT * FROM business_settings WHERE id = 1 FOR UPDATE');
    const before = rows[0];
    if (!before) { await connection.rollback(); return res.status(500).json({ error: 'Business settings row is missing. Re-run database/schema.sql.' }); }
    const updates = [];
    const values = [];
    if (Object.hasOwn(body, 'businessName')) { updates.push('business_name = ?'); values.push(String(body.businessName).trim()); }
    if (Object.hasOwn(body, 'currencyCode')) {
      const code = String(body.currencyCode);
      updates.push('currency_code = ?', 'currency_symbol = ?'); values.push(code, currencies[code].symbol);
    }
    if (Object.hasOwn(body, 'locale')) { updates.push('locale = ?'); values.push(String(body.locale)); }
    if (Object.hasOwn(body, 'timezone')) { updates.push('timezone = ?'); values.push(String(body.timezone).trim()); }
    if (Object.hasOwn(body, 'receiptFooter')) { updates.push('receipt_footer = ?'); values.push(body.receiptFooter == null ? null : String(body.receiptFooter).trim() || null); }
    if (Object.hasOwn(body, 'logoData')) { updates.push('logo_data = ?'); values.push(body.logoData == null || body.logoData === '' ? null : String(body.logoData)); }
    if (Object.hasOwn(body, 'taxEnabled')) { updates.push('tax_enabled = ?'); values.push(0); }
    if (updates.length) await connection.execute('UPDATE business_settings SET ' + updates.join(', ') + ' WHERE id = 1', values);
    const [afterRows] = await connection.execute(`SELECT business_name AS businessName, currency_code AS currencyCode,
      currency_symbol AS currencySymbol, locale, timezone, logo_data AS logoData, tax_enabled AS taxEnabled,
      valuation_method AS valuationMethod, receipt_footer AS receiptFooter, updated_at AS updatedAt
      FROM business_settings WHERE id = 1`);
    const beforeAudit = { ...before, logo_data: before.logo_data ? '[stored logo]' : null };
    const afterAudit = { ...afterRows[0], logoData: afterRows[0].logoData ? '[stored logo]' : null };
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'BUSINESS_SETTINGS_UPDATED', 'BUSINESS_SETTINGS', 1, JSON.stringify(beforeAudit), JSON.stringify(afterAudit)]);
    await connection.commit();
    res.json({ settings: { ...afterRows[0], taxEnabled: Boolean(Number(afterRows[0].taxEnabled)) } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

export default router;
