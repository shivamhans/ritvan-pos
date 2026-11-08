import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, allowRoles('Admin', 'Manager'), requireModuleAccessFor(['Returns & Refunds']));
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const money2 = value => Number(Number(value).toFixed(2));
const returnNumber = () => 'RET-' + new Date().toISOString().slice(2, 10).replaceAll('-', '') + '-' + randomUUID().slice(0, 6).toUpperCase();

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const [rows] = await pool.execute(`
      SELECT r.id, r.return_no AS returnNo, r.sale_id AS saleId, s.receipt_no AS receiptNo,
        COALESCE(c.name, 'Walk-in Customer') AS customer, r.status, r.refund_total AS refundTotal,
        r.reason, r.created_at AS createdAt, r.completed_at AS completedAt, u.name AS processedBy,
        rp.method AS refundMethod
      FROM returns r JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = r.processed_by
      LEFT JOIN return_payments rp ON rp.return_id = r.id
      WHERE (? = '' OR r.return_no LIKE ? OR s.receipt_no LIKE ? OR COALESCE(c.name,'Walk-in Customer') LIKE ? OR r.status LIKE ?)
      ORDER BY r.created_at DESC LIMIT 200
    `, [q, '%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%']);
    res.json({ returns: rows });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!validId(id)) return res.status(400).json({ error: 'Invalid return ID.' });
  try {
    const [rows] = await pool.execute(`
      SELECT r.id, r.return_no AS returnNo, r.sale_id AS saleId, s.receipt_no AS receiptNo,
        r.status, r.refund_total AS refundTotal, r.reason, r.created_at AS createdAt,
        r.completed_at AS completedAt, COALESCE(c.name, 'Walk-in Customer') AS customer,
        u.name AS processedBy, rp.method AS refundMethod, rp.reference_no AS referenceNo
      FROM returns r JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = r.processed_by
      LEFT JOIN return_payments rp ON rp.return_id = r.id WHERE r.id = ? LIMIT 1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Return not found.' });
    const [lines] = await pool.execute(`
      SELECT ri.id, ri.sale_item_id AS saleItemId, si.item_name_snapshot AS itemName,
        si.sku_snapshot AS sku, ri.quantity, ri.restock, ri.condition_note AS conditionNote,
        ri.refund_amount AS refundAmount, si.unit_cost_snapshot AS unitCostSnapshot
      FROM return_items ri JOIN sale_items si ON si.id = ri.sale_item_id WHERE ri.return_id = ? ORDER BY ri.id
    `, [id]);
    res.json({ return: { ...rows[0], lines } });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  const saleInput = String(req.body?.receiptNo || '').trim();
  const saleIdInput = Number(req.body?.saleId);
  const reason = String(req.body?.reason || '').trim();
  const refundMethod = String(req.body?.refundMethod || '');
  const referenceNo = req.body?.referenceNo == null ? null : String(req.body.referenceNo).trim() || null;
  const inputLines = req.body?.lines;
  if ((!validId(saleIdInput) && !saleInput) || saleInput.length > 60) return res.status(400).json({ error: 'Provide a valid saleId or receiptNo.' });
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'Return reason must be 5–500 characters.' });
  if (!['Cash', 'UPI', 'Card'].includes(refundMethod)) return res.status(400).json({ error: 'Choose Cash, UPI, or Card as the refund settlement record.' });
  if (referenceNo && referenceNo.length > 120) return res.status(400).json({ error: 'Reference number is too long.' });
  if (!Array.isArray(inputLines) || inputLines.length < 1 || inputLines.length > 100) return res.status(400).json({ error: 'Choose between 1 and 100 sale lines to return.' });

  const seen = new Set();
  const requestLines = [];
  for (const line of inputLines) {
    const saleItemId = Number(line.saleItemId);
    const quantity = Number(line.quantity);
    if (!validId(saleItemId) || !Number.isSafeInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Each return line requires a valid sale item and positive whole quantity.' });
    if (seen.has(saleItemId)) return res.status(400).json({ error: 'Each sale line may only appear once in a return.' });
    seen.add(saleItemId);
    if (![true, false, 0, 1].includes(line.restock)) return res.status(400).json({ error: 'Choose whether each returned item is restocked.' });
    const conditionNote = line.conditionNote == null ? null : String(line.conditionNote).trim() || null;
    if (conditionNote && conditionNote.length > 300) return res.status(400).json({ error: 'Item condition note must be 300 characters or fewer.' });
    requestLines.push({ saleItemId, quantity, restock: Boolean(line.restock), conditionNote });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [sales] = await connection.execute(`
      SELECT id, receipt_no AS receiptNo, customer_id AS customerId, status, payment_status AS paymentStatus, subtotal,
        discount_total AS discountTotal, tax_total AS taxTotal, total_amount AS totalAmount
      FROM sales
      WHERE (? > 0 AND id = ?) OR (? <> '' AND receipt_no = ?)
      LIMIT 1 FOR UPDATE
    `, [validId(saleIdInput) ? saleIdInput : 0, validId(saleIdInput) ? saleIdInput : 0, saleInput, saleInput]);
    const sale = sales[0];
    if (!sale || sale.status !== 'COMPLETED') { await connection.rollback(); return res.status(404).json({ error: 'A completed sale matching that receipt could not be found.' }); }
    if (sale.paymentStatus === 'CREDIT' && sale.customerId != null) {
      const [balanceRows] = await connection.execute(`SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT_SALE' THEN amount ELSE -amount END), 0) AS balance FROM customer_credit_ledger WHERE customer_id = ?`, [sale.customerId]);
      if (Number(balanceRows[0]?.balance || 0) > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'This customer still has an outstanding Khata balance. Settle the customer account before using the standard cash/UPI/card refund workflow; Khata return adjustments are not implemented yet.' });
      }
    }

    const [soldRows] = await connection.execute(`
      SELECT id AS saleItemId, item_id AS itemId, item_name_snapshot AS itemName, sku_snapshot AS sku,
        quantity, unit_price_actual AS unitPrice, unit_cost_snapshot AS unitCost, discount_amount AS lineDiscount,
        provisional_cost AS provisionalCost
      FROM sale_items WHERE sale_id = ? ORDER BY id FOR UPDATE
    `, [sale.id]);
    const soldById = new Map(soldRows.map(row => [Number(row.saleItemId), row]));
    const [previous] = await connection.execute(`
      SELECT ri.sale_item_id AS saleItemId, SUM(ri.quantity) AS quantityReturned, SUM(ri.refund_amount) AS refundTotal
      FROM return_items ri JOIN returns r ON r.id = ri.return_id
      WHERE r.sale_id = ? AND r.status = 'COMPLETED' GROUP BY ri.sale_item_id
    `, [sale.id]);
    const previousById = new Map(previous.map(row => [Number(row.saleItemId), row]));
    const [previousTotalRows] = await connection.execute("SELECT COALESCE(SUM(refund_total),0) AS total FROM returns WHERE sale_id = ? AND status = 'COMPLETED'", [sale.id]);
    const previousRefundTotal = Number(previousTotalRows[0].total);
    const remainder = Math.max(0, money2(Number(sale.totalAmount) - previousRefundTotal));
    if (remainder <= 0) { await connection.rollback(); return res.status(409).json({ error: 'This sale has already been fully refunded.' }); }
    const saleSubtotal = Number(sale.subtotal);
    if (saleSubtotal <= 0) { await connection.rollback(); return res.status(409).json({ error: 'A zero-subtotal sale cannot be refunded by this workflow.' }); }

    const resolved = [];
    for (const requested of requestLines) {
      const sold = soldById.get(requested.saleItemId);
      if (!sold) { await connection.rollback(); return res.status(400).json({ error: 'A selected sale line does not belong to this receipt.' }); }
      const alreadyReturned = Number(previousById.get(requested.saleItemId)?.quantityReturned || 0);
      const available = Number(sold.quantity) - alreadyReturned;
      if (requested.quantity > available) {
        await connection.rollback();
        return res.status(409).json({ error: sold.itemName + ' has only ' + available + ' unit(s) remaining to return.', saleItemId: requested.saleItemId, available });
      }
      if (requested.restock && Boolean(Number(sold.provisionalCost))) {
        await connection.rollback();
        return res.status(409).json({ error: sold.itemName + ' has a provisional cost snapshot from a negative-stock override. Resolve the cost-basis policy before restocking this returned line; no WAC estimate will be guessed.' });
      }
      resolved.push({ ...requested, sold, refundAmount: 0 });
    }
    resolved.sort((a, b) => Number(a.sold.itemId) - Number(b.sold.itemId));

    let refundTotal = 0;
    for (const line of resolved) {
      const gross = Number(line.sold.unitPrice) * line.quantity;
      const discountShare = Number(line.sold.lineDiscount || 0) * line.quantity / Number(line.sold.quantity)
        + Math.max(0, Number(sale.discountTotal)) * gross / saleSubtotal;
      const taxShare = Math.max(0, Number(sale.taxTotal)) * gross / saleSubtotal;
      line.refundAmount = money2(Math.max(0, gross - discountShare + taxShare));
      refundTotal = money2(refundTotal + line.refundAmount);
    }
    if (refundTotal > remainder) {
      let excess = money2(refundTotal - remainder);
      for (let index = resolved.length - 1; index >= 0 && excess > 0; index--) {
        const line = resolved[index];
        const reduction = Math.min(line.refundAmount, excess);
        line.refundAmount = money2(Math.max(0, line.refundAmount - reduction));
        excess = money2(Math.max(0, excess - reduction));
      }
      refundTotal = money2(resolved.reduce((sum, line) => sum + line.refundAmount, 0));
      if (refundTotal > remainder || excess > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'The remaining refund balance is smaller than the calculated return amount. Reconcile prior refunds before continuing.' });
      }
    }
    if (refundTotal <= 0) { await connection.rollback(); return res.status(409).json({ error: 'Calculated refund amount is zero. Check the sale lines and previous refunds.' }); }

    const returnNo = returnNumber();
    const [header] = await connection.execute(`
      INSERT INTO returns (return_no, sale_id, processed_by, status, refund_total, reason, completed_at)
      VALUES (?, ?, ?, 'DRAFT', 0, ?, NULL)
    `, [returnNo, sale.id, req.user.sub, reason]);
    const returnId = header.insertId;
    const details = [];
    for (const line of resolved) {
      await connection.execute(`
        INSERT INTO return_items (return_id, sale_item_id, quantity, restock, condition_note, refund_amount)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [returnId, line.saleItemId, line.quantity, line.restock ? 1 : 0, line.conditionNote, line.refundAmount]);
      if (line.restock) {
        const [itemRows] = await connection.execute('SELECT id, name, qty_on_hand AS qtyOnHand, avg_cost AS avgCost FROM items WHERE id = ? FOR UPDATE', [line.sold.itemId]);
        const item = itemRows[0];
        if (!item) { await connection.rollback(); return res.status(409).json({ error: 'Inventory record for ' + line.sold.itemName + ' is missing.' }); }
        const [openQueue] = await connection.execute("SELECT id FROM negative_stock_reconciliation WHERE item_id = ? AND status = 'OPEN' LIMIT 1 FOR UPDATE", [line.sold.itemId]);
        if (Number(item.qtyOnHand) < 0 || openQueue.length) {
          await connection.rollback();
          return res.status(409).json({ error: item.name + ' has unresolved negative stock. Resolve its physical count before restocking a return.' });
        }
        const oldQty = Number(item.qtyOnHand);
        const newQty = oldQty + line.quantity;
        const nextAvgCost = Number(((oldQty * Number(item.avgCost)) + (line.quantity * Number(line.sold.unitCost))) / newQty).toFixed(4);
        await connection.execute('UPDATE items SET qty_on_hand = ?, avg_cost = ? WHERE id = ?', [newQty, nextAvgCost, item.id]);
        await connection.execute(`
          INSERT INTO stock_movements (item_id, movement_type, qty_delta, unit_cost_at_time, reference_type, reference_id, reason, user_id)
          VALUES (?, 'RETURN_RESTOCK', ?, ?, 'RETURN', ?, ?, ?)
        `, [item.id, line.quantity, line.sold.unitCost, returnId, 'Restock from ' + returnNo, req.user.sub]);
      }
      details.push({ saleItemId: line.saleItemId, itemName: line.sold.itemName, quantity: line.quantity, restock: line.restock, refundAmount: line.refundAmount });
    }

    await connection.execute('INSERT INTO return_payments (return_id, method, amount, reference_no) VALUES (?, ?, ?, ?)',
      [returnId, refundMethod.toUpperCase(), refundTotal, referenceNo]);
    await connection.execute("UPDATE returns SET status = 'COMPLETED', refund_total = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?", [refundTotal, returnId]);
    await connection.execute('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.sub, 'RETURN_COMPLETED', 'RETURN', returnId,
        JSON.stringify({ saleId: Number(sale.id), receiptNo: sale.receiptNo, previouslyRefunded: previousRefundTotal }),
        JSON.stringify({ returnNo, refundTotal, refundMethod, lines: details }), reason]);
    await connection.commit();
    res.status(201).json({ return: { id: returnId, returnNo, saleId: Number(sale.id), receiptNo: sale.receiptNo, status: 'COMPLETED', refundTotal, refundMethod, lines: details },
      message: 'Return saved. This records the declared manual refund settlement; no payment gateway is connected.' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate return reference; retry the request.' });
    next(error);
  } finally { connection.release(); }
});

export default router;
