import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Inventory']));
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const whole = value => Number.isSafeInteger(Number(value));
const reasonText = value => String(value || '').trim();

router.get('/movements', async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const itemId = req.query.itemId == null || req.query.itemId === '' ? null : Number(req.query.itemId);
    if (itemId !== null && !validId(itemId)) return res.status(400).json({ error: 'Invalid itemId.' });
    const [movements] = await pool.execute(`
      SELECT sm.id, sm.item_id AS itemId, i.name AS itemName, i.sku, sm.movement_type AS movementType,
        sm.qty_delta AS quantityDelta, sm.unit_cost_at_time AS unitCostAtTime,
        sm.reference_type AS referenceType, sm.reference_id AS referenceId, sm.reason,
        u.name AS createdBy, sm.created_at AS createdAt
      FROM stock_movements sm JOIN items i ON i.id = sm.item_id
      LEFT JOIN users u ON u.id = sm.user_id
      WHERE (? IS NULL OR sm.item_id = ?)
      ORDER BY sm.created_at DESC, sm.id DESC LIMIT ?
    `, [itemId, itemId, limit]);
    res.json({ movements });
  } catch (error) { next(error); }
});

router.get('/reconciliations', allowRoles('Admin', 'Manager'), async (_req, res, next) => {
  try {
    const [reconciliations] = await pool.execute(`
      SELECT r.id, r.sale_id AS saleId, s.receipt_no AS receiptNo, r.sale_item_id AS saleItemId,
        r.item_id AS itemId, i.name AS itemName, i.sku, r.shortage_qty AS shortageQty,
        r.reason, r.created_at AS createdAt, u.name AS createdBy
      FROM negative_stock_reconciliation r
      JOIN items i ON i.id = r.item_id
      JOIN sales s ON s.id = r.sale_id
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.status = 'OPEN' ORDER BY r.created_at, r.id
    `);
    res.json({ reconciliations });
  } catch (error) { next(error); }
});

router.post('/adjustments', allowRoles('Admin', 'Manager'), async (req, res, next) => {
  const itemId = Number(req.body?.itemId);
  const delta = Number(req.body?.delta);
  const reason = reasonText(req.body?.reason);
  const mode = String(req.body?.type || 'ADJUSTMENT');
  if (!validId(itemId)) return res.status(400).json({ error: 'A valid itemId is required.' });
  if (!whole(delta) || delta === 0) return res.status(400).json({ error: 'delta must be a non-zero whole number.' });
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'Reason must be 5–500 characters.' });
  if (!['ADJUSTMENT','DAMAGE_WRITE_OFF'].includes(mode)) return res.status(400).json({ error: 'type must be ADJUSTMENT or DAMAGE_WRITE_OFF.' });
  if (mode === 'DAMAGE_WRITE_OFF' && delta >= 0) return res.status(400).json({ error: 'A damage write-off must reduce stock.' });
  if (mode === 'DAMAGE_WRITE_OFF' && req.user.role !== 'Admin') return res.status(403).json({ error: 'Only Admin may record damaged-stock write-offs.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, name, qty_on_hand AS qtyOnHand, avg_cost AS avgCost FROM items WHERE id = ? AND is_active = 1 FOR UPDATE', [itemId]);
    const item = rows[0];
    if (!item) { await connection.rollback(); return res.status(404).json({ error: 'Item not found or inactive.' }); }
    if (Number(item.qtyOnHand) < 0) { await connection.rollback(); return res.status(409).json({ error: 'Resolve the open negative-stock reconciliation by physical count before making another adjustment.' }); }
    const nextQty = Number(item.qtyOnHand) + delta;
    if (nextQty < 0) { await connection.rollback(); return res.status(409).json({ error: `Adjustment would create negative stock. Available quantity: ${item.qtyOnHand}.`, available: Number(item.qtyOnHand) }); }
    const movementType = mode === 'DAMAGE_WRITE_OFF' ? 'DAMAGE_WRITE_OFF' : delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    await connection.execute('UPDATE items SET qty_on_hand = ? WHERE id = ?', [nextQty, itemId]);
    const [movement] = await connection.execute(`
      INSERT INTO stock_movements (item_id, movement_type, qty_delta, unit_cost_at_time, reference_type, reason, user_id)
      VALUES (?, ?, ?, ?, 'ADJUSTMENT', ?, ?)
    `, [itemId, movementType, delta, item.avgCost, reason, req.user.sub]);
    await connection.execute('UPDATE stock_movements SET reference_id = ? WHERE id = ?', [movement.insertId, movement.insertId]);
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.user.sub, movementType, 'ITEM_STOCK', itemId, JSON.stringify({ qtyOnHand: Number(item.qtyOnHand) }), JSON.stringify({ qtyOnHand: nextQty, movementId: movement.insertId }), reason]);
    await connection.commit();
    res.status(201).json({ movement: { id: movement.insertId, itemId, itemName: item.name, movementType, quantityDelta: delta, qtyOnHand: nextQty, unitCostAtTime: Number(item.avgCost), reason } });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

router.post('/reconciliations/:itemId/resolve', allowRoles('Admin'), async (req, res, next) => {
  const itemId = Number(req.params.itemId);
  const countedQty = Number(req.body?.countedQty);
  const reason = reasonText(req.body?.reason);
  if (!validId(itemId)) return res.status(400).json({ error: 'Invalid item ID.' });
  if (!whole(countedQty) || countedQty < 0) return res.status(400).json({ error: 'countedQty must be a non-negative whole number.' });
  if (reason.length < 10 || reason.length > 500) return res.status(400).json({ error: 'Reconciliation reason must be 10–500 characters.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.execute('SELECT id, name, qty_on_hand AS qtyOnHand, avg_cost AS avgCost FROM items WHERE id = ? FOR UPDATE', [itemId]);
    const item = items[0];
    if (!item) { await connection.rollback(); return res.status(404).json({ error: 'Item not found.' }); }
    const [queue] = await connection.execute("SELECT id, sale_id AS saleId, sale_item_id AS saleItemId, shortage_qty AS shortageQty FROM negative_stock_reconciliation WHERE item_id = ? AND status = 'OPEN' FOR UPDATE", [itemId]);
    if (!queue.length) { await connection.rollback(); return res.status(404).json({ error: 'No open reconciliation exists for this item.' }); }
    const oldQty = Number(item.qtyOnHand);
    const delta = countedQty - oldQty;
    let movementId = null;
    if (delta !== 0) {
      const movementType = delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      const [movement] = await connection.execute(`
        INSERT INTO stock_movements (item_id, movement_type, qty_delta, unit_cost_at_time, reference_type, reason, user_id)
        VALUES (?, ?, ?, ?, 'RECONCILIATION', ?, ?)
      `, [itemId, movementType, delta, item.avgCost, reason, req.user.sub]);
      movementId = movement.insertId;
      await connection.execute('UPDATE stock_movements SET reference_id = ? WHERE id = ?', [movementId, movementId]);
      await connection.execute('UPDATE items SET qty_on_hand = ? WHERE id = ?', [countedQty, itemId]);
    }
    await connection.execute(`
      UPDATE negative_stock_reconciliation
      SET status = 'RESOLVED', resolved_counted_qty = ?, resolution_reason = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE item_id = ? AND status = 'OPEN'
    `, [countedQty, reason, req.user.sub, itemId]);
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      req.user.sub, 'NEGATIVE_STOCK_RECONCILED', 'ITEM_STOCK', itemId,
      JSON.stringify({ qtyOnHand: oldQty, openQueueCount: queue.length }),
      JSON.stringify({ qtyOnHand: countedQty, movementId, resolvedQueueIds: queue.map(row => row.id), provisionalSaleCostsRetained: true }),
      reason,
    ]);
    await connection.commit();
    res.json({ itemId, itemName: item.name, previousQty: oldQty, countedQty, delta, resolvedCount: queue.length, movementId,
      note: 'Quantity reconciliation completed. Historical provisional sale-cost snapshots are retained; this operation does not restate their cost basis.' });
  } catch (error) { await connection.rollback(); next(error); }
  finally { connection.release(); }
});

export default router;
