import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Dashboard', 'Point of Sale', 'Items', 'Inventory', 'Purchases'], ['Items']));
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT i.id, i.name, i.sku, i.barcode, i.category_id, c.name AS category,
      i.selling_price, i.avg_cost, i.qty_on_hand, i.reorder_threshold, i.is_active, i.image_data
      FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE i.is_active = 1 ORDER BY i.name`);
    const canViewCost = req.user.role !== 'Cashier' && (
      (req.user.permissions?.modules?.includes('Items') && req.user.permissions?.columns?.Items?.includes('avgCost')) ||
      (req.user.permissions?.modules?.includes('Inventory') && req.user.permissions?.columns?.Inventory?.includes('avgCost'))
    );
    const items = canViewCost ? rows : rows.map(row => {
      const { avg_cost: _hiddenAverageCost, ...safeRow } = row;
      return safeRow;
    });
    res.json({ items });
  } catch (error) { next(error); }
});
router.post('/', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  try {
    const { name, sku: suppliedSku, categoryId = null, sellingPrice, initialCost = 0, initialQty = 0, reorderThreshold = 5, barcode = null, imageData = null } = req.body || {};
    const skuInput = String(suppliedSku || '').trim();
    const photo = imageData == null || imageData === '' ? null : String(imageData);
    const validPhoto = photo == null || (
      photo.length <= 700000 &&
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)
    );
    if (!name?.trim() || skuInput.length > 80 || !Number.isFinite(Number(sellingPrice)) || Number(sellingPrice) < 0 ||
      !Number.isFinite(Number(initialCost)) || Number(initialCost) < 0 || !Number.isSafeInteger(Number(initialQty)) || Number(initialQty) < 0 ||
      !Number.isSafeInteger(Number(reorderThreshold)) || Number(reorderThreshold) < 0 || !validPhoto) {
      return res.status(400).json({ error: 'Name, a valid optional SKU, valid price and whole-number quantities are required. Product photos must be JPEG, PNG, or WebP and no larger than 700 KB after compression.' });
    }
    // SKU generation happens on the API so it remains unique across users and browsers.
    // The database unique index is the final safeguard against rare random collisions.
    const sku = skuInput || ('NX-' + randomBytes(6).toString('hex').toUpperCase());
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(`INSERT INTO items (name, sku, barcode, category_id, description, image_data, selling_price, avg_cost, qty_on_hand, reorder_threshold, created_by)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`, [name.trim(), sku.trim(), barcode, categoryId, photo, Number(sellingPrice), Number(initialCost), Number(initialQty), Number(reorderThreshold), req.user.sub]);
      if (Number(initialQty) > 0) {
        await connection.execute(`INSERT INTO stock_movements (item_id, movement_type, qty_delta, unit_cost_at_time, reason, user_id)
          VALUES (?, 'OPENING_STOCK', ?, ?, 'Opening stock', ?)`, [result.insertId, Number(initialQty), Number(initialCost), req.user.sub]);
      }
      await connection.commit();
      res.status(201).json({ id: result.insertId, name: name.trim(), sku });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'SKU or barcode already exists.' });
    next(error);
  }
});
router.patch('/:id', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid item ID.' });

  const body = req.body || {};
  const fields = [];
  const values = [];
  const remember = (column, value) => { fields.push(column + ' = ?'); values.push(value); };

  if (Object.hasOwn(body, 'name')) {
    const name = String(body.name || '').trim();
    if (!name || name.length > 200) return res.status(400).json({ error: 'Item name is required (max 200 characters).' });
    remember('name', name);
  }
  if (Object.hasOwn(body, 'sku')) {
    const sku = String(body.sku || '').trim();
    if (!sku || sku.length > 80) return res.status(400).json({ error: 'SKU must be non-empty and no longer than 80 characters. Leave it unchanged to keep the existing SKU.' });
    remember('sku', sku);
  }
  if (Object.hasOwn(body, 'barcode')) {
    const barcode = body.barcode == null ? null : String(body.barcode).trim();
    if (barcode && barcode.length > 100) return res.status(400).json({ error: 'Barcode must be 100 characters or fewer.' });
    remember('barcode', barcode || null);
  }
  if (Object.hasOwn(body, 'categoryId')) {
    const raw = body.categoryId;
    const categoryId = raw == null || raw === '' ? null : Number(raw);
    if (categoryId !== null && (!Number.isSafeInteger(categoryId) || categoryId < 1)) return res.status(400).json({ error: 'Choose a valid category.' });
    if (categoryId !== null) {
      let categoryRows;
      try { [categoryRows] = await pool.execute('SELECT id FROM categories WHERE id = ?', [categoryId]); }
      catch (error) { return next(error); }
      if (!categoryRows[0]) return res.status(400).json({ error: 'The selected category does not exist.' });
    }
    remember('category_id', categoryId);
  }
  if (Object.hasOwn(body, 'sellingPrice')) {
    const price = Number(body.sellingPrice);
    if (!Number.isFinite(price) || price < 0 || price > 9999999999999999) return res.status(400).json({ error: 'Selling price must be a valid non-negative amount.' });
    remember('selling_price', price);
  }
  if (Object.hasOwn(body, 'reorderThreshold')) {
    const threshold = Number(body.reorderThreshold);
    if (!Number.isSafeInteger(threshold) || threshold < 0) return res.status(400).json({ error: 'Low-stock threshold must be a non-negative whole number.' });
    remember('reorder_threshold', threshold);
  }
  if (Object.hasOwn(body, 'imageData')) {
    const photo = body.imageData == null || body.imageData === '' ? null : String(body.imageData);
    const validPhoto = photo == null || (photo.length <= 700000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo));
    if (!validPhoto) return res.status(400).json({ error: 'Product photos must be JPEG, PNG, or WebP and no larger than 700 KB after compression.' });
    remember('image_data', photo);
  }
  if (!fields.length) return res.status(400).json({ error: 'Provide at least one item detail to update.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.execute(
      'SELECT id, name, sku, barcode, category_id AS categoryId, selling_price AS sellingPrice, reorder_threshold AS reorderThreshold, qty_on_hand AS onHand, avg_cost AS averageCost, image_data IS NOT NULL AS hasImage, is_active AS isActive FROM items WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!beforeRows[0]) {
      await connection.rollback();
      return res.status(404).json({ error: 'Item not found.' });
    }
    // Product edits never write qty_on_hand or avg_cost. Stock and cost changes
    // must go through the stock movement ledger and receiving workflows.
    await connection.execute('UPDATE items SET ' + fields.join(', ') + ' WHERE id = ?', [...values, id]);
    const [afterRows] = await connection.execute(
      'SELECT id, name, sku, barcode, category_id AS categoryId, selling_price AS sellingPrice, reorder_threshold AS reorderThreshold, qty_on_hand AS onHand, avg_cost AS averageCost, image_data IS NOT NULL AS hasImage, is_active AS isActive, updated_at AS updatedAt FROM items WHERE id = ?',
      [id]
    );
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'ITEM_UPDATED', 'ITEM', id, JSON.stringify(beforeRows[0]), JSON.stringify(afterRows[0])]
    );
    await connection.commit();
    res.json({ item: afterRows[0] });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That SKU or barcode is already assigned to another item.' });
    next(error);
  } finally { connection.release(); }
});
export default router;
