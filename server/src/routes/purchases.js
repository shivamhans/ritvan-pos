import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Purchases']));
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const positiveInt = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const money4 = value => Number(Number(value).toFixed(4));
const money2 = value => Number(Number(value).toFixed(2));

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const [purchases] = await pool.execute(`
      SELECT p.id, p.purchase_no AS purchaseNo, p.supplier_id AS supplierId,
        COALESCE(s.name, 'No supplier') AS supplier, p.status, p.purchase_date AS purchaseDate,
        p.subtotal, p.additional_cost AS additionalCost, p.total_amount AS totalAmount,
        p.notes, COUNT(DISTINCT pi.id) AS lineCount,
        COALESCE(SUM(pi.quantity_ordered),0) AS quantityOrdered,
        COALESCE(SUM(pi.quantity_received),0) AS quantityReceived
      FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      WHERE (? = '' OR p.purchase_no LIKE ? OR COALESCE(s.name,'') LIKE ? OR p.status LIKE ?)
      GROUP BY p.id ORDER BY p.created_at DESC LIMIT 250
    `, [q, `%${q}%`, `%${q}%`, `%${q}%`]);
    res.json({ purchases });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid purchase ID.' });
  try {
    const [headers] = await pool.execute(`
      SELECT p.id, p.purchase_no AS purchaseNo, p.supplier_id AS supplierId,
        s.name AS supplier, p.status, p.purchase_date AS purchaseDate,
        p.subtotal, p.additional_cost AS additionalCost, p.total_amount AS totalAmount,
        p.notes, p.received_at AS receivedAt
      FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?
    `, [id]);
    if (!headers[0]) return res.status(404).json({ error: 'Purchase not found.' });
    const [lines] = await pool.execute(`
      SELECT pi.id AS purchaseItemId, pi.item_id AS itemId, i.name AS itemName, i.sku,
        pi.quantity_ordered AS quantityOrdered, pi.quantity_received AS quantityReceived,
        pi.unit_cost AS unitCost, pi.line_total AS lineTotal
      FROM purchase_items pi JOIN items i ON i.id = pi.item_id WHERE pi.purchase_id = ? ORDER BY pi.id
    `, [id]);
    res.json({ purchase: { ...headers[0], lines } });
  } catch (error) { next(error); }
});

router.post('/', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const { supplierId = null, purchaseDate, notes = null, additionalCost = 0, lines = [] } = req.body || {};
  const supplier = supplierId == null || supplierId === '' ? null : Number(supplierId);
  const extra = Number(additionalCost);
  const date = String(purchaseDate || new Date().toISOString().slice(0, 10));
  if (supplier !== null && !validId(supplier)) return res.status(400).json({ error: 'Invalid supplier ID.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return res.status(400).json({ error: 'purchaseDate must be YYYY-MM-DD.' });
  if (!Number.isFinite(extra) || extra < 0) return res.status(400).json({ error: 'Additional cost must be a non-negative amount.' });
  if (!Array.isArray(lines) || !lines.length || lines.length > 200) return res.status(400).json({ error: 'Add between 1 and 200 purchase lines.' });
  const resolved = [];
  const seen = new Set();
  for (const line of lines) {
    const itemId = Number(line.itemId);
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unitCost);
    if (!validId(itemId) || !positiveInt(quantity) || !Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: 'Each line requires a valid item, positive whole quantity, and non-negative unit cost.' });
    if (seen.has(itemId)) return res.status(400).json({ error: 'Each item can appear only once per purchase. Combine its quantity into one line.' });
    seen.add(itemId);
    resolved.push({ itemId, quantity, unitCost: money4(unitCost) });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (supplier !== null) {
      const [suppliers] = await connection.execute('SELECT id FROM suppliers WHERE id = ? AND is_active = 1 FOR UPDATE', [supplier]);
      if (!suppliers[0]) { await connection.rollback(); return res.status(400).json({ error: 'Supplier not found or inactive.' }); }
    }
    const ids = resolved.map(line => line.itemId).sort((a,b)=>a-b);
    const itemById = new Map();
    for (const itemId of ids) {
      const [rows] = await connection.execute('SELECT id, is_active FROM items WHERE id = ? FOR UPDATE', [itemId]);
      if (!rows[0] || !rows[0].is_active) { await connection.rollback(); return res.status(400).json({ error: `Item ${itemId} was not found or is inactive.` }); }
      itemById.set(itemId, rows[0]);
    }
    const subtotal = money2(resolved.reduce((sum, line) => sum + line.quantity * line.unitCost, 0));
    const total = money2(subtotal + extra);
    const purchaseNo = `PO-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${randomUUID().slice(0,6).toUpperCase()}`;
    const [header] = await connection.execute(`
      INSERT INTO purchases (purchase_no, supplier_id, status, purchase_date, subtotal, additional_cost, total_amount, notes, created_by)
      VALUES (?, ?, 'ORDERED', ?, ?, ?, ?, ?, ?)
    `, [purchaseNo, supplier, date, subtotal, extra, total, notes == null ? null : String(notes).trim().slice(0, 2000) || null, req.user.sub]);
    for (const line of resolved) {
      await connection.execute(`
        INSERT INTO purchase_items (purchase_id, item_id, quantity_ordered, quantity_received, unit_cost, line_total)
        VALUES (?, ?, ?, 0, ?, ?)
      `, [header.insertId, line.itemId, line.quantity, line.unitCost, money2(line.quantity * line.unitCost)]);
    }
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)', [req.user.sub, 'PURCHASE_ORDERED', 'PURCHASE', header.insertId, JSON.stringify({ purchaseNo, supplierId: supplier, lineCount: resolved.length, subtotal, additionalCost: extra, totalAmount: total })]);
    await connection.commit();
    res.status(201).json({ purchase: { id: header.insertId, purchaseNo, supplierId: supplier, status: 'ORDERED', purchaseDate: date, subtotal, additionalCost: extra, totalAmount: total, lineCount: resolved.length } });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A purchase with this number already exists; retry the request.' });
    next(error);
  } finally { connection.release(); }
});

router.patch('/:id', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const purchaseId = Number(req.params.id);
  const { supplierId = null, purchaseDate, notes = null, lines = [] } = req.body || {};
  const supplier = supplierId == null || supplierId === '' ? null : Number(supplierId);
  const date = String(purchaseDate || '');
  if (!validId(purchaseId)) return res.status(400).json({ error: 'Invalid purchase ID.' });
  if (supplier !== null && !validId(supplier)) return res.status(400).json({ error: 'Invalid supplier ID.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return res.status(400).json({ error: 'purchaseDate must be a valid YYYY-MM-DD date.' });
  if (!Array.isArray(lines) || !lines.length || lines.length > 200) return res.status(400).json({ error: 'Add between 1 and 200 purchase lines.' });
  if (notes != null && String(notes).length > 2000) return res.status(400).json({ error: 'Purchase notes must be 2,000 characters or fewer.' });

  const resolved = [];
  const seen = new Set();
  for (const line of lines) {
    const itemId = Number(line.itemId);
    const quantity = Number(line.quantity);
    const unitCost = Number(line.unitCost);
    if (!validId(itemId) || !positiveInt(quantity) || !Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ error: 'Each line requires a valid item, positive whole quantity, and non-negative unit cost.' });
    if (seen.has(itemId)) return res.status(400).json({ error: 'Each item can appear only once per purchase. Combine its quantity into one line.' });
    seen.add(itemId);
    resolved.push({ itemId, quantity, unitCost: money4(unitCost) });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [headers] = await connection.execute('SELECT id, purchase_no AS purchaseNo, supplier_id AS supplierId, status, purchase_date AS purchaseDate, subtotal, additional_cost AS additionalCost, total_amount AS totalAmount, notes FROM purchases WHERE id = ? FOR UPDATE', [purchaseId]);
    const purchase = headers[0];
    if (!purchase) { await connection.rollback(); return res.status(404).json({ error: 'Purchase not found.' }); }
    if (purchase.status !== 'ORDERED') { await connection.rollback(); return res.status(409).json({ error: 'Only an unreceived ORDERED purchase can be edited. Once any quantity has been received, the order is locked to protect stock and weighted-average cost.' }); }
    const [oldLines] = await connection.execute('SELECT id, item_id AS itemId, quantity_ordered AS quantityOrdered, quantity_received AS quantityReceived, unit_cost AS unitCost FROM purchase_items WHERE purchase_id = ? FOR UPDATE', [purchaseId]);
    if (oldLines.some(line => Number(line.quantityReceived) !== 0)) { await connection.rollback(); return res.status(409).json({ error: 'This purchase already has received quantities and cannot be edited.' }); }
    if (supplier !== null) {
      const [suppliers] = await connection.execute('SELECT id FROM suppliers WHERE id = ? AND is_active = 1 FOR UPDATE', [supplier]);
      if (!suppliers[0]) { await connection.rollback(); return res.status(400).json({ error: 'Supplier not found or inactive.' }); }
    }
    const before = { ...purchase, lines: oldLines };
    const ids = resolved.map(line => line.itemId).sort((a, b) => a - b);
    for (const itemId of ids) {
      const [rows] = await connection.execute('SELECT id, is_active AS isActive FROM items WHERE id = ? FOR UPDATE', [itemId]);
      if (!rows[0] || !Boolean(Number(rows[0].isActive))) { await connection.rollback(); return res.status(400).json({ error: 'Item ' + itemId + ' was not found or is inactive.' }); }
    }
    const subtotal = money2(resolved.reduce((sum, line) => sum + line.quantity * line.unitCost, 0));
    const total = money2(subtotal + Number(purchase.additionalCost));
    await connection.execute('UPDATE purchases SET supplier_id = ?, purchase_date = ?, subtotal = ?, total_amount = ?, notes = ? WHERE id = ?', [supplier, date, subtotal, total, notes == null ? null : String(notes).trim().slice(0, 2000) || null, purchaseId]);
    await connection.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
    for (const line of resolved) {
      await connection.execute('INSERT INTO purchase_items (purchase_id, item_id, quantity_ordered, quantity_received, unit_cost, line_total) VALUES (?, ?, ?, 0, ?, ?)', [purchaseId, line.itemId, line.quantity, line.unitCost, money2(line.quantity * line.unitCost)]);
    }
    const after = { purchaseNo: purchase.purchaseNo, supplierId: supplier, status: 'ORDERED', purchaseDate: date, subtotal, additionalCost: Number(purchase.additionalCost), totalAmount: total, notes: notes == null ? null : String(notes).trim().slice(0, 2000) || null, lines: resolved };
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)', [req.user.sub, 'PURCHASE_UPDATED', 'PURCHASE', purchaseId, JSON.stringify(before), JSON.stringify(after)]);
    await connection.commit();
    res.json({ purchase: { id: purchaseId, ...after, lineCount: resolved.length, quantityReceived: 0, quantityOrdered: resolved.reduce((sum, line) => sum + line.quantity, 0) }, message: 'Unreceived purchase order updated. Inventory was not changed.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});
router.post('/:id/cancel', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const purchaseId = Number(req.params.id);
  if (!validId(purchaseId)) return res.status(400).json({ error: 'Invalid purchase ID.' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [headers] = await connection.execute(
      'SELECT id, purchase_no AS purchaseNo, status, total_amount AS totalAmount FROM purchases WHERE id = ? FOR UPDATE',
      [purchaseId]
    );
    const purchase = headers[0];
    if (!purchase) { await connection.rollback(); return res.status(404).json({ error: 'Purchase not found.' }); }
    if (purchase.status !== 'ORDERED') {
      await connection.rollback();
      return res.status(409).json({ error: 'Only an ORDERED purchase can be cancelled. Partially received, received, or already cancelled purchases cannot be cancelled.' });
    }
    const [lines] = await connection.execute(
      'SELECT id, item_id AS itemId, quantity_ordered AS quantityOrdered, quantity_received AS quantityReceived FROM purchase_items WHERE purchase_id = ? FOR UPDATE',
      [purchaseId]
    );
    if (lines.some(line => Number(line.quantityReceived) > 0)) {
      await connection.rollback();
      return res.status(409).json({ error: 'This purchase has received stock and cannot be cancelled. Resolve outstanding quantities through the normal stock workflows.' });
    }
    const before = { ...purchase, status: 'ORDERED', lines };
    await connection.execute("UPDATE purchases SET status = 'CANCELLED' WHERE id = ?", [purchaseId]);
    const after = { ...purchase, status: 'CANCELLED', cancelledBy: req.user.sub, cancelledAt: new Date().toISOString() };
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'PURCHASE_CANCELLED', 'PURCHASE', purchaseId, JSON.stringify(before), JSON.stringify(after)]
    );
    await connection.commit();
    res.json({ purchase: { id: purchaseId, purchaseNo: purchase.purchaseNo, status: 'CANCELLED', totalAmount: Number(purchase.totalAmount) }, message: 'Purchase cancelled. Inventory was not changed.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});
router.post('/:id/receive', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const purchaseId = Number(req.params.id);
  const { lines = [] } = req.body || {};
  if (!validId(purchaseId)) return res.status(400).json({ error: 'Invalid purchase ID.' });
  if (!Array.isArray(lines) || !lines.length || lines.length > 200) return res.status(400).json({ error: 'Provide quantities for at least one purchase line.' });
  const selected = [];
  const seen = new Set();
  for (const line of lines) {
    const purchaseItemId = Number(line.purchaseItemId);
    const quantity = Number(line.quantity);
    if (!validId(purchaseItemId) || !positiveInt(quantity)) return res.status(400).json({ error: 'Each receiving line requires a purchaseItemId and positive whole quantity.' });
    if (seen.has(purchaseItemId)) return res.status(400).json({ error: 'Duplicate purchase line in one receipt request.' });
    seen.add(purchaseItemId);
    selected.push({ purchaseItemId, quantity });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [headers] = await connection.execute('SELECT id, purchase_no AS purchaseNo, status, additional_cost AS additionalCost FROM purchases WHERE id = ? FOR UPDATE', [purchaseId]);
    const purchase = headers[0];
    if (!purchase) { await connection.rollback(); return res.status(404).json({ error: 'Purchase not found.' }); }
    if (!['ORDERED','PARTIALLY_RECEIVED'].includes(purchase.status)) { await connection.rollback(); return res.status(409).json({ error: `Purchase cannot be received while status is ${purchase.status}.` }); }
    if (Number(purchase.additionalCost) > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'This purchase has additional charges. Freight/cost capitalization into weighted average cost is not yet approved; set additional cost to zero or resolve that policy before receiving it.' });
    }
    const [allLines] = await connection.execute('SELECT id, item_id AS itemId, quantity_ordered AS quantityOrdered, quantity_received AS quantityReceived, unit_cost AS unitCost FROM purchase_items WHERE purchase_id = ? FOR UPDATE', [purchaseId]);
    const byId = new Map(allLines.map(line => [Number(line.id), line]));
    for (const incoming of selected) {
      const row = byId.get(incoming.purchaseItemId);
      if (!row) { await connection.rollback(); return res.status(400).json({ error: `Purchase line ${incoming.purchaseItemId} does not belong to this purchase.` }); }
      if (incoming.quantity > Number(row.quantityOrdered) - Number(row.quantityReceived)) {
        await connection.rollback();
        return res.status(409).json({ error: `Receive quantity exceeds the outstanding quantity for item ${row.itemId}.`, outstanding: Number(row.quantityOrdered) - Number(row.quantityReceived) });
      }
    }
    selected.sort((a,b)=>Number(byId.get(a.purchaseItemId).itemId)-Number(byId.get(b.purchaseItemId).itemId));
    const receivedSummary = [];
    for (const incoming of selected) {
      const line = byId.get(incoming.purchaseItemId);
      const [items] = await connection.execute('SELECT id, name, qty_on_hand AS qtyOnHand, avg_cost AS avgCost FROM items WHERE id = ? FOR UPDATE', [line.itemId]);
      const item = items[0];
      if (!item) { await connection.rollback(); return res.status(404).json({ error: `Item ${line.itemId} was not found.` }); }
      const [openReconciliation] = await connection.execute("SELECT id FROM negative_stock_reconciliation WHERE item_id = ? AND status = 'OPEN' LIMIT 1 FOR UPDATE", [line.itemId]);
      if (Number(item.qtyOnHand) < 0 || openReconciliation.length) {
        await connection.rollback();
        return res.status(409).json({ error: `${item.name} has an unresolved negative-stock reconciliation. An Admin must reconcile the physical count before receiving stock so WAC is not silently guessed.`, itemId: Number(line.itemId) });
      }
      const oldQty = Number(item.qtyOnHand);
      const receivedQty = incoming.quantity;
      const newQty = oldQty + receivedQty;
      const nextAverageCost = money4(((oldQty * Number(item.avgCost)) + (receivedQty * Number(line.unitCost))) / newQty);
      await connection.execute('UPDATE items SET qty_on_hand = ?, avg_cost = ? WHERE id = ?', [newQty, nextAverageCost, line.itemId]);
      await connection.execute(`
        INSERT INTO stock_movements (item_id, movement_type, qty_delta, unit_cost_at_time, reference_type, reference_id, reason, user_id)
        VALUES (?, 'PURCHASE_RECEIPT', ?, ?, 'PURCHASE', ?, ?, ?)
      `, [line.itemId, receivedQty, line.unitCost, purchaseId, `Receipt for ${purchase.purchaseNo}`, req.user.sub]);
      await connection.execute('UPDATE purchase_items SET quantity_received = quantity_received + ? WHERE id = ?', [receivedQty, incoming.purchaseItemId]);
      receivedSummary.push({ purchaseItemId: incoming.purchaseItemId, itemId: Number(line.itemId), quantityReceived: receivedQty, newQtyOnHand: newQty, newAverageCost: nextAverageCost });
    }
    const [freshLines] = await connection.execute('SELECT quantity_ordered AS ordered, quantity_received AS received FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
    const receivedCount = freshLines.reduce((sum, line) => sum + Number(line.received), 0);
    const orderedCount = freshLines.reduce((sum, line) => sum + Number(line.ordered), 0);
    const anyReceived = receivedCount > 0;
    const status = freshLines.every(line => Number(line.received) >= Number(line.ordered)) ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : 'ORDERED';
    await connection.execute('UPDATE purchases SET status = ?, received_by = ?, received_at = CASE WHEN ? = \'RECEIVED\' THEN CURRENT_TIMESTAMP ELSE received_at END WHERE id = ?', [status, req.user.sub, status, purchaseId]);
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, after_json) VALUES (?, ?, ?, ?, ?)', [req.user.sub, 'PURCHASE_RECEIVED', 'PURCHASE', purchaseId, JSON.stringify({ purchaseNo: purchase.purchaseNo, status, lines: receivedSummary })]);
    await connection.commit();
    res.json({ purchaseId, purchaseNo: purchase.purchaseNo, status, received: receivedSummary, message: 'Stock and weighted-average costs updated for received quantities.' });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

export default router;
