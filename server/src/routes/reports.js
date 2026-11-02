import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireModuleAccessFor } from '../middleware/permissions.js';

const router = Router();
router.use(requireAuth, requireModuleAccessFor(['Dashboard', 'Reports']));
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(String(value) + 'T00:00:00Z'));
const money2 = value => Number(Number(value || 0).toFixed(2));
const dateString = date => date.toISOString().slice(0, 10);

router.get('/summary', async (req, res, next) => {
  try {
    const today = new Date();
    const defaultTo = dateString(today);
    const start = new Date(today); start.setUTCDate(start.getUTCDate() - 6);
    const defaultFrom = dateString(start);
    const from = String(req.query.from || defaultFrom);
    const to = String(req.query.to || defaultTo);
    if (!isoDate(from) || !isoDate(to) || from > to) return res.status(400).json({ error: 'Use valid from/to dates in YYYY-MM-DD format, with from on or before to.' });
    const days = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 + 1;
    if (days > 366) return res.status(400).json({ error: 'Report range cannot exceed 366 days.' });

    const [saleRows] = await pool.execute(`
      SELECT COUNT(*) AS completedSales, COALESCE(SUM(total_amount),0) AS salesTotal,
        COALESCE(SUM(subtotal),0) AS subtotal, COALESCE(SUM(discount_total),0) AS discountTotal,
        COALESCE(SUM(tax_total),0) AS taxTotal
      FROM sales WHERE status = 'COMPLETED' AND DATE(completed_at) BETWEEN ? AND ?
    `, [from, to]);
    const [returnRows] = await pool.execute(`
      SELECT COUNT(*) AS completedReturns, COALESCE(SUM(refund_total),0) AS refundTotal
      FROM returns WHERE status = 'COMPLETED' AND DATE(completed_at) BETWEEN ? AND ?
    `, [from, to]);
    const [costRows] = await pool.execute(`
      SELECT COALESCE(SUM(si.quantity * si.unit_cost_snapshot),0) AS soldCost,
        COALESCE(SUM(CASE WHEN si.provisional_cost = 1 THEN si.quantity ELSE 0 END),0) AS provisionalQuantity
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'COMPLETED' AND DATE(s.completed_at) BETWEEN ? AND ?
    `, [from, to]);
    const [restockRows] = await pool.execute(`
      SELECT COALESCE(SUM(CASE WHEN ri.restock = 1 THEN ri.quantity * si.unit_cost_snapshot ELSE 0 END),0) AS restockedCost,
        COALESCE(SUM(CASE WHEN si.provisional_cost = 1 THEN ri.quantity ELSE 0 END),0) AS provisionalReturnQuantity
      FROM return_items ri JOIN returns r ON r.id = ri.return_id
      JOIN sale_items si ON si.id = ri.sale_item_id
      WHERE r.status = 'COMPLETED' AND DATE(r.completed_at) BETWEEN ? AND ?
    `, [from, to]);
    // Collections include only real payment records. Khata sales are receivables, not money collected.
    const [paymentRows] = await pool.execute(`
      SELECT p.method, COUNT(*) AS paymentCount,
        COALESCE(SUM(p.amount_received - p.change_due), 0) AS amount
      FROM payments p
      JOIN sales s ON s.id = p.sale_id
      WHERE s.status = 'COMPLETED' AND s.payment_status = 'PAID'
        AND DATE(s.completed_at) BETWEEN ? AND ?
      GROUP BY p.method
      ORDER BY amount DESC
    `, [from, to]);
    const [creditSalesRows] = await pool.execute(`
      SELECT COUNT(*) AS creditSalesCount, COALESCE(SUM(total_amount), 0) AS creditSalesTotal
      FROM sales
      WHERE status = 'COMPLETED' AND payment_status = 'CREDIT'
        AND DATE(completed_at) BETWEEN ? AND ?
    `, [from, to]);
    const [inventoryRows] = await pool.execute(`
      SELECT COUNT(*) AS itemCount,
        SUM(CASE WHEN qty_on_hand > 0 AND qty_on_hand <= reorder_threshold THEN 1 ELSE 0 END) AS lowStockCount,
        SUM(CASE WHEN qty_on_hand = 0 THEN 1 ELSE 0 END) AS outOfStockCount,
        SUM(CASE WHEN qty_on_hand < 0 THEN 1 ELSE 0 END) AS negativeStockCount,
        COALESCE(SUM(qty_on_hand * avg_cost),0) AS inventoryCostValue
      FROM items WHERE is_active = 1
    `);
    const [topSellingRows] = await pool.execute(`
      SELECT si.item_id AS itemId, si.item_name_snapshot AS name, si.sku_snapshot AS sku,
        SUM(si.quantity) AS unitsSold,
        COALESCE(ROUND(
          SUM(si.quantity * si.unit_price_actual)
          - SUM(CASE WHEN s.subtotal > 0
              THEN s.discount_total * (si.quantity * si.unit_price_actual) / s.subtotal
              ELSE 0 END), 2), 0) AS salesAmount
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'COMPLETED' AND DATE(s.completed_at) BETWEEN ? AND ?
      GROUP BY si.item_id, si.item_name_snapshot, si.sku_snapshot
      ORDER BY unitsSold DESC, salesAmount DESC LIMIT 5
    `, [from, to]);
    const [productSalesRows] = await pool.execute(`
      SELECT si.item_id AS itemId, si.item_name_snapshot AS name, si.sku_snapshot AS sku,
        SUM(si.quantity) AS unitsSold,
        SUM(COALESCE(returned.returnedQuantity, 0)) AS unitsReturned,
        ROUND(SUM(si.quantity * si.unit_price_actual), 2) AS grossSales,
        ROUND(SUM(COALESCE(si.discount_amount, 0) + CASE WHEN s.subtotal > 0
          THEN s.discount_total * (si.quantity * si.unit_price_actual) / s.subtotal ELSE 0 END), 2) AS discountAmount,
        ROUND(SUM(COALESCE(returned.refundedAmount, 0)), 2) AS refundAmount,
        ROUND(SUM(si.quantity * si.unit_price_actual)
          - SUM(COALESCE(si.discount_amount, 0) + CASE WHEN s.subtotal > 0
            THEN s.discount_total * (si.quantity * si.unit_price_actual) / s.subtotal ELSE 0 END)
          - SUM(COALESCE(returned.refundedAmount, 0)), 2) AS netSales
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN (
        SELECT ri.sale_item_id, SUM(ri.quantity) AS returnedQuantity,
          SUM(ri.refund_amount) AS refundedAmount
        FROM return_items ri JOIN returns r ON r.id = ri.return_id
        WHERE r.status = 'COMPLETED' AND DATE(r.completed_at) BETWEEN ? AND ?
        GROUP BY ri.sale_item_id
      ) returned ON returned.sale_item_id = si.id
      WHERE s.status = 'COMPLETED' AND DATE(s.completed_at) BETWEEN ? AND ?
      GROUP BY si.item_id, si.item_name_snapshot, si.sku_snapshot
      ORDER BY netSales DESC, unitsSold DESC
      LIMIT 250
    `, [from, to, from, to]);
    const [khataRows] = await pool.execute(`
      SELECT COALESCE(SUM(balance), 0) AS outstandingTotal, COUNT(*) AS customersOwing
      FROM (
        SELECT customer_id, SUM(CASE WHEN entry_type = 'CREDIT_SALE' THEN amount ELSE -amount END) AS balance
        FROM customer_credit_ledger GROUP BY customer_id
      ) balances WHERE balance > 0
    `);
    const mayViewSpendings = req.user.role === 'Admin' || Boolean(req.user.permissions?.modules?.includes('Spendings'));
    let spendingTrackingAvailable = null;
    let spendingSummary = null;
    let recentSpendings = [];
    if (mayViewSpendings) {
      spendingTrackingAvailable = true;
      spendingSummary = { totalAmount: 0, spendingCount: 0, categories: [], paymentModes: [] };
      try {
      const [spendSummaryRows] = await pool.execute(`
        SELECT COUNT(*) AS spendingCount, COALESCE(SUM(amount), 0) AS totalAmount
        FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
      `, [from, to]);
      const [spendCategoryRows] = await pool.execute(`
        SELECT category, COUNT(*) AS recordCount, COALESCE(SUM(amount), 0) AS amount
        FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
        GROUP BY category ORDER BY amount DESC, category LIMIT 8
      `, [from, to]);
      const [spendPaymentRows] = await pool.execute(`
        SELECT payment_mode AS paymentMode, COUNT(*) AS recordCount, COALESCE(SUM(amount), 0) AS amount
        FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
        GROUP BY payment_mode ORDER BY amount DESC
      `, [from, to]);
      const [recentSpendingRows] = await pool.execute(`
        SELECT id, spending_date AS spendingDate, category, description, amount,
          payment_mode AS paymentMode, paid_to AS paidTo
        FROM spendings WHERE status = 'RECORDED' AND spending_date BETWEEN ? AND ?
        ORDER BY spending_date DESC, id DESC LIMIT 5
      `, [from, to]);
      spendingSummary = {
        totalAmount: money2(spendSummaryRows[0]?.totalAmount || 0),
        spendingCount: Number(spendSummaryRows[0]?.spendingCount || 0),
        categories: spendCategoryRows.map(row => ({ category: row.category, recordCount: Number(row.recordCount), amount: money2(row.amount) })),
        paymentModes: spendPaymentRows.map(row => ({ paymentMode: row.paymentMode, recordCount: Number(row.recordCount), amount: money2(row.amount) })),
      };
      recentSpendings = recentSpendingRows.map(row => ({ ...row, id: Number(row.id), spendingDate: String(row.spendingDate).slice(0, 10), amount: money2(row.amount) }));
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE' && String(error.message || '').includes('spendings')) {
          spendingTrackingAvailable = false;
        } else {
          throw error;
        }
      }
    }
    const mayViewKhata = req.user.role === 'Admin' || (
      req.user.permissions?.modules?.includes('Customers') &&
      req.user.permissions?.columns?.Customers?.includes('outstandingBalance')
    );
    const [queueRows] = await pool.execute("SELECT COUNT(*) AS openReconciliations FROM negative_stock_reconciliation WHERE status = 'OPEN'");
    const [dailySales] = await pool.execute(`
      SELECT DATE(completed_at) AS day, COALESCE(SUM(total_amount),0) AS amount
      FROM sales WHERE status = 'COMPLETED' AND DATE(completed_at) BETWEEN ? AND ? GROUP BY DATE(completed_at)
    `, [from, to]);
    const [dailyReturns] = await pool.execute(`
      SELECT DATE(completed_at) AS day, COALESCE(SUM(refund_total),0) AS amount
      FROM returns WHERE status = 'COMPLETED' AND DATE(completed_at) BETWEEN ? AND ? GROUP BY DATE(completed_at)
    `, [from, to]);
    const [recent] = await pool.execute(`
      SELECT s.id, s.receipt_no AS receiptNo, s.total_amount AS totalAmount, s.completed_at AS completedAt,
        s.status, COALESCE(c.name, 'Walk-in Customer') AS customer, u.name AS cashier,
        CASE WHEN s.payment_status = 'CREDIT' THEN 'CREDIT'
          WHEN (SELECT COUNT(DISTINCT p2.method) FROM payments p2 WHERE p2.sale_id = s.id) > 1 THEN 'SPLIT'
          ELSE (SELECT MAX(p2.method) FROM payments p2 WHERE p2.sale_id = s.id) END AS paymentMethod
      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
      JOIN users u ON u.id = s.cashier_id
      ORDER BY s.completed_at DESC LIMIT 8
    `);
    const [settingsRows] = await pool.execute('SELECT currency_code AS currencyCode, currency_symbol AS currencySymbol, locale FROM business_settings WHERE id = 1');
    const sale = saleRows[0], ret = returnRows[0], cost = costRows[0], inventory = inventoryRows[0];
    const netRevenue = money2(Number(sale.salesTotal) - Number(ret.refundTotal));
    const provisionalQuantity = Number(cost.provisionalQuantity || 0) + Number(restockRows[0].provisionalReturnQuantity || 0);
    const cogs = money2(Number(cost.soldCost) - Number(restockRows[0].restockedCost));
    const grossProfit = provisionalQuantity > 0 ? null : money2(netRevenue - cogs);
    const productSales = productSalesRows.map(row => ({
      ...row,
      itemId: Number(row.itemId),
      unitsSold: Number(row.unitsSold || 0),
      unitsReturned: Number(row.unitsReturned || 0),
      grossSales: money2(row.grossSales),
      discountAmount: money2(row.discountAmount),
      refundAmount: money2(row.refundAmount),
      netSales: money2(row.netSales),
    }));
    const productSalesSummary = productSales.reduce((totals, row) => ({
      unitsSold: totals.unitsSold + row.unitsSold,
      unitsReturned: totals.unitsReturned + row.unitsReturned,
      grossSales: money2(totals.grossSales + row.grossSales),
      discountAmount: money2(totals.discountAmount + row.discountAmount),
      refundAmount: money2(totals.refundAmount + row.refundAmount),
      netSales: money2(totals.netSales + row.netSales),
    }), { unitsSold: 0, unitsReturned: 0, grossSales: 0, discountAmount: 0, refundAmount: 0, netSales: 0 });

    const salesByDay = new Map(dailySales.map(row => [dateString(new Date(row.day)), Number(row.amount)]));
    const refundsByDay = new Map(dailyReturns.map(row => [dateString(new Date(row.day)), Number(row.amount)]));
    const daily = [];
    for (let cursor = new Date(from + 'T00:00:00Z'); dateString(cursor) <= to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const day = dateString(cursor);
      const salesAmount = salesByDay.get(day) || 0;
      const refundAmount = refundsByDay.get(day) || 0;
      daily.push({ day, sales: money2(salesAmount), refunds: money2(refundAmount), netRevenue: money2(salesAmount - refundAmount) });
    }
    res.json({
      period: { from, to, days },
      currency: settingsRows[0] || { currencyCode: 'INR', currencySymbol: '₹' },
      summary: {
        completedSales: Number(sale.completedSales),
        completedReturns: Number(ret.completedReturns),
        salesTotal: money2(sale.salesTotal),
        refundsTotal: money2(ret.refundTotal),
        netRevenue,
        grossProfit,
        grossProfitAvailable: provisionalQuantity === 0,
        provisionalCostQuantity: provisionalQuantity,
        inventoryCostValue: money2(inventory.inventoryCostValue),
        activeItems: Number(inventory.itemCount || 0),
        lowStockCount: Number(inventory.lowStockCount || 0),
        outOfStockCount: Number(inventory.outOfStockCount || 0),
        negativeStockCount: Number(inventory.negativeStockCount || 0),
        openReconciliations: Number(queueRows[0].openReconciliations || 0),
        khataOutstanding: mayViewKhata ? money2(khataRows[0]?.outstandingTotal || 0) : null,
        customersOwing: mayViewKhata ? Number(khataRows[0]?.customersOwing || 0) : null,
        creditSalesTotal: mayViewKhata ? money2(creditSalesRows[0]?.creditSalesTotal || 0) : null,
        creditSalesCount: mayViewKhata ? Number(creditSalesRows[0]?.creditSalesCount || 0) : null,
        spendingTrackingAvailable,
        operatingSpendings: spendingTrackingAvailable ? spendingSummary.totalAmount : null,
        operatingSpendingCount: spendingTrackingAvailable ? spendingSummary.spendingCount : null,
      },
      payments: paymentRows.map(row => ({ method: row.method, paymentCount: Number(row.paymentCount), amount: money2(row.amount) })),
      daily,
      recentTransactions: recent.map(row => ({ ...row, totalAmount: money2(row.totalAmount) })),
      topSellingProducts: topSellingRows.map(row => ({ ...row, unitsSold: Number(row.unitsSold || 0), salesAmount: money2(row.salesAmount) })),
      productSales,
      productSalesSummary,
      spendingSummary: spendingTrackingAvailable ? spendingSummary : null,
      recentSpendings,
      spendingTrackingAvailable,
      notes: ['Net revenue subtracts refunds completed in the selected period.', 'Gross profit is hidden when sales or restock lines in the period include provisional cost snapshots.', 'Operating spendings are shown separately from employee expense deductions and payroll; this report does not combine all cost categories into net profit.'],
    });
  } catch (error) { next(error); }
});

export default router;
