import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Transactions']));

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = Math.min(100000, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
    const [sales] = await pool.execute(`
      SELECT s.id, s.receipt_no AS receiptNo, s.status, s.subtotal, s.discount_total AS discountTotal,
        s.tax_total AS taxTotal, s.total_amount AS totalAmount, s.payment_status AS paymentStatus,
        s.negative_stock_override AS negativeStockOverride, DATE_FORMAT(s.completed_at, '%Y-%m-%dT%H:%i:%s') AS completedAt,
        c.id AS customerId, COALESCE(c.name, 'Walk-in Customer') AS customer,
        u.name AS cashier,
        CASE WHEN s.payment_status = 'CREDIT' THEN 'CREDIT'
          WHEN (SELECT COUNT(DISTINCT p2.method) FROM payments p2 WHERE p2.sale_id = s.id) > 1 THEN 'SPLIT'
          ELSE (SELECT MAX(p2.method) FROM payments p2 WHERE p2.sale_id = s.id) END AS paymentMethod,
        (SELECT COALESCE(SUM(p2.amount_received),0) FROM payments p2 WHERE p2.sale_id = s.id) AS amountReceived,
        (SELECT COALESCE(SUM(p2.change_due),0) FROM payments p2 WHERE p2.sale_id = s.id) AS changeDue,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS lineCount,
        (SELECT COALESCE(SUM(si.provisional_cost),0) FROM sale_items si WHERE si.sale_id = s.id) AS provisionalCostLineCount
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      JOIN users u ON u.id = s.cashier_id
      WHERE (? = '' OR s.receipt_no LIKE ? OR COALESCE(c.name,'Walk-in Customer') LIKE ? OR u.name LIKE ? OR s.status LIKE ?)
      ORDER BY s.completed_at DESC, s.id DESC LIMIT ? OFFSET ?
    `, [q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit, offset]);
    const [counts] = await pool.execute(`
      SELECT COUNT(*) AS total FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.cashier_id
      WHERE (? = '' OR s.receipt_no LIKE ? OR COALESCE(c.name,'Walk-in Customer') LIKE ? OR u.name LIKE ? OR s.status LIKE ?)
    `, [q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
    res.json({ transactions: sales, page: { limit, offset, total: Number(counts[0].total) } });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  const input = String(req.params.id || '').trim();
  if (!input || input.length > 60) return res.status(400).json({ error: 'Invalid transaction identifier.' });
  try {
    const saleHeaderSql = `
      SELECT s.id, s.receipt_no AS receiptNo, s.status, s.subtotal, s.discount_total AS discountTotal,
        s.tax_total AS taxTotal, s.total_amount AS totalAmount, s.payment_status AS paymentStatus,
        s.negative_stock_override AS negativeStockOverride, s.stock_override_reason AS stockOverrideReason,
        DATE_FORMAT(s.completed_at, '%Y-%m-%dT%H:%i:%s') AS completedAt, c.id AS customerId, COALESCE(c.name, 'Walk-in Customer') AS customer,
        u.name AS cashier
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.cashier_id
    `;
    let rows = [];
    // Receipt numbers have an alphanumeric suffix (for example ...-D275),
    // so accept the final four letters/digits as well as four numeric digits.
    // Resolve a suffix before exact numeric IDs to avoid choosing the wrong sale.
    if (/^[A-Z0-9]{4}$/i.test(input)) {
      let suffixSql = 'SELECT id FROM sales WHERE RIGHT(UPPER(receipt_no), 4) = UPPER(?)';
      const suffixParams = [input];
      if (/^\d{4}$/.test(input)) {
        suffixSql += ' OR RIGHT(CAST(id AS CHAR), 4) = ?';
        suffixParams.push(input);
      }
      const [matches] = await pool.execute(suffixSql + ' ORDER BY id DESC LIMIT 2', suffixParams);
      if (matches.length > 1) {
        return res.status(409).json({ error: 'More than one sale matches those last four characters. Enter the full receipt number or sale ID.' });
      }
      if (matches.length === 1) {
        [rows] = await pool.execute(saleHeaderSql + ' WHERE s.id = ? LIMIT 1', [matches[0].id]);
      }
    } else {
      [rows] = await pool.execute(saleHeaderSql + ' WHERE s.id = ? OR s.receipt_no = ? LIMIT 1',
        [Number.isSafeInteger(Number(input)) ? Number(input) : -1, input]);
    }
    if (!rows[0]) return res.status(404).json({ error: 'Transaction not found. For a return, you can enter a full receipt number or its last four characters (letters or digits).' });
    const sale = rows[0];
    const [lines] = await pool.execute(`
      SELECT id AS saleItemId, item_id AS itemId, item_name_snapshot AS itemName,
        sku_snapshot AS sku, quantity, unit_price_actual AS unitPrice,
        unit_cost_snapshot AS unitCostSnapshot, discount_amount AS discountAmount,
        price_override AS priceOverride, override_reason AS overrideReason, provisional_cost AS provisionalCost
      FROM sale_items WHERE sale_id = ? ORDER BY id
    `, [sale.id]);
    const [payments] = await pool.execute(`
      SELECT id, method, amount_received AS amountReceived, change_due AS changeDue,
        reference_no AS referenceNo, paid_at AS paidAt FROM payments WHERE sale_id = ?
    `, [sale.id]);
    res.json({ transaction: { ...sale, lines, payments } });
  } catch (error) { next(error); }
});

export default router;
