import React, { useEffect, useMemo, useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import { apiRequest, toUiItems } from './lib/api.js';
import LiveModulePage from './LiveModulePage.jsx';
import EmployeesPage from './EmployeesPage.jsx';
import AccountProfilePage from './AccountProfilePage.jsx';
import {
  Activity, ArrowDownRight, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3,
  Bell, Boxes, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Command, CreditCard, Download, Ellipsis, FileBarChart,
  FileClock, Filter, Gauge, LayoutDashboard, LifeBuoy, LogOut, Menu, Moon, MoreHorizontal,
  Package, PackageCheck, PackagePlus, Plus, Search, Settings, ShieldCheck, ShoppingBag,
  ShoppingCart, SlidersHorizontal, Sparkles, Sun, Tag, Truck, Users, Wallet, X, Zap,
  ReceiptText, ScanBarcode, RotateCcw, TrendingUp, CircleDollarSign, Warehouse, UserRound, RefreshCw, CircleCheck,
  ChevronUp, AlertTriangle, CheckCheck, Printer, Banknote, Smartphone, MessageCircle, BookOpen, CreditCard as CardIcon
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';

const APP_ROLE_MODULES = {
  Admin: ['Dashboard', 'Point of Sale', 'Transactions', 'Inventory', 'Items', 'Categories', 'Purchases', 'Suppliers', 'Customers', 'Staff & Roles', 'Employees', 'Spendings', 'Reports', 'Returns & Refunds', 'Settings'],
  Manager: ['Dashboard', 'Point of Sale', 'Transactions', 'Inventory', 'Items', 'Categories', 'Purchases', 'Suppliers', 'Customers', 'Spendings', 'Reports', 'Returns & Refunds'],
  Cashier: ['Dashboard', 'Point of Sale', 'Transactions'],
};

const navGroups = [
  { label: 'WORKSPACE', items: [
    { id: 'Dashboard', icon: LayoutDashboard }, { id: 'Point of Sale', icon: ShoppingCart, badge: '⌘K' },
    { id: 'Transactions', icon: ReceiptText },
  ]},
  { label: 'CATALOG & STOCK', items: [
    { id: 'Inventory', icon: Boxes }, { id: 'Items', icon: Package }, { id: 'Categories', icon: Tag },
    { id: 'Purchases', icon: PackagePlus }, { id: 'Suppliers', icon: Truck },
  ]},
  { label: 'RELATIONSHIPS', items: [ { id: 'Customers', icon: Users }, { id: 'Staff & Roles', icon: ShieldCheck }, { id: 'Employees', icon: BriefcaseBusiness } ]},
  { label: 'INSIGHTS', items: [ { id: 'Reports', icon: FileBarChart }, { id: 'Spendings', icon: Wallet }, { id: 'Returns & Refunds', icon: RotateCcw } ]},
];
const initialItems = [
  { id: 'NX-1001', name: 'Cloud Nine Sparkling Water', category: 'Beverages', sku: 'CW-240-01', price: 2.8, cost: 1.24, stock: 142, status: 'In stock', color: 'mint', icon: '◉' },
  { id: 'NX-1002', name: 'Morning Ritual Coffee', category: 'Beverages', sku: 'CF-100-02', price: 14.5, cost: 7.1, stock: 8, status: 'Low stock', color: 'amber', icon: '◌' },
  { id: 'NX-1003', name: 'Almond Butter Bites', category: 'Snacks', sku: 'SN-320-03', price: 6.25, cost: 2.6, stock: 64, status: 'In stock', color: 'rose', icon: '◈' },
  { id: 'NX-1004', name: 'Ceramic Travel Mug', category: 'Accessories', sku: 'AC-510-04', price: 22, cost: 11.8, stock: 0, status: 'Out of stock', color: 'lavender', icon: '◐' },
  { id: 'NX-1005', name: 'Matcha Energy Blend', category: 'Beverages', sku: 'CW-240-05', price: 9.8, cost: 4.4, stock: 31, status: 'In stock', color: 'mint', icon: '✳' },
  { id: 'NX-1006', name: 'Dark Cocoa Granola', category: 'Snacks', sku: 'SN-320-06', price: 8.4, cost: 3.25, stock: 5, status: 'Low stock', color: 'amber', icon: '✦' },
  { id: 'NX-1007', name: 'Oat Milk Original', category: 'Dairy alternatives', sku: 'DA-210-07', price: 4.2, cost: 1.95, stock: 92, status: 'In stock', color: 'blue', icon: '◍' },
  { id: 'NX-1008', name: 'Reusable Tote Bag', category: 'Accessories', sku: 'AC-510-08', price: 5.5, cost: 1.1, stock: 3, status: 'Low stock', color: 'rose', icon: '▱' },
];
const salesData = [
  { day: 'Mon', sales: 3200, orders: 44 }, { day: 'Tue', sales: 4100, orders: 51 }, { day: 'Wed', sales: 3600, orders: 47 },
  { day: 'Thu', sales: 5100, orders: 63 }, { day: 'Fri', sales: 4700, orders: 58 }, { day: 'Sat', sales: 6800, orders: 82 }, { day: 'Sun', sales: 5900, orders: 73 },
];
const recentSales = [
  { id: '#NX-00842', customer: 'Olivia Rhye', initials: 'OR', color: 'purple', date: 'Today, 10:42 AM', amount: 128.5, method: 'Card', status: 'Completed' },
  { id: '#NX-00841', customer: 'Phoenix Baker', initials: 'PB', color: 'blue', date: 'Today, 10:31 AM', amount: 74.2, method: 'UPI', status: 'Completed' },
  { id: '#NX-00840', customer: 'Lana Steiner', initials: 'LS', color: 'pink', date: 'Today, 10:18 AM', amount: 216.0, method: 'Cash', status: 'Completed' },
  { id: '#NX-00839', customer: 'Demi Wilkinson', initials: 'DW', color: 'amber', date: 'Today, 09:56 AM', amount: 42.8, method: 'Card', status: 'Completed' },
];
const formatMoney = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatShort = (n) => `₹${(n / 1000).toFixed(1)}k`;

function BrandMark() { return <div className="brand-mark"><span></span><span></span><span></span><span></span></div>; }
function Pill({ children, tone = 'neutral', dot = false }) { return <span className={`pill pill-${tone}`}>{dot && <i />}{children}</span>; }
function Button({ children, variant = 'secondary', icon: Icon, onClick, className = '', ...props }) { return <button className={`btn btn-${variant} ${className}`} onClick={onClick} {...props}>{Icon && <Icon size={16} strokeWidth={2} />}{children}</button>; }
function SectionTitle({ eyebrow, title, subtitle, action }) { return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="title-actions">{action}</div>}</div>; }
function StatCard({ icon: Icon, label, value, change, trend = 'up', note, accent = 'violet' }) { return <div className="stat-card glass-card"><div className="stat-top"><div className={`stat-icon icon-${accent}`}><Icon size={19} /></div>{change && <span className={`trend trend-${trend}`}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}</span>}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
function Avatar({ initials, color = 'purple', size = '' }) { return <span className={`avatar avatar-${color} ${size}`}>{initials}</span>; }
function EmptyState({ icon: Icon = Package, title, text, action }) { return <div className="empty-state"><div className="empty-icon"><Icon size={24} /></div><h3>{title}</h3><p>{text}</p>{action}</div>; }

function Dashboard({ items, onNavigate, isLive = false, auth, currency = 'INR' }) {
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(Boolean(isLive));
  const [reportError, setReportError] = useState('');
  const [rangeDays, setRangeDays] = useState(7);
  const [refreshKey, setRefreshKey] = useState(0);
  const paymentColors = { UPI: '#7968e8', Cash: '#f3b65f', Card: '#4fbda0', Khata: '#5e9de7' };
  const currencySymbol = reportData?.currency?.currencySymbol || ({ INR: '₹', USD: '$', GBP: '£', EUR: '€' }[currency] || currency + ' ');
  const formatAmount = value => currencySymbol + Number(value || 0).toLocaleString(reportData?.currency?.locale || 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const localDate = value => {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!isLive || !auth?.token) {
      setReportLoading(false);
      setReportError('');
      setReportData(null);
      return;
    }
    let cancelled = false;
    const to = localDate(new Date());
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - (rangeDays - 1));
    const from = localDate(fromDate);
    setReportLoading(true);
    setReportError('');
    setReportData(null);
    apiRequest('/reports/summary?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), { token: auth.token })
      .then(data => {
        if (cancelled) return;
        setReportData(data);
        setReportError('');
      })
      .catch(error => {
        if (cancelled) return;
        setReportData(null);
        const detail = error.message || 'Could not load dashboard metrics.';
        setReportError(detail.includes("doesn't exist") || detail.includes('does not exist')
          ? detail + '. Apply database/phase4-migration.sql in MySQL Workbench, then retry.'
          : detail);
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [isLive, auth?.token, rangeDays, refreshKey]);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = auth?.user?.name?.trim().split(/\s+/)[0] || (isLive ? 'there' : 'Alex');
  const headingDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  const summary = reportData?.summary;
  const demo = !isLive;
  const canViewKhata = auth?.user?.role === 'Admin' || (
    auth?.user?.permissions?.modules?.includes('Customers') &&
    auth?.user?.permissions?.columns?.Customers?.includes('outstandingBalance')
  );
  const canViewSpendings = auth?.user?.role === 'Admin' || Boolean(auth?.user?.permissions?.modules?.includes('Spendings'));
  const loading = isLive && reportLoading;
  const hasData = demo || Boolean(reportData);
  const revenue = demo ? 24580 : summary?.netRevenue;
  const orders = demo ? 384 : summary?.completedSales;
  const grossProfit = demo ? 8426.5 : summary?.grossProfit;
  const inventoryValue = demo ? 182940 : summary?.inventoryCostValue;
  const dailyRows = demo ? salesData.map(row => ({ ...row, dayLabel: row.day, refunds: 0 })) :
    (reportData?.daily || []).map(row => ({ ...row, dayLabel: new Date(row.day + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }));
  const totalPeriodSales = demo ? 33400 : (reportData?.daily || []).reduce((sum, row) => sum + Number(row.sales || 0), 0);
  const paymentAmount = method => demo
    ? ({ UPI: 32308, Cash: 1208, Card: 2058, Khata: 653 }[method] || 0)
    : (reportData?.payments || []).filter(row => String(row.method || '').toUpperCase() === method.toUpperCase())
      .reduce((total, row) => total + Number(row.amount || 0), 0);
  const paymentBreakdownAmounts = [
    { method: 'UPI', amount: paymentAmount('UPI') },
    { method: 'Cash', amount: paymentAmount('Cash') },
    { method: 'Card', amount: paymentAmount('Card') },
    ...((canViewKhata || demo) ? [{ method: 'Khata', amount: demo ? 653 : Number(summary?.creditSalesTotal || 0), isCredit: true }] : []),
  ];
  const paymentBreakdownTotal = paymentBreakdownAmounts.reduce((total, row) => total + Number(row.amount || 0), 0);
  const paymentBreakdown = paymentBreakdownAmounts.map(row => ({
    ...row,
    percentage: paymentBreakdownTotal > 0 ? Number(row.amount || 0) / paymentBreakdownTotal * 100 : 0,
    color: paymentColors[row.method],
  }));
  const hasPaymentActivity = paymentBreakdownTotal > 0;
  const recentRows = demo ? recentSales : (reportData?.recentTransactions || []).map(row => ({
    ...row,
    id: row.receiptNo,
    date: row.completedAt ? new Date(row.completedAt).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—',
    amount: Number(row.totalAmount || 0),
    method: String(row.paymentMethod || '').toUpperCase() === 'UPI' ? 'UPI' : String(row.paymentMethod || '').toUpperCase() === 'CASH' ? 'Cash' : String(row.paymentMethod || '').toUpperCase() === 'CARD' ? 'Card' : String(row.paymentMethod || '').toUpperCase() === 'CREDIT' ? 'Credit' : String(row.paymentMethod || '').toUpperCase() === 'SPLIT' ? 'Split' : '—',
    initials: String(row.customer || 'Walk-in').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join(''),
    color: 'purple',
  }));
  const topSellingRows = demo ? [] : (reportData?.topSellingProducts || []);
  const isLow = item => Number(item.stock) > 0 && Number(item.stock) <= Number(item.reorderThreshold ?? 8);
  const isOut = item => Number(item.stock) <= 0;
  const stockAttention = items.filter(item => isLow(item) || isOut(item)).sort((a, b) => Number(a.stock) - Number(b.stock)).slice(0, 4);
  const stockAlertCount = demo ? lowStockCountForDemo(items) : Number(summary?.lowStockCount || 0) + Number(summary?.outOfStockCount || 0);
  const unavailable = message => <EmptyState icon={reportError ? AlertTriangle : Package} title={reportError ? 'Dashboard data unavailable' : 'No data for this period'} text={message}/>;

  return <>
    <SectionTitle eyebrow={headingDate} title={greeting + ', ' + firstName + ' ✨'} subtitle="Here's what's happening with your store today." action={<><select className="select-control dashboard-range" value={rangeDays} onChange={event => setRangeDays(Number(event.target.value))} aria-label="Reporting period"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select>{canViewSpendings && <Button icon={Wallet} onClick={() => onNavigate('Spendings')}>Spendings</Button>}<Button variant="primary" icon={Plus} onClick={() => onNavigate('Point of Sale')}>New sale</Button></>} />
    {demo && <div className="live-info-banner"><CircleHelp size={17}/><span><b>Demo workspace.</b> The figures below are illustrative sample data and are not saved to your database. Sign in to view live figures.</span></div>}
    {isLive && reportError && <div className="live-error"><AlertTriangle size={17}/><span>{reportError}</span><Button icon={RefreshCw} onClick={() => setRefreshKey(value => value + 1)}>Retry</Button></div>}
    {isLive && !reportError && reportData && <div className="live-info-banner"><CircleCheck size={17}/><span><b>Live business data.</b> Metrics below come from saved records for {reportData.period.from} through {reportData.period.to}. Figures are not estimated.</span></div>}
    <div className="stats-grid dashboard-stats-grid">
      <StatCard icon={Wallet} label={isLive ? 'Net revenue' : 'Total revenue'} value={loading ? '—' : hasData ? formatAmount(revenue) : '—'} change={demo ? '12.8%' : undefined} note={demo ? <span className="muted">Illustrative demo value</span> : <span className="muted">Sales less recorded refunds</span>}/>
      <StatCard icon={ShoppingBag} label="Completed sales" value={loading ? '—' : hasData ? String(orders ?? 0) : '—'} change={demo ? '8.2%' : undefined} note={demo ? <span className="muted">Illustrative demo value</span> : <span className="muted">Voided sales excluded</span>} accent="blue"/>
      <StatCard icon={TrendingUp} label="Gross profit" value={loading ? '—' : !hasData ? '—' : demo ? formatAmount(grossProfit) : summary?.grossProfitAvailable ? formatAmount(grossProfit) : 'Unavailable'} change={demo ? '6.4%' : undefined} note={demo ? <span className="muted">Illustrative demo value</span> : <span className="muted">{summary?.grossProfitAvailable ? 'Based on saved cost snapshots' : 'Provisional costs prevent a reliable figure'}</span>} accent="green"/>
      <StatCard icon={Package} label="Inventory cost value" value={loading ? '—' : hasData ? formatAmount(inventoryValue) : '—'} change={demo ? '2.1%' : undefined} trend="down" note={demo ? <span className="muted">Illustrative demo value</span> : <span className="muted">Quantity on hand × average cost</span>} accent="amber"/>
      {canViewSpendings && <StatCard icon={Wallet} label="Operating spendings" value={loading ? '—' : demo ? '—' : !reportData?.spendingTrackingAvailable ? 'Setup required' : formatAmount(summary?.operatingSpendings || 0)} note={demo ? <span className="muted">Sign in to view saved spendings</span> : !reportData?.spendingTrackingAvailable ? <span className="muted">Run the updated database installer</span> : <span className="muted">{Number(summary?.operatingSpendingCount || 0)} recorded entries in this period</span>} accent="amber"/>}
    </div>
    <div className="dashboard-main-grid">
      <section className="panel chart-panel">
        <div className="panel-head"><div><h2>Sales overview</h2><p>{demo ? 'Illustrative sample revenue by day.' : 'Saved sales and refunds for the selected period.'}</p></div><button className="icon-button" aria-label="Reporting period">{reportLoading ? <RefreshCw size={18}/> : <CalendarDays size={18}/>}</button></div>
        <div className="chart-legend"><span><i className="legend-dot violet-dot"/> Sales</span><span className="legend-meta">{demo ? 'Sample total' : 'Sales in range'} <b>{loading ? '—' : hasData ? formatAmount(totalPeriodSales) : '—'}</b></span></div>
        <div className="sales-chart">{hasData && dailyRows.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyRows} margin={{top:10,right:8,left:-18,bottom:0}}><defs><linearGradient id="dashboardSalesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8171ee" stopOpacity={0.23}/><stop offset="95%" stopColor="#8171ee" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)"/><XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:12}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={value => Number(value) >= 1000 ? currencySymbol + (Number(value)/1000).toFixed(1) + 'k' : currencySymbol + Number(value).toFixed(0)}/><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--line)',borderRadius:12,color:'var(--text)',boxShadow:'0 8px 30px #0001'}} formatter={value => [formatAmount(value), 'Sales']} cursor={{stroke:'#b7aff7',strokeDasharray:'4 4'}}/><Area type="monotone" dataKey="sales" stroke="#7968e8" strokeWidth={2.7} fill="url(#dashboardSalesGradient)" activeDot={{r:5,strokeWidth:3,stroke:'var(--panel)'}}/></AreaChart></ResponsiveContainer> : unavailable(reportError ? 'Fix the database/schema issue above, then retry.' : 'No completed sales were found in this period.')}</div>
        <div className="chart-footer"><span><span className="tiny-dot"/>{demo ? 'Sample data only — no real sales trend is implied.' : reportData ? 'Period: ' + reportData.period.from + ' → ' + reportData.period.to : 'Waiting for live report data.'}</span><Button variant="text" onClick={() => onNavigate('Reports')}>View report <ArrowRight size={14}/></Button></div>
      </section>
      <section className="panel payment-panel">
        <div className="panel-head"><div><h2>Sales by payment type</h2><p>{demo ? 'Illustrative sales mix for this period.' : 'Share of completed sales value by payment type.'}</p></div><Wallet size={18} color="var(--violet)"/></div>
        <div className="payment-total-row">
          <div><small>Classified sales value</small><strong>{loading ? '—' : hasData ? formatAmount(paymentBreakdownTotal) : '—'}</strong></div>
          <span className="payment-total-period"><CalendarDays size={13}/>{reportData?.period ? reportData.period.from + ' – ' + reportData.period.to : demo ? 'Sample period' : 'Selected period'}</span>
        </div>
        {loading ? <div className="payment-breakdown-loading"><RefreshCw size={18}/>Updating payment mix…</div> : hasData && hasPaymentActivity ? <div className="payment-breakdown-list">
          {paymentBreakdown.map(row => <div className="payment-breakdown-row" key={row.method}>
            <div className="payment-breakdown-heading">
              <span className="payment-breakdown-label"><i style={{background:row.color}}/>{row.method}{row.isCredit && <small>Receivable</small>}</span>
              <span className="payment-breakdown-value"><b>{formatAmount(row.amount)}</b><strong>{row.percentage.toFixed(1)}%</strong></span>
            </div>
            <div className="payment-breakdown-track" aria-label={row.method + ' ' + row.percentage.toFixed(1) + ' percent'}><span style={{width: row.percentage + '%', background:row.color}}/></div>
          </div>)}
        </div> : unavailable(reportError ? 'Payment totals are unavailable until the database issue is fixed.' : 'No completed sales were found in this period.')}
        <div className="payment-breakdown-footnote"><BookOpen size={13}/><span>Khata represents credit sales, not money collected.</span></div>
      </section>
    </div>
    <div className="dashboard-bottom-grid">
      <div className="dashboard-stack-column">
        <section className="panel recent-panel"><div className="panel-head"><div><h2>Recent transactions</h2><p>{demo ? 'Illustrative examples, not actual transactions.' : 'Latest saved transactions from the database.'}</p></div><Button variant="text" onClick={() => onNavigate('Transactions')}>View all <ArrowRight size={14}/></Button></div>
        {hasData && recentRows.length ? <div className="table-wrap"><table><thead><tr><th>TRANSACTION</th><th>CUSTOMER</th><th>PAYMENT</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody>{recentRows.slice(0,5).map(row => <tr key={row.id}><td><span className="transaction-id">{row.id}</span><small>{row.date || '—'}</small></td><td><div className="customer-cell"><Avatar initials={row.initials || 'WC'} color={row.color || 'purple'}/><span>{row.customer || 'Walk-in Customer'}</span></div></td><td><span className="payment-method">{row.method === 'Cash' ? <Banknote size={15}/> : row.method === 'UPI' ? <Smartphone size={15}/> : row.method === 'Credit' ? <BookOpen size={15}/> : <CardIcon size={15}/>} {row.method || '—'}</span></td><td className="amount-cell">{formatAmount(row.amount)}</td><td><Pill tone={String(row.status || 'COMPLETED').toUpperCase()==='COMPLETED'?'success':'neutral'} dot>{String(row.status || 'COMPLETED').replace(/_/g,' ')}</Pill></td><td><button className="icon-button small" onClick={() => onNavigate('Transactions')} aria-label="Open transactions"><Ellipsis size={17}/></button></td></tr>)}</tbody></table></div> : <EmptyState icon={ReceiptText} title={reportError ? 'Transactions unavailable' : 'No transactions yet'} text={reportError ? 'Correct the database schema error above, then retry.' : 'Saved sales will appear here as you use the POS.'}/>}
      </section>
        {canViewKhata && <section className="panel khata-dashboard-panel">
        <div className="panel-head"><div><h2>Customer Khata</h2><p>Outstanding credit across registered customers.</p></div><BookOpen size={19} color="var(--violet)"/></div>
        <div className="khata-dashboard-total">{demo || loading || !reportData ? '—' : formatAmount(summary?.khataOutstanding || 0)}</div>
        <div className="khata-dashboard-meta">{demo ? 'Sign in to view saved Khata balances.' : loading || !reportData ? 'Loading customer balances…' : Number(summary?.customersOwing || 0) === 0 ? 'No customers currently owe a balance.' : String(summary.customersOwing) + ' registered customer' + (Number(summary.customersOwing) === 1 ? '' : 's') + ' with an outstanding balance.'}</div>
        <div className="khata-credit-period">
          <div><small>Credit sales this period</small><b>{demo || loading || !reportData ? '—' : formatAmount(summary?.creditSalesTotal || 0)}</b></div>
          <span>{demo || loading || !reportData ? '—' : Number(summary?.creditSalesCount || 0) + ' sale' + (Number(summary?.creditSalesCount || 0) === 1 ? '' : 's')}</span>
          <p>Receivables, not collected payments.</p>
        </div>
        <Button className="full-width" onClick={() => onNavigate('Customers')}>View customer balances <ArrowRight size={15}/></Button>
      </section>}
      </div>
      <div className="dashboard-stack-column">
        <section className="panel low-stock-panel"><div className="panel-head"><div><h2>Stock attention</h2><p>Items that need a restock.</p></div><span className="count-badge">{hasData ? stockAlertCount : '—'}</span></div>
        <div className="stock-attention-list">{hasData && stockAttention.length ? stockAttention.map(it => <div className="stock-attention-item" key={it.id}><div className={'product-mini mini-' + it.color}>{it.imageUrl ? <img className="stock-photo-mini" src={it.imageUrl} alt={it.name} loading="lazy"/> : it.icon}</div><div className="stock-item-copy"><b>{it.name}</b><span>{it.sku}</span></div><div className="stock-item-right"><b className={isOut(it)?'danger-text':'warning-text'}>{it.stock} left</b><span>{isOut(it)?'Out of stock':'Low stock'}</span></div></div>) : <EmptyState icon={Boxes} title={hasData ? 'Stock levels look good' : 'Stock data unavailable'} text={hasData ? 'There are no items below their reorder threshold.' : 'Load database-backed inventory to view alerts.'}/>}</div>
        <Button className="full-width" onClick={() => onNavigate('Inventory')}>Review inventory <ArrowRight size={15}/></Button>
      </section>
        <section className="panel top-selling-panel">
        <div className="panel-head"><div><h2>Top-selling products</h2><p>Products with the most units sold in this reporting period.</p></div><TrendingUp size={18}/></div>
        {!isLive ? <EmptyState icon={Package} title="Live data unavailable" text="Sign in to view your saved top-selling products."/> : loading ? <EmptyState icon={TrendingUp} title="Loading top sellers" text="Calculating units sold from completed sales."/> : reportError ? unavailable('Correct the database issue above, then retry.') : topSellingRows.length ? <div className="dashboard-top-products">{topSellingRows.map((row,index) => {
          const maxUnits = Math.max(1, ...topSellingRows.map(product => Number(product.unitsSold || 0)));
          const relativeUnits = Math.max(0, Math.min(100, Number(row.unitsSold || 0) / maxUnits * 100));
          return <div className="dashboard-top-product" key={row.itemId || row.name}><span className="dashboard-top-rank">{index+1}</span><div className="dashboard-top-product-copy"><b>{row.name}</b><small>{row.sku || 'No SKU'}</small><span className="dashboard-top-product-meter"><i style={{width: relativeUnits + '%'}}/></span></div><div className="dashboard-top-product-value"><b>{Number(row.unitsSold || 0).toLocaleString('en-IN')} sold</b><small>{formatAmount(row.salesAmount)}</small></div></div>;
        })}</div> : <EmptyState icon={Package} title="No products sold yet" text="Completed sale lines will appear here once products are sold."/>}
      </section>
      </div>
    </div>
    {isLive && canViewSpendings && <section className="panel dashboard-spending-preview">
      <div className="panel-head"><div><h2>Recent operating spendings</h2><p>Saved day-to-day expenses for the selected dashboard period.</p></div><Button variant="text" onClick={() => onNavigate('Spendings')}>View spending ledger <ArrowRight size={14}/></Button></div>
      {!reportData?.spendingTrackingAvailable && !loading ? <EmptyState icon={Wallet} title="Spending ledger needs setup" text="Run the updated database/ritvan-pos-all-in-one.sql once to enable operating spendings."/> : loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Loading spending entries…</span></div> : (reportData?.recentSpendings || []).length ? <div className="dashboard-spending-list">{reportData.recentSpendings.map(row=><div className="dashboard-spending-row" key={row.id}><span className="dashboard-spending-date">{new Date(row.spendingDate + 'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</span><div className="dashboard-spending-copy"><b>{row.description}</b><small>{row.category}{row.paidTo ? ' · '+row.paidTo : ''}</small></div><strong>{formatAmount(row.amount)}</strong></div>)}</div> : <EmptyState icon={Wallet} title="No operating spendings recorded" text="Rent, bills, transport and other store costs will appear here once recorded."/>}
    </section>}
  </>;
}

function lowStockCountForDemo(items) {
  return items.filter(item => Number(item.stock) > 0 && Number(item.stock) <= Number(item.reorderThreshold ?? 8)).length
    + items.filter(item => Number(item.stock) <= 0).length;
}

function Inventory({ items, setItems, notify, onNavigate }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('All items'); const [category, setCategory] = useState('All categories'); const [selected, setSelected] = useState([]);
  const categories = ['All categories', ...new Set(items.map(i=>i.category))];
  const filtered = items.filter(i => (i.name.toLowerCase().includes(query.toLowerCase()) || i.sku.toLowerCase().includes(query.toLowerCase())) && (status==='All items' || (status==='Low stock' && i.stock>0 && i.stock<=8) || (status==='Out of stock' && i.stock===0) || (status==='In stock' && i.stock>8)) && (category==='All categories' || i.category===category));
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  return <><SectionTitle eyebrow="CATALOG & STOCK" title="Inventory" subtitle="Keep your stock accurate, organized, and ready to sell." action={<><Button icon={Download} onClick={()=>notify('Inventory export is a demo action in this phase.')}>Export</Button><Button variant="primary" icon={Plus} onClick={()=>onNavigate('Items')}>Add item</Button></>}/><div className="stats-grid inventory-stats"><StatCard icon={Boxes} label="Total items" value={String(items.length).padStart(2,'0')} note="Across all categories" accent="violet"/><StatCard icon={PackageCheck} label="In stock" value={String(items.filter(i=>i.stock>8).length).padStart(2,'0')} note="Healthy stock levels" accent="green"/><StatCard icon={AlertTriangle} label="Low stock" value={String(items.filter(i=>i.stock>0&&i.stock<=8).length).padStart(2,'0')} note="At or below reorder level" accent="amber"/><StatCard icon={Package} label="Out of stock" value={String(items.filter(i=>i.stock===0).length).padStart(2,'0')} note="Requires attention" accent="blue"/></div><section className="panel inventory-panel"><div className="inventory-toolbar"><div className="tabs"><button className={status==='All items'?'tab active':'tab'} onClick={()=>setStatus('All items')}>All items <span>{items.length}</span></button><button className={status==='Low stock'?'tab active':'tab'} onClick={()=>setStatus('Low stock')}>Low stock <span>{items.filter(i=>i.stock>0&&i.stock<=8).length}</span></button><button className={status==='Out of stock'?'tab active':'tab'} onClick={()=>setStatus('Out of stock')}>Out of stock <span>{items.filter(i=>i.stock===0).length}</span></button></div><div className="toolbar-controls"><div className="search-box compact"><Search size={16}/><input placeholder="Search items or SKU..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><select className="select-control" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><Button icon={SlidersHorizontal} onClick={()=>notify('Advanced inventory filters are planned for the next phase.')}>Filters</Button></div></div>{selected.length>0&&<div className="bulk-bar"><span>{selected.length} item{selected.length>1?'s':''} selected</span><Button variant="text" onClick={()=>setSelected([])}>Clear selection</Button><Button icon={Download} onClick={()=>notify('Bulk export queued in the demo.')}>Export selected</Button></div>}<div className="table-wrap inventory-table"><table><thead><tr><th className="check-col"><input type="checkbox" checked={filtered.length>0&&filtered.every(i=>selected.includes(i.id))} onChange={e=>setSelected(e.target.checked?filtered.map(i=>i.id):[])}/></th><th>ITEM</th><th>SKU</th><th>CATEGORY</th><th>SELLING PRICE</th><th>ON HAND</th><th>STOCK STATUS</th><th></th></tr></thead><tbody>{filtered.map(it=><tr key={it.id}><td><input type="checkbox" checked={selected.includes(it.id)} onChange={()=>toggle(it.id)}/></td><td><div className="inventory-product"><div className={`product-mini mini-${it.color}`}>{it.icon}</div><div><b>{it.name}</b><small>{it.displayId || it.id}</small></div></div></td><td className="sku-cell">{it.sku}</td><td><span className="category-label">{it.category}</span></td><td className="amount-cell">{formatMoney(it.price)}</td><td><b>{it.stock}</b><span className="muted"> units</span></td><td>{it.stock===0?<Pill tone="danger" dot>Out of stock</Pill>:it.stock<=8?<Pill tone="warning" dot>Low stock</Pill>:<Pill tone="success" dot>In stock</Pill>}</td><td><button className="icon-button small" onClick={()=>notify(`${it.name} · Item actions will be connected in the next phase.`)}><Ellipsis size={18}/></button></td></tr>)}</tbody></table>{filtered.length===0&&<EmptyState icon={Search} title="No items found" text="Try changing your search or filters." action={<Button onClick={()=>{setQuery('');setStatus('All items');setCategory('All categories')}}>Clear filters</Button>}/>}</div><div className="table-footer"><span>Showing <b>{filtered.length===0?0:1}–{filtered.length}</b> of <b>{items.length}</b> items</span><div className="pagination"><button disabled><ChevronLeft size={16}/></button><button className="page-current">1</button><button disabled><ChevronRight size={16}/></button></div></div></section></>;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r); ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height); ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

async function createReceiptPng(sale, businessName, money, logoData = '') {
  let logoImage = null;
  if (logoData && typeof Image !== 'undefined') {
    logoImage = await new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = logoData;
    });
  }
  // Trim outer white/transparent padding at render time so older Settings logos
  // gain a useful visual size without requiring the user to upload them again.
  let logoCrop = null;
  if (logoImage) {
    try {
      const width = logoImage.naturalWidth || logoImage.width;
      const height = logoImage.naturalHeight || logoImage.height;
      const sampleScale = Math.min(1, 420 / Math.max(width, height));
      const sample = document.createElement('canvas');
      sample.width = Math.max(1, Math.round(width * sampleScale));
      sample.height = Math.max(1, Math.round(height * sampleScale));
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      if (sampleContext) {
        sampleContext.drawImage(logoImage, 0, 0, sample.width, sample.height);
        const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
        let minX = sample.width, minY = sample.height, maxX = -1, maxY = -1;
        for (let y = 0; y < sample.height; y += 1) {
          for (let x = 0; x < sample.width; x += 1) {
            const index = (y * sample.width + x) * 4;
            const alpha = pixels[index + 3];
            const nearWhite = pixels[index] >= 246 && pixels[index + 1] >= 246 && pixels[index + 2] >= 246;
            if (alpha < 24 || nearWhite) continue;
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
        if (maxX >= minX && maxY >= minY) {
          const pad = Math.ceil(Math.max(sample.width, sample.height) * 0.025);
          minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
          maxX = Math.min(sample.width - 1, maxX + pad); maxY = Math.min(sample.height - 1, maxY + pad);
          const x = Math.floor(minX / sampleScale), y = Math.floor(minY / sampleScale);
          const right = Math.min(width, Math.ceil((maxX + 1) / sampleScale));
          const bottom = Math.min(height, Math.ceil((maxY + 1) / sampleScale));
          if (right > x && bottom > y) logoCrop = { x, y, width: right - x, height: bottom - y };
        }
      }
    } catch { logoCrop = null; }
  }
  return new Promise((resolve, reject) => {
    try {
      const items = Array.isArray(sale?.items) ? sale.items : [];
      const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
      const total = Number(sale?.amount || 0);
      const discount = Math.max(0, subtotal - total);
      const isCredit = sale?.method === 'Credit';
      const isSplit = sale?.method === 'Split';
      const paymentLines = isSplit
        ? (Array.isArray(sale?.payments) ? sale.payments : []).map(payment => ({
            label: String(payment.method || 'Payment').toUpperCase() + ' PAYMENT',
            value: money(Number(payment.amountReceived ?? payment.amount ?? 0)),
          }))
        : [
            { label: isCredit ? 'PAYMENT METHOD' : 'PAYMENT METHOD', value: isCredit ? 'CUSTOMER KHATA' : String(sale?.method || '—').toUpperCase() },
            ...(sale?.method === 'Cash' ? [{ label: 'CHANGE DUE', value: money(sale?.change || 0) }] : []),
          ];

      const width = 1000;
      const cardX = 24, cardY = 24, cardW = 952, radius = 28;
      const headerH = 210;
      const contentTop = cardY + headerH + 20;
      const dividerY = contentTop + 112;
      const tableHeaderY = dividerY + 29;
      const itemStart = tableHeaderY + 20;
      const itemRowH = 58;
      const itemsEnd = itemStart + items.length * itemRowH;
      const summaryStart = itemsEnd + 12;
      const summaryLineCount = discount > 0 ? 2 : 1;
      const totalCardY = summaryStart + summaryLineCount * 28 + 10;
      const paymentY = totalCardY + 88;
      const footerY = paymentY + Math.max(64, paymentLines.length * 29 + 19);
      const height = footerY + 84;
      const cardH = height - cardY * 2;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser could not prepare the receipt image.');

      const backdrop = ctx.createLinearGradient(0, 0, width, height);
      backdrop.addColorStop(0, '#f5f1ff');
      backdrop.addColorStop(0.52, '#f8f7ff');
      backdrop.addColorStop(1, '#eaf3ff');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#b7a8ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(870, 65, 60, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(870, 65, 94, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.shadowColor = 'rgba(46, 32, 97, .15)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 9;
      roundedRect(ctx, cardX, cardY, cardW, cardH, radius);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // Premium violet header with rounded top corners and quiet decorative rings.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cardX + radius, cardY);
      ctx.lineTo(cardX + cardW - radius, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
      ctx.lineTo(cardX + cardW, cardY + headerH);
      ctx.lineTo(cardX, cardY + headerH);
      ctx.lineTo(cardX, cardY + radius);
      ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
      ctx.closePath();
      ctx.clip();
      const head = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
      head.addColorStop(0, '#21173f');
      head.addColorStop(0.5, '#3d2a73');
      head.addColorStop(1, '#7864e8');
      ctx.fillStyle = head;
      ctx.fillRect(cardX, cardY, cardW, headerH);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cardX + cardW - 128, cardY + 48, 62, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cardX + cardW - 128, cardY + 48, 94, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;

      const logoX = cardX + 32, logoY = cardY + 25, logoW = 172, logoH = 88;
      roundedRect(ctx, logoX, logoY, logoW, logoH, 17);
      ctx.fillStyle = 'rgba(255,255,255,.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.44)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (logoImage) {
        const sourceWidth = logoCrop?.width || logoImage.naturalWidth || logoImage.width || 1;
        const sourceHeight = logoCrop?.height || logoImage.naturalHeight || logoImage.height || 1;
        const logoScale = Math.min((logoW - 20) / sourceWidth, (logoH - 16) / sourceHeight);
        const logoDrawW = sourceWidth * logoScale;
        const logoDrawH = sourceHeight * logoScale;
        ctx.drawImage(
          logoImage,
          logoCrop?.x || 0, logoCrop?.y || 0, sourceWidth, sourceHeight,
          logoX + (logoW - logoDrawW) / 2, logoY + (logoH - logoDrawH) / 2, logoDrawW, logoDrawH
        );
      } else {
        // A simple, branded fallback mark for stores without an uploaded logo.
        roundedRect(ctx, logoX + 54, logoY + 22, 26, 26, 7);
        ctx.fillStyle = '#7968e8'; ctx.fill();
        roundedRect(ctx, logoX + 87, logoY + 22, 26, 26, 7);
        ctx.fillStyle = '#9b8cf0'; ctx.fill();
        roundedRect(ctx, logoX + 54, logoY + 54, 26, 14, 5);
        ctx.fillStyle = '#b9aff7'; ctx.fill();
        roundedRect(ctx, logoX + 87, logoY + 54, 26, 14, 5);
        ctx.fillStyle = '#dad4ff'; ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,.70)';
      ctx.font = '700 12px Arial, sans-serif';
      ctx.fillText('RECEIPT FROM', cardX + 230, cardY + 37);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 27px Arial, sans-serif';
      ctx.fillText(String(businessName || 'Ritvan Store').slice(0, 32), cardX + 230, cardY + 70, 560);
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '600 12px Arial, sans-serif';
      ctx.fillText('OFFICIAL STORE RECEIPT', cardX + 230, cardY + 94);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 34px Arial, sans-serif';
      ctx.fillText(isCredit ? 'Khata sale recorded' : 'Payment confirmed', cardX + 34, cardY + 153, 560);
      ctx.fillStyle = 'rgba(255,255,255,.78)';
      ctx.font = '500 15px Arial, sans-serif';
      ctx.fillText(isCredit ? 'Your purchase has been added to the customer account.' : 'Thank you for shopping with us.', cardX + 36, cardY + 181, 575);
      const statusLabel = isCredit ? 'ON KHATA' : isSplit ? 'SPLIT PAID' : '✓ PAID';
      const statusFill = isCredit ? '#fff0d8' : '#d9ffef';
      const statusText = isCredit ? '#925b0a' : '#17674f';
      roundedRect(ctx, cardX + cardW - 154, cardY + 135, 120, 36, 18);
      ctx.fillStyle = statusFill; ctx.fill();
      ctx.fillStyle = statusText; ctx.font = '800 12px Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(statusLabel, cardX + cardW - 94, cardY + 158);
      ctx.restore();

      // Receipt metadata arranged in a clean two-column grid.
      const leftX = cardX + 34, rightX = cardX + 520;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#88819e';
      ctx.font = '700 11px Arial, sans-serif';
      ctx.fillText('RECEIPT NUMBER', leftX, contentTop + 14);
      ctx.fillText('DATE & TIME', rightX, contentTop + 14);
      ctx.fillStyle = '#27213f';
      ctx.font = '700 17px Arial, sans-serif';
      ctx.fillText(String(sale?.id || '—').slice(0, 34), leftX, contentTop + 37, 440);
      ctx.font = '600 14px Arial, sans-serif';
      ctx.fillText(String(sale?.date || new Date().toLocaleString()).slice(0, 38), rightX, contentTop + 37, 390);

      ctx.fillStyle = '#88819e';
      ctx.font = '700 11px Arial, sans-serif';
      ctx.fillText('CUSTOMER', leftX, contentTop + 66);
      ctx.fillText('WHATSAPP', rightX, contentTop + 66);
      ctx.fillStyle = '#3a3354';
      ctx.font = '600 15px Arial, sans-serif';
      ctx.fillText(String(sale?.customer || 'Walk-in Customer').slice(0, 54), leftX, contentTop + 88, 440);
      ctx.fillText(String(sale?.phone || 'Not provided').slice(0, 26), rightX, contentTop + 88, 390);

      ctx.strokeStyle = '#e8e3f5';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(leftX, dividerY); ctx.lineTo(cardX + cardW - 34, dividerY); ctx.stroke();
      ctx.fillStyle = '#81799b';
      ctx.font = '800 11px Arial, sans-serif';
      ctx.fillText('ITEM', leftX, tableHeaderY);
      ctx.textAlign = 'right';
      ctx.fillText('AMOUNT', cardX + cardW - 34, tableHeaderY);
      ctx.textAlign = 'left';

      items.forEach((item, index) => {
        const rowY = itemStart + index * itemRowH;
        if (index % 2 === 1) {
          roundedRect(ctx, cardX + 24, rowY - 10, cardW - 48, itemRowH - 2, 10);
          ctx.fillStyle = '#faf9ff';
          ctx.fill();
        }
        ctx.fillStyle = '#292440';
        ctx.font = '700 16px Arial, sans-serif';
        ctx.fillText(String(item.name || 'Item').slice(0, 56), leftX, rowY + 10, 600);
        ctx.fillStyle = '#89829f';
        ctx.font = '500 12px Arial, sans-serif';
        ctx.fillText(String(Number(item.qty || 0)) + ' × ' + money(Number(item.price || 0)), leftX, rowY + 31, 570);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#28213f';
        ctx.font = '700 16px Arial, sans-serif';
        ctx.fillText(money(Number(item.price || 0) * Number(item.qty || 0)), cardX + cardW - 34, rowY + 15, 260);
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#efedf6';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(leftX, rowY + itemRowH - 8); ctx.lineTo(cardX + cardW - 34, rowY + itemRowH - 8); ctx.stroke();
      });

      const drawSummary = (label, value, y) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#827b9a';
        ctx.font = '500 14px Arial, sans-serif';
        ctx.fillText(label, leftX, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#514a69';
        ctx.font = '600 14px Arial, sans-serif';
        ctx.fillText(value, cardX + cardW - 34, y);
        ctx.textAlign = 'left';
      };
      drawSummary('Subtotal', money(subtotal), summaryStart + 17);
      if (discount > 0) drawSummary('Discount', '−' + money(discount), summaryStart + 45);

      roundedRect(ctx, cardX + 24, totalCardY, cardW - 48, 64, 15);
      const totalFill = ctx.createLinearGradient(cardX, totalCardY, cardX + cardW, totalCardY + 64);
      totalFill.addColorStop(0, '#f1edff');
      totalFill.addColorStop(1, '#f4f2ff');
      ctx.fillStyle = totalFill;
      ctx.fill();
      ctx.strokeStyle = '#e6e0ff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#393153';
      ctx.font = '800 13px Arial, sans-serif';
      ctx.fillText(isCredit ? 'TOTAL ADDED TO KHATA' : 'TOTAL PAID', leftX, totalCardY + 38);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4e3cac';
      ctx.font = '800 23px Arial, sans-serif';
      ctx.fillText(money(total), cardX + cardW - 42, totalCardY + 40);
      ctx.textAlign = 'left';

      paymentLines.forEach((line, index) => {
        const lineY = paymentY + index * 29;
        ctx.beginPath();
        ctx.fillStyle = isSplit ? ['#7968e8', '#50bca0', '#eab05a'][index % 3] : '#a79cda';
        ctx.arc(leftX + 4, lineY + 7, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#827b9a';
        ctx.font = '700 11px Arial, sans-serif';
        ctx.fillText(line.label, leftX + 17, lineY + 11);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#38314f';
        ctx.font = '700 13px Arial, sans-serif';
        ctx.fillText(line.value, cardX + cardW - 34, lineY + 11);
        ctx.textAlign = 'left';
      });

      ctx.strokeStyle = '#e8e3f5';
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(leftX, footerY - 13); ctx.lineTo(cardX + cardW - 34, footerY - 13); ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6f5bd8';
      ctx.font = '800 14px Arial, sans-serif';
      ctx.fillText('THANK YOU FOR YOUR PURCHASE  ✦', width / 2, footerY + 16);
      ctx.fillStyle = '#9992ad';
      ctx.font = '500 11px Arial, sans-serif';
      ctx.fillText('Powered by Ritvan POS', width / 2, footerY + 39);

      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export the receipt image.')), 'image/png');
    } catch (error) { reject(error); }
  });
}

function downloadReceiptBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function receiptWhatsAppText(sale, businessName, money) {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const discount = Math.max(0, subtotal - Number(sale?.amount || 0));
  const paymentLines = sale?.method === 'Split'
    ? (Array.isArray(sale?.payments) ? sale.payments : []).map(payment => String(payment.method || 'Payment') + ': ' + money(Number(payment.amountReceived ?? payment.amount ?? 0)))
    : ['Payment method: ' + (sale?.method || '—')];
  return [
    '*' + (businessName || 'Ritvan Store') + '*',
    '*Payment receipt*',
    'Receipt: ' + (sale?.id || '—'),
    'Date: ' + (sale?.date || new Date().toLocaleString()),
    'Customer: ' + (sale?.customer || 'Walk-in Customer'),
    '------------------------',
    ...items.map(item => String(item.name || 'Item') + ' × ' + Number(item.qty || 0) + '  ' + money(Number(item.price || 0) * Number(item.qty || 0))),
    '------------------------',
    'Subtotal: ' + money(subtotal),
    ...(discount > 0 ? ['Discount: −' + money(discount)] : []),
    (sale?.method === 'Credit' ? '*TOTAL ON KHATA:' : '*TOTAL PAID:') + ' ' + money(sale?.amount || 0) + '*',
    ...(sale?.method === 'Split' ? ['Payment breakdown:', ...paymentLines] : paymentLines),
    ...(sale?.method === 'Cash' ? ['Change due: ' + money(sale?.change || 0)] : []),
    sale?.method === 'Credit' ? 'Please settle your Khata balance later. Thank you!' : sale?.persisted ? 'Thank you for shopping with us!' : 'DEMO RECEIPT — not a saved transaction.',
  ].join('\n');
}
function normalizeWhatsAppNumber(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  // Local 10-digit numbers default to India's country code; enter +country-code for other countries.
  if (digits.length === 10) digits = '91' + digits;
  return /^\d{11,15}$/.test(digits) ? digits : '';
}

function createIdempotencyKey() {
  // randomUUID() is restricted to secure contexts in some browsers; Ritvan is also used over LAN HTTP.
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  // Use getRandomValues when available, with a non-cryptographic fallback only for this duplicate-submit key.
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return 'nx-' + hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

function POS({ items, setItems, notify, role, currency, auth, onUnauthorized, businessName = 'Ritvan Store', businessLogo = '' }) {
  const [cart, setCart] = useState([]); const [query, setQuery] = useState(''); const [category, setCategory] = useState('All'); const [step, setStep] = useState('cart'); const [method, setMethod] = useState('Cash'); const [received, setReceived] = useState(''); const [splitPayments, setSplitPayments] = useState([{ method: 'UPI', amount: '', referenceNo: '' }, { method: 'Cash', amount: '', referenceNo: '' }]); const [customer, setCustomer] = useState('Walk-in Customer'); const [customerId, setCustomerId] = useState(''); const [customerPhone, setCustomerPhone] = useState(''); const [customerOptions, setCustomerOptions] = useState([]); const [showPrice, setShowPrice] = useState(null); const [priceDraft, setPriceDraft] = useState(''); const [priceReason, setPriceReason] = useState(''); const [showDiscount, setShowDiscount] = useState(false); const [discount, setDiscount] = useState(''); const [discountReason, setDiscountReason] = useState(''); const [showStockOverride, setShowStockOverride] = useState(null); const [stockReason, setStockReason] = useState(''); const [success, setSuccess] = useState(null); const [submitting, setSubmitting] = useState(false); const [referenceNo, setReferenceNo] = useState(''); const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey()); const [sharingReceipt, setSharingReceipt] = useState(false);
  useEffect(() => {
    if (!auth?.token) { setCustomerOptions([]); setCustomerId(''); setCustomerPhone(''); return; }
    let cancelled = false;
    apiRequest('/customers', { token: auth.token }).then(data => {
      if (!cancelled) setCustomerOptions((data.customers || []).filter(customer => Boolean(Number(customer.isActive))));
    }).catch(error => {
      if (!cancelled) notify(error.message || 'Could not load customer directory.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    });
    return () => { cancelled = true; };
  }, [auth?.token]);
  const money = n => currency==='INR'?formatMoney(n):`${currency} ${Number(n).toFixed(2)}`;
  const cats = ['All', ...new Set(items.map(i=>i.category))];
  const products = items.filter(i=>(i.name.toLowerCase().includes(query.toLowerCase())||i.sku.toLowerCase().includes(query.toLowerCase()))&&(category==='All'||i.category===category));
  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0); const discountNum = Math.min(subtotal,Math.max(0,Number(discount)||0)); const total = Math.max(0,subtotal-discountNum); const change = Math.max(0,(Number(received)||0)-total);
  const totalCents = Math.round(total * 100);
  const splitPaidCents = splitPayments.reduce((sum,row) => sum + Math.round((Number(row.amount) || 0) * 100), 0);
  const splitMethodsUnique = new Set(splitPayments.map(row => row.method)).size === splitPayments.length;
  const splitPaymentValid = splitPayments.length >= 2 && splitPayments.length <= 3 && splitMethodsUnique &&
    splitPayments.every(row => ['Cash','UPI','Card'].includes(row.method) && Number.isFinite(Number(row.amount)) && Number(row.amount) > 0 && Math.abs(Number(row.amount) * 100 - Math.round(Number(row.amount) * 100)) < 0.0001) &&
    splitPaidCents === totalCents;
  const startCheckout = () => {
    const cents = Math.round(total * 100);
    const first = Math.floor(cents / 2);
    setSplitPayments([
      { method: 'UPI', amount: (first / 100).toFixed(2), referenceNo: '' },
      { method: 'Cash', amount: ((cents - first) / 100).toFixed(2), referenceNo: '' },
    ]);
    setReceived('');
    setStep('payment');
  };
  const updateSplitPayment = (index, key, value) => setSplitPayments(previous => previous.map((row,rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const addSplitPayment = () => setSplitPayments(previous => {
    if (previous.length >= 3) return previous;
    const methodOption = ['Cash','UPI','Card'].find(option => !previous.some(row => row.method === option));
    return methodOption ? [...previous, { method: methodOption, amount: '', referenceNo: '' }] : previous;
  });
  const addItem = item => { if(item.stock===0 && role!=='Admin'){notify('This item is out of stock. Only an Admin can override stock.','warning');return;} setCart(prev=>{const found=prev.find(x=>x.id===item.id);if(found){if(found.qty+1>item.stock && role!=='Admin'){notify(`Only ${item.stock} units available.`,'warning');return prev;}return prev.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x);}return [...prev,{...item,qty:1,defaultPrice:item.price,override:false}];}); };
  const changeQty = (id, delta) => setCart(prev=>prev.map(line=>{if(line.id!==id)return line;const next=line.qty+delta;if(next<1)return line;if(next>items.find(i=>i.id===id).stock && role!=='Admin'){notify(`Only ${items.find(i=>i.id===id).stock} units available.`,'warning');return line;}return {...line,qty:next};}));
  const removeLine = id => setCart(prev=>prev.filter(x=>x.id!==id));
  const complete = async () => {
    if (!cart.length || submitting) return;
    if (method === 'Credit' && !customerId) { notify('Khata is available only for a registered customer.', 'warning'); return; }
    if (method === 'Cash' && (received === '' || Number(received) < total)) { notify('Amount received must cover the total.', 'warning'); return; }
    if (method === 'Split' && !splitPaymentValid) {
      const remainingCents = totalCents - splitPaidCents;
      notify(remainingCents === 0
        ? 'Add at least two different, positive payment methods.'
        : 'Split payment amounts must add up exactly to ' + money(total) + '. Remaining: ' + money(remainingCents / 100) + '.', 'warning');
      return;
    }
    const overrideLines = cart.filter(line => line.qty > (items.find(i => i.id === line.id)?.stock ?? 0));
    if (overrideLines.length && role !== 'Admin') { notify('Resolve stock issues before checkout.', 'warning'); return; }
    if (overrideLines.length && !overrideLines.every(line => line.stockOverride && String(line.stockReason || '').trim().length >= 5)) {
      setShowStockOverride(overrideLines[0].id);
      notify('Admin stock override requires a reason for every oversold item.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      let sale;
      if (auth) {
        const result = await apiRequest('/sales', {
          method: 'POST',
          token: auth.token,
          body: {
            customerId: customerId ? Number(customerId) : null,
            paymentMethod: method,
            amountReceived: method === 'Cash' ? Number(received) : total,
            payments: method === 'Split' ? splitPayments.map(row => ({ method: row.method, amount: Number(row.amount), referenceNo: row.referenceNo.trim() || null })) : undefined,
            referenceNo: referenceNo.trim() || null,
            discountAmount: discountNum,
            discountReason: discountNum > 0 ? discountReason.trim() : null,
            negativeStockOverride: overrideLines.length > 0,
            stockOverrideReason: overrideLines.length ? overrideLines.map(line => line.stockReason).join('; ') : null,
            idempotencyKey,
            lines: cart.map(line => ({
              itemId: line.apiId,
              quantity: line.qty,
              unitPrice: line.price,
              ...(line.override ? { overrideReason: line.overrideReason } : {}),
            })),
          },
        });
        sale = {
          id: result.sale.receiptNo,
          customer,
          phone: customerPhone.trim(),
          amount: Number(result.sale.total),
          method: result.sale.paymentMethod || method,
          payments: result.sale.payments || (method === 'Split' ? splitPayments.map(row => ({ method: row.method, amountReceived: Number(row.amount), changeDue: 0, referenceNo: row.referenceNo.trim() || null })) : []),
          date: new Date().toLocaleString(),
          items: cart.map(line => ({ ...line })),
          change: Number(result.sale.changeDue || 0),
          balanceDue: Number(result.sale.balanceDue || 0),
          paymentStatus: result.sale.paymentStatus || 'PAID',
          persisted: true,
        };
      } else {
        sale = {
          id: '#NX-' + String(Date.now()).slice(-5),
          customer,
          phone: customerPhone.trim(),
          amount: total,
          method,
          payments: method === 'Split' ? splitPayments.map(row => ({ method: row.method, amountReceived: Number(row.amount), changeDue: 0, referenceNo: row.referenceNo.trim() || null })) : [],
          date: new Date().toLocaleString(),
          items: cart.map(line => ({ ...line })),
          change: method === 'Cash' ? change : 0,
          persisted: false,
        };
      }
      setItems(prev => prev.map(item => {
        const line = cart.find(c => c.id === item.id);
        if (!line) return item;
        const nextStock = item.stock - line.qty;
        return { ...item, stock: nextStock, status: nextStock <= 0 ? 'Out of stock' : nextStock <= 8 ? 'Low stock' : 'In stock' };
      }));
      setSuccess(sale);
      setStep('done');
      notify(auth ? 'Sale saved to the database.' : 'Demo sale completed in local state.', 'success');
    } catch (error) {
      notify(error.message || 'Sale could not be completed.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally {
      setSubmitting(false);
    }
  };
  const shareReceiptOnWhatsApp = async () => {
    if (!success || sharingReceipt) return;
    const phone = normalizeWhatsAppNumber(customerPhone || success.phone);
    if (!phone) {
      notify('Enter a valid customer WhatsApp number first. Use 10 digits for an Indian number or include the country code.', 'warning');
      return;
    }
    const saleForShare = { ...success, phone: customerPhone || success.phone || '' };
    const filename = `ritvan-receipt-${String(success.id || 'sale').replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
    let canShareFiles = false;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File !== 'undefined') {
        const probe = new File(['receipt'], 'receipt.png', { type: 'image/png' });
        canShareFiles = navigator.canShare({ files: [probe] });
      }
    } catch { canShareFiles = false; }
    // WhatsApp click-to-chat accepts text, but cannot pre-attach a local image. Only open a fallback tab when file sharing isn't supported.
    const whatsappTab = canShareFiles ? null : window.open('about:blank', '_blank');
    setSharingReceipt(true);
    try {
      const blob = await createReceiptPng(saleForShare, businessName, money, businessLogo);
      const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'image/png' }) : null;
      if (canShareFiles && file && navigator.canShare({ files: [file] })) {
        try {
          // Share the actual receipt image only; do not send the old long text-only receipt.
          await navigator.share({ title: `${businessName || 'Ritvan Store'} receipt ${success.id}`, files: [file] });
          notify('Receipt image share opened. Choose WhatsApp and select the customer to send the PNG.', 'success');
          return;
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return;
          downloadReceiptBlob(blob, filename);
          const chatUrl = 'https://wa.me/' + phone;
          if (whatsappTab && !whatsappTab.closed) whatsappTab.location.href = chatUrl;
          else window.open(chatUrl, '_blank', 'noopener,noreferrer');
          notify('This browser could not share the image directly. The PNG was downloaded; attach it in the customer chat before sending.', 'info');
          return;
        }
      }
      downloadReceiptBlob(blob, filename);
      const chatUrl = 'https://wa.me/' + phone;
      if (whatsappTab && !whatsappTab.closed) whatsappTab.location.href = chatUrl;
      else window.open(chatUrl, '_blank', 'noopener,noreferrer');
      notify('Receipt PNG downloaded and the customer chat opened. Attach the PNG in WhatsApp before sending; no text receipt was prefilled.', 'info');
    } catch (error) {
      if (whatsappTab && !whatsappTab.closed) whatsappTab.close();
      notify(error?.message || 'Could not create the receipt image. Please use Print receipt instead.', 'warning');
    } finally { setSharingReceipt(false); }
  };
  const reset = () => {setCart([]);setQuery('');setMethod('Cash');setReceived('');setSplitPayments([{method:'UPI',amount:'',referenceNo:''},{method:'Cash',amount:'',referenceNo:''}]);setReferenceNo('');setDiscount('');setDiscountReason('');setCustomer('Walk-in Customer');setCustomerId('');setCustomerPhone('');setStep('cart');setSuccess(null);setIdempotencyKey(createIdempotencyKey());};
  const openPrice = line => {setShowPrice(line.id);setPriceDraft(String(line.price));setPriceReason('');};
  const savePrice = () => {if(priceReason.trim().length<5){notify('Please enter a reason of at least 5 characters.','warning');return;}const value=Number(priceDraft);if(!Number.isFinite(value)||value<0){notify('Enter a valid price.','warning');return;}setCart(prev=>prev.map(x=>x.id===showPrice?{...x,price:value,override:true,overrideReason:priceReason}:x));setShowPrice(null);notify('Price override applied to this cart line.','success');};
  const saveDiscount = () => {if(discountReason.trim().length<5){notify('Please enter a discount reason of at least 5 characters.','warning');return;}if(Number(discount)<0||Number(discount)>subtotal){notify('Discount must be between zero and subtotal.','warning');return;}setShowDiscount(false);notify('Order discount applied.','success');};
  const overrideStock = () => {if(stockReason.trim().length<5){notify('A reason of at least 5 characters is required.','warning');return;}const item=items.find(i=>i.id===showStockOverride);if(item){setCart(prev=>{const line=prev.find(x=>x.id===item.id);return line?prev.map(x=>x.id===item.id?{...x,stockOverride:true,stockReason}:x):[...prev,{...item,qty:1,defaultPrice:item.price,override:false,stockOverride:true,stockReason}];});}setShowStockOverride(null);setStockReason('');notify('Admin stock override noted for this demo session.','warning');};
  if(step==='done'&&success) return <div className="pos-success panel"><div className="success-orbit"><CheckCheck size={32}/></div><Pill tone="success" dot>{success.persisted ? 'Sale saved' : 'Sale completed · Demo'}</Pill><h1>{success.method === 'Credit' ? 'Added to Khata!' : 'Payment received!'}</h1><p>{success.persisted ? (success.method === 'Credit' ? 'The sale was saved and added to this customer’s outstanding balance.' : 'Your transaction has been saved to the Ritvan database.') : 'Your transaction has been recorded in this demo session.'}</p><div className="receipt-card printable-receipt"><div className="receipt-brand">{businessLogo ? <img className="receipt-business-logo" src={businessLogo} alt="Store logo"/> : <BrandMark/>}<div><b>{businessName || 'Ritvan Store'}</b><small>{success.method === 'Credit' ? 'KHATA RECEIPT' : 'PAYMENT RECEIPT'}</small></div></div><div className="receipt-number"><span>Transaction</span><b>{success.id}</b></div><div className="receipt-number"><span>Date</span><b>{success.date}</b></div>{customerPhone.trim() && <div className="receipt-number"><span>WhatsApp</span><b>{customerPhone.trim()}</b></div>}<div className="receipt-lines">{success.items.map(i=><div key={i.id}><span>{i.name} × {i.qty}</span><b>{money(i.price*i.qty)}</b></div>)}</div><div className="receipt-number"><span>Subtotal</span><b>{money(success.items.reduce((s,i)=>s+i.price*i.qty,0))}</b></div>{discountNum>0&&<div className="receipt-number"><span>Discount</span><b>−{money(discountNum)}</b></div>}<div className="receipt-total"><span>{success.method === 'Credit' ? 'Total added to Khata' : 'Total paid'}</span><b>{money(success.amount)}</b></div>{success.method==='Split' ? <><div className="receipt-number"><span>Payment method</span><b>Split payment</b></div>{(success.payments || []).map((payment,index)=><div className="receipt-number" key={payment.method + '-' + index}><span>{payment.method}</span><b>{money(payment.amountReceived ?? payment.amount)}</b></div>)}</> : <><div className="receipt-number"><span>Payment method</span><b>{success.method}</b></div>{success.method==='Cash'&&<div className="receipt-number"><span>Change due</span><b>{money(success.change)}</b></div>}</>}<div className="receipt-foot">Thank you for shopping with us ✦</div></div><div className="success-actions"><Button icon={Printer} onClick={()=>window.print()}>Print receipt</Button><Button variant="primary" icon={MessageCircle} onClick={shareReceiptOnWhatsApp} disabled={sharingReceipt}>{sharingReceipt ? 'Preparing receipt…' : 'Share on WhatsApp'}</Button><Button icon={Plus} onClick={reset}>New sale</Button></div><p className="receipt-share-hint">Opens this customer’s WhatsApp chat with the receipt message filled in and downloads the branded PNG. Attach the PNG in the chat before sending.</p><p className="demo-note">{success.persisted ? 'This receipt references a database-backed sale.' : 'Demo mode: refreshing the app resets sample data. No database record was created.'}</p></div>;
  return <div className="pos-page"><div className="pos-heading"><div><div className="eyebrow">WORKSPACE / CHECKOUT</div><h1>Point of Sale</h1><p>Build a cart, collect payment, and keep the line moving.</p></div><div className="pos-session"><span className="live-dot"/> Register 01 <span className="session-separator"/> {role}</div></div><div className="pos-layout"><section className="pos-catalog panel"><div className="pos-search-row"><div className="search-box pos-search"><ScanBarcode size={18}/><input autoFocus placeholder="Search products or scan barcode..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-button" onClick={()=>notify('Barcode scanner input is ready for a connected scanner.')} title="Barcode"><ScanBarcode size={19}/></button></div><div className="category-chips">{cats.map(c=><button key={c} className={category===c?'category-chip active':'category-chip'} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="pos-product-grid">{products.map(it=><button key={it.id} className={`pos-product ${it.stock===0?'product-unavailable':''}`} onClick={()=>it.stock===0&&role==='Admin'?setShowStockOverride(it.id):addItem(it)}><div className={`product-art art-${it.color} ${it.imageUrl ? 'has-product-photo' : ''}`}>{it.imageUrl ? <img className="product-photo" src={it.imageUrl} alt={it.name} loading="lazy"/> : <span>{it.icon}</span>}{it.stock===0&&<em>OUT</em>}</div><div className="pos-product-info"><b>{it.name}</b><span>{it.category}</span><div><strong>{money(it.price)}</strong><small className={it.stock<=8?'warning-text':''}>{it.stock} in stock</small></div></div><span className="add-product"><Plus size={16}/></span></button>)}</div>{products.length===0&&<EmptyState icon={Search} title="No products found" text="Try a different name, SKU, or category."/>}<div className="catalog-footer"><span><span className="live-dot"/> {products.length} products available</span><span>Tap a product to add it</span></div></section><section className="pos-cart panel"><div className="cart-heading"><div><div className="eyebrow">CURRENT ORDER</div><h2>Cart <span>{cart.reduce((s,i)=>s+i.qty,0)}</span></h2></div><button className="icon-button" onClick={()=>{setCart([]);setDiscount('');notify('Cart cleared.')}} title="Clear cart"><RotateCcw size={17}/></button></div><label className="field-label">Customer</label><div className="customer-select"><UserRound size={16}/><select value={auth ? customerId : customer} onChange={e=>{if(auth){const selected=customerOptions.find(row=>String(row.id)===e.target.value);setCustomerId(e.target.value);setCustomer(selected?.name||'Walk-in Customer');setCustomerPhone(selected?.phone||'');if(!e.target.value&&method==='Credit')setMethod('Cash');}else {setCustomer(e.target.value);setCustomerPhone('');}}}><option value="">Walk-in Customer</option>{auth ? customerOptions.map(row=><option key={row.id} value={row.id}>{row.name}{row.isBusiness ? ' · Business' : ''}</option>) : <><option>Olivia Rhye</option><option>Phoenix Baker</option><option>Lana Steiner</option><option>Demi Wilkinson</option></>}</select><ChevronDown size={15}/></div><label className="field-label">WhatsApp number <span className="optional-label">Optional</span></label><input className="form-input pos-customer-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="+91 98765 43210" aria-label="Customer WhatsApp phone number"/><small className="pos-phone-hint">Choose a saved customer to fill this automatically, or enter a number. 10-digit local numbers use +91.</small><div className="cart-items">{cart.length===0?<div className="cart-empty"><div className="cart-empty-icon"><ShoppingCart size={24}/></div><b>Your cart is waiting</b><p>Add products from the catalog to start a sale.</p></div>:cart.map(line=><div className="cart-line" key={line.id}><div className={`cart-line-art art-${line.color}`}>{line.imageUrl ? <img className="cart-line-photo" src={line.imageUrl} alt={line.name}/> : line.icon}</div><div className="cart-line-main"><b>{line.name}</b><span>{money(line.price)} each {line.override&&<Pill tone="warning">Price adjusted</Pill>}</span><div className="qty-control"><button onClick={()=>changeQty(line.id,-1)} aria-label="Decrease quantity">−</button><span>{line.qty}</span><button onClick={()=>changeQty(line.id,1)} aria-label="Increase quantity">+</button></div></div><div className="cart-line-end"><b>{money(line.price*line.qty)}</b><button className="remove-line" onClick={()=>removeLine(line.id)} aria-label="Remove item"><X size={14}/></button>{['Admin','Manager'].includes(role)&&<button className="edit-price" onClick={()=>openPrice(line)}>Edit price</button>}</div>{line.stockOverride&&<div className="line-warning"><AlertTriangle size={13}/> Admin stock override — requires reconciliation</div>}</div>)}</div><div className="cart-bottom"><div className="cart-subtotal"><span>Subtotal</span><b>{money(subtotal)}</b></div>{['Admin','Manager'].includes(role)&&<button className="discount-trigger" onClick={()=>setShowDiscount(true)}><Tag size={15}/> {discountNum>0?'Edit order discount':'Add discount'} <Plus size={14}/></button>}{discountNum>0&&<div className="cart-subtotal discount-line"><span>Discount</span><b>−{money(discountNum)}</b></div>}<div className="cart-total"><span>Total due</span><b>{money(total)}</b></div><Button variant="primary" className="checkout-btn" icon={ArrowRight} disabled={!cart.length} onClick={startCheckout}>Continue to payment</Button><div className="secure-note"><ShieldCheck size={13}/> Full payment unless an active registered customer uses Khata</div></div></section></div>
    {step==='payment'&&<div className="modal-backdrop" onClick={()=>setStep('cart')}><div className="modal payment-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">STEP 2 OF 2</div><h2>Collect payment</h2><p>Confirm payment before completing the sale.</p></div><button className="icon-button" onClick={()=>setStep('cart')}><X size={18}/></button></div><div className="payment-modal-body"><div className="payment-total-box"><span>{method === 'Credit' ? 'Amount to add to Khata' : 'Amount due'}</span><b>{money(total)}</b></div><label className="field-label">Payment method</label><div className="payment-method-grid">{[{name:'Cash',icon:Banknote},{name:'UPI',icon:Smartphone},{name:'Card',icon:CreditCard},{name:'Split',icon:Wallet},...(customerId ? [{name:'Credit',icon:BookOpen}] : [])].map(({name,icon:Icon})=><button key={name} className={`payment-option ${method===name?'selected':''}`} onClick={()=>setMethod(name)}><Icon size={20}/><span>{name}</span>{method===name&&<Check size={15}/>}</button>)}</div>{method==='Cash'?<><label className="field-label">Amount received</label><div className="money-input"><span>₹</span><input autoFocus type="number" min="0" step="0.01" placeholder={total.toFixed(2)} value={received} onChange={e=>setReceived(e.target.value)}/></div><div className="quick-cash">{[total,100,500,1000].filter((v,i,a)=>a.indexOf(v)===i).map(v=><button key={v} onClick={()=>setReceived(v.toFixed(2))}>{v===total?'Exact':money(v)}</button>)}</div><div className="change-box"><span>Change due</span><b>{money(change)}</b></div>{received!==''&&Number(received)<total&&<p className="field-error">Amount received must cover the full total.</p>}</>:method==='Split'?<div className="split-payment-editor">
      <div className="split-payment-summary">
        <div><span>Allocated</span><b>{money(splitPaidCents/100)}</b></div>
        <div><span>Remaining</span><b className={splitPaidCents===totalCents?'split-balanced':'split-unbalanced'}>{money((totalCents-splitPaidCents)/100)}</b></div>
      </div>
      <div className="split-payment-intro"><div className="split-payment-intro-icon"><Wallet size={17}/></div><div><b>Split this payment</b><p>Use 2–3 methods. The amounts must equal the total due.</p></div><span className="split-payment-count">{splitPayments.length}/3</span></div>
      {splitPayments.map((row,index)=><div className="split-payment-row" key={index}>
        <div className="split-payment-row-head">
          <div className="split-payment-row-identity"><span>{String(index+1).padStart(2,'0')}</span><div><b>Payment {index+1}</b><small>{row.method} tender</small></div></div>
          {splitPayments.length>2&&<button type="button" className="split-remove-button" onClick={()=>setSplitPayments(previous=>previous.filter((_,rowIndex)=>rowIndex!==index))}><X size={13}/> Remove</button>}
        </div>
        <div className="split-payment-fields">
          <label className="split-payment-field"><span>Method</span><select className="form-input" value={row.method} onChange={event=>updateSplitPayment(index,'method',event.target.value)}>
            {['Cash','UPI','Card'].map(option=><option key={option} value={option} disabled={splitPayments.some((other,otherIndex)=>otherIndex!==index&&other.method===option)}>{option}</option>)}
          </select></label>
          <label className="split-payment-field"><span>Amount</span><div className="money-input"><span>₹</span><input type="number" min="0.01" step="0.01" required value={row.amount} onChange={event=>updateSplitPayment(index,'amount',event.target.value)} placeholder="0.00"/></div></label>
        </div>
        {(row.method==='UPI'||row.method==='Card')&&<label className="split-payment-field split-payment-reference"><span>Reference number <em>Optional</em></span><input className="form-input" maxLength={120} value={row.referenceNo} onChange={event=>updateSplitPayment(index,'referenceNo',event.target.value)} placeholder={row.method+' transaction reference'}/></label>}
      </div>)}
      <div className="split-payment-actions">
        {splitPayments.length<3&&<Button icon={Plus} onClick={addSplitPayment}>Add payment method</Button>}
        {!splitPaymentValid&&<div className="split-payment-warning"><AlertTriangle size={15}/><span>{splitPaidCents===totalCents?'Use different payment methods with positive amounts.':'Add or adjust '+money((totalCents-splitPaidCents)/100)+' to match the total of '+money(total)+'.'}</span></div>}
      </div>
    </div>:method==='Credit'?<div className="info-callout khata-checkout-callout"><BookOpen size={18}/><span><b>Customer Khata / credit sale</b><br/>No money will be collected now. This sale will be added to {customer}’s outstanding balance. Record future payments from the Customers tab.</span></div>:<><label className="field-label">Reference number <span className="optional-label">Optional</span></label><input className="form-input" value={referenceNo} onChange={e=>setReferenceNo(e.target.value)} placeholder={`Enter ${method} reference (optional)`}/><div className="info-callout"><CircleHelp size={16}/><span>This records the payment method only. No payment gateway is connected in this phase.</span></div></>}<div className="modal-actions"><Button onClick={()=>setStep('cart')}>Back to cart</Button><Button variant="primary" icon={CheckCircle2} disabled={submitting|| (method==='Cash'&&(received===''||Number(received)<total)) || (method==='Split'&&!splitPaymentValid)} onClick={complete}>{submitting?'Saving sale…':`Complete sale · ${money(total)}`}</Button></div></div></div></div>}
    {showPrice&&<div className="modal-backdrop" onClick={()=>setShowPrice(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">AUTHORIZED ACTION</div><h2>Override selling price</h2><p>Changes apply to this sale line only.</p></div><button className="icon-button" onClick={()=>setShowPrice(null)}><X size={18}/></button></div><label className="field-label">New unit price</label><div className="money-input"><span>₹</span><input type="number" min="0" value={priceDraft} onChange={e=>setPriceDraft(e.target.value)}/></div>{Number(priceDraft)<(cart.find(x=>x.id===showPrice)?.cost||0)&&<div className="warning-callout"><AlertTriangle size={16}/> Below cost — review the margin before continuing.</div>}<label className="field-label">Reason <span className="required-label">Required</span></label><textarea className="form-input textarea" placeholder="Why is this price being changed? (min 5 characters)" value={priceReason} onChange={e=>setPriceReason(e.target.value)}/><div className="modal-actions"><Button onClick={()=>setShowPrice(null)}>Cancel</Button><Button variant="primary" onClick={savePrice}>Apply override</Button></div></div></div>}
    {showDiscount&&<div className="modal-backdrop" onClick={()=>setShowDiscount(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">AUTHORIZED ACTION</div><h2>Order discount</h2><p>Discounts are available to Managers and Admins.</p></div><button className="icon-button" onClick={()=>setShowDiscount(false)}><X size={18}/></button></div><label className="field-label">Discount amount</label><div className="money-input"><span>₹</span><input type="number" min="0" max={subtotal} value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="0.00"/></div><label className="field-label">Reason <span className="required-label">Required</span></label><textarea className="form-input textarea" value={discountReason} onChange={e=>setDiscountReason(e.target.value)} placeholder="Reason for discount (min 5 characters)"/><div className="modal-actions"><Button onClick={()=>{setDiscount('');setShowDiscount(false)}}>Remove discount</Button><Button variant="primary" onClick={saveDiscount}>Apply discount</Button></div></div></div>}
    {showStockOverride&&<div className="modal-backdrop" onClick={()=>setShowStockOverride(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="warning-modal-icon"><AlertTriangle size={24}/></div><div className="modal-head"><div><div className="eyebrow">ADMIN OVERRIDE</div><h2>Insufficient stock</h2><p>{items.find(i=>i.id===showStockOverride)?.name} has {items.find(i=>i.id===showStockOverride)?.stock ?? 0} units available. Continuing will create a reconciliation exception.</p></div><button className="icon-button" onClick={()=>setShowStockOverride(null)}><X size={18}/></button></div><div className="warning-callout"><AlertTriangle size={17}/> This sale will be flagged for stock reconciliation. The cost basis policy is not yet implemented.</div><label className="field-label">Reason <span className="required-label">Required</span></label><textarea className="form-input textarea" value={stockReason} onChange={e=>setStockReason(e.target.value)} placeholder="Enter the reason for this override (min 5 characters)"/><div className="modal-actions"><Button onClick={()=>setShowStockOverride(null)}>Cancel</Button><Button variant="primary" onClick={overrideStock}>Override & continue</Button></div></div></div>}
  </div>;
}

function PlannedModule({ page, onNavigate }) {
  const details = {
    'Staff & Roles': { title: 'Staff & access control', subtitle: 'Manage store accounts, role assignments, and account status.', icon: ShieldCheck, next: 'Staff APIs and invite/reset flows will be connected here.' },
    Reports: { title: 'Reports & analytics', subtitle: 'Review completed sales, cost-aware gross profit, and stock movement.', icon: FileBarChart, next: 'Reports will use database-backed metrics only; net profit requires an expense module.' },
    'Returns & Refunds': { title: 'Returns & refunds', subtitle: 'Refund eligible sale lines while preserving the original transaction history.', icon: RotateCcw, next: 'The return workflow and refund settlement rules are still being implemented.' },
    Settings: { title: 'Business settings', subtitle: 'Configure currency, tax, receipt details, and store preferences.', icon: Settings, next: 'Settings will be persisted via the API once the rules are complete.' },
  };
  const data = details[page] || details.Reports;
  const Icon = data.icon;
  return <><SectionTitle eyebrow="NEXT IMPLEMENTATION SLICE" title={data.title} subtitle={data.subtitle}/><section className="panel planned-module-panel"><div className="planned-module-orb"><Icon size={26}/></div><h2>{data.title}</h2><p>{data.next}</p><div className="planned-module-note"><ShieldCheck size={17}/><span>No illustrative transaction totals are shown here in the authenticated workspace.</span></div><Button variant="primary" icon={Boxes} onClick={()=>onNavigate(page==='Returns & Refunds'?'Transactions':page==='Reports'?'Transactions':'Items')}>{page==='Returns & Refunds'?'View transactions':page==='Reports'?'Open saved transactions':'Return to catalog'}</Button></section></>;
}

function GenericPage({ page, onNavigate, items, notify, setItems, currency }) {
  const [query, setQuery] = useState('');
  const configs = {
    Items:{eyebrow:'CATALOG & STOCK',title:'Items',subtitle:'Manage your product catalog, pricing, and SKUs.',icon:Package,action:'Add item',columns:['ITEM','SKU','CATEGORY','SELLING PRICE','COST BASIS','STATUS']},
    Categories:{eyebrow:'CATALOG & STOCK',title:'Categories',subtitle:'Organize your products into clear, searchable groups.',icon:Tag,action:'Add category',columns:['CATEGORY','ITEMS','DESCRIPTION','STATUS']},
    Purchases:{eyebrow:'CATALOG & STOCK',title:'Purchases',subtitle:'Record incoming stock and keep supplier costs up to date.',icon:PackagePlus,action:'New purchase',columns:['PURCHASE','SUPPLIER','DATE','ITEMS','TOTAL','STATUS']},
    Suppliers:{eyebrow:'RELATIONSHIPS',title:'Suppliers',subtitle:'Keep supplier details and purchasing relationships organized.',icon:Truck,action:'Add supplier',columns:['SUPPLIER','CONTACT','EMAIL','PRODUCTS','STATUS']},
    Customers:{eyebrow:'RELATIONSHIPS',title:'Customers',subtitle:'View customer profiles and purchase history.',icon:Users,action:'Add customer',columns:['CUSTOMER','CONTACT','TOTAL SPENT','ORDERS','LAST PURCHASE']},
    'Staff & Roles':{eyebrow:'SYSTEM',title:'Staff & roles',subtitle:'Manage access to the parts of Ritvan each person can use.',icon:ShieldCheck,action:'Invite staff',columns:['TEAM MEMBER','ROLE','LAST ACTIVE','STATUS']},
    Transactions:{eyebrow:'WORKSPACE',title:'Transactions',subtitle:'A clear record of completed sales and payment methods.',icon:ReceiptText,action:'Export',columns:['TRANSACTION','CUSTOMER','DATE','PAYMENT','AMOUNT','STATUS']},
    Reports:{eyebrow:'INSIGHTS',title:'Reports & analytics',subtitle:'Understand sales performance, margins, and stock movement.',icon:FileBarChart,action:'Export report',columns:[]},
    'Returns & Refunds':{eyebrow:'INSIGHTS',title:'Returns & refunds',subtitle:'Review returned items and keep the original sale history intact.',icon:RotateCcw,action:'Start return',columns:['RETURN','ORIGINAL SALE','CUSTOMER','DATE','REFUND','STATUS']},
    Settings:{eyebrow:'SYSTEM',title:'Settings',subtitle:'Configure your store profile and business preferences.',icon:Settings,action:'Save changes',columns:[]},
  };
  const config=configs[page]||configs.Items; const Icon=config.icon;
  const [currencySetting,setCurrencySetting]=useState(currency||'INR'); const [taxEnabled,setTaxEnabled]=useState(false); const [storeName,setStoreName]=useState('Ritvan Store'); const [locale,setLocale]=useState('en-IN');
  const rows = page==='Items'?items.filter(i=>i.name.toLowerCase().includes(query.toLowerCase())||i.sku.toLowerCase().includes(query.toLowerCase())).map(i=>[<div className="inventory-product"><div className={`product-mini mini-${i.color}`}>{i.icon}</div><div><b>{i.name}</b><small>{i.id}</small></div></div>,i.sku,i.category,formatMoney(i.price),formatMoney(i.cost),<Pill tone={i.stock===0?'danger':i.stock<=8?'warning':'success'} dot>{i.stock===0?'Out of stock':i.stock<=8?'Low stock':'Active'}</Pill>]):page==='Categories'?['Beverages','Snacks','Accessories','Dairy alternatives'].map((name,i)=>[<b>{name}</b>,[3,2,2,1][i],['Drinks and refreshments','Packaged snacks and treats','Everyday reusable goods','Plant-based alternatives'][i],<Pill tone="success" dot>Active</Pill>]):page==='Transactions'?recentSales.filter(s=>s.id.toLowerCase().includes(query.toLowerCase())||s.customer.toLowerCase().includes(query.toLowerCase())).map(s=>[<b className="transaction-id">{s.id}</b>,s.customer,s.date,s.method,formatMoney(s.amount),<Pill tone="success" dot>Completed</Pill>]):[];
  const actionClick=()=>{if(page==='Items')notify('Add item form will be connected in the next phase.');else if(page==='Settings')notify('Settings saved for this demo session.');else notify(`${config.action} is part of the next implementation slice.`);};
  return <><SectionTitle eyebrow={config.eyebrow} title={config.title} subtitle={config.subtitle} action={<><Button icon={Download} onClick={()=>notify('Export is planned for a later phase.')}>Export</Button><Button variant="primary" icon={Plus} onClick={actionClick}>{config.action}</Button></>}/>{page==='Settings'?<div className="settings-layout"><div className="settings-nav panel"><button className="settings-nav-item active"><BriefcaseBusiness size={16}/> Business profile</button><button className="settings-nav-item"><CircleDollarSign size={16}/> Currency & tax</button><button className="settings-nav-item"><ReceiptText size={16}/> Receipts</button><button className="settings-nav-item"><ShieldCheck size={16}/> Security</button></div><div className="settings-content panel"><div className="panel-head"><div><h2>Business profile</h2><p>These details appear across your workspace and receipts.</p></div><Pill tone="neutral">Admin only</Pill></div><div className="settings-form"><div className="form-field"><label>Business name</label><input className="form-input" value={storeName} onChange={e=>setStoreName(e.target.value)}/></div><div className="form-field"><label>Business currency</label><select className="form-input" value={currencySetting} onChange={e=>setCurrencySetting(e.target.value)}><option value="INR">INR · Indian Rupee (₹)</option><option value="USD">USD · US Dollar ($)</option><option value="GBP">GBP · British Pound (£)</option><option value="EUR">EUR · Euro (€)</option></select><small>One currency for the business. Changing this relabels historical amounts; it does not convert them.</small></div><div className="form-field"><label>Number format locale</label><select className="form-input" value={locale} onChange={e=>setLocale(e.target.value)}><option value="en-IN">English (India)</option><option value="en-US">English (United States)</option><option value="en-GB">English (United Kingdom)</option></select></div><div className="settings-divider"/><div className="setting-toggle-row"><div><b>Enable tax</b><p>Tax is off by default. Tax calculation rules require final approval before implementation.</p></div><button className={`toggle ${taxEnabled?'on':''}`} onClick={()=>setTaxEnabled(!taxEnabled)} aria-label="Toggle tax"><span/></button></div>{taxEnabled&&<div className="info-callout"><CircleHelp size={16}/> Tax is enabled in this prototype, but tax calculation is not yet connected. Do not use for real transactions.</div>}<div className="settings-divider"/><div className="setting-toggle-row"><div><b>Negative stock override</b><p>Admin-only, with a mandatory reason and reconciliation record.</p></div><Pill tone="warning">Policy enforced in design</Pill></div><div className="settings-actions"><Button variant="primary" onClick={()=>notify('Settings updated in this demo session. No database is connected yet.','success')}>Save changes</Button></div></div></div></div>:page==='Reports'?<><div className="stats-grid"><StatCard icon={Wallet} label="Net sales revenue" value="₹24,580" change="12.8%" note="After recorded returns and discounts"/><StatCard icon={TrendingUp} label="Gross profit" value="₹8,426" change="6.4%" note="Based on weighted average cost" accent="green"/><StatCard icon={ShoppingBag} label="Completed orders" value="384" change="8.2%" note="Voided sales excluded" accent="blue"/><StatCard icon={Boxes} label="Inventory cost value" value="₹1,82,940" change="2.1%" trend="down" note="Quantity on hand × average cost" accent="amber"/></div><div className="reports-grid"><div className="panel chart-panel"><div className="panel-head"><div><h2>Sales performance</h2><p>Revenue by day · Illustrative demo data</p></div><Button icon={CalendarDays}>Last 7 days</Button></div><div className="sales-chart report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={salesData} margin={{top:10,right:8,left:-12,bottom:0}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:12}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={formatShort}/><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--line)',borderRadius:12,color:'var(--text)'}} formatter={v=>[formatMoney(v),'Sales']}/><Bar dataKey="sales" fill="#7968e8" radius={[6,6,0,0]} maxBarSize={38}/></BarChart></ResponsiveContainer></div></div><div className="panel report-note"><div className="stat-icon icon-violet"><Sparkles size={18}/></div><h2>Reliable numbers, no guesswork.</h2><p>Ritvan reports gross profit using each sale line's saved cost snapshot. Net profit is intentionally unavailable until expense tracking exists.</p><Pill tone="success" dot>Cost-aware reporting</Pill></div></div></>:<><div className="stats-grid"><StatCard icon={Icon} label={page==='Transactions'?'Completed sales':'Total records'} value={page==='Transactions'?'384':String(rows.length||'08')} note="Demo data for interface review" accent="violet"/><StatCard icon={TrendingUp} label="This month" value="₹24,580" change="12.8%" note="Illustrative only" accent="green"/><StatCard icon={Clock3} label="Needs attention" value={page==='Items'?'03':'02'} note="Requires review" accent="amber"/><StatCard icon={CheckCircle2} label="Active" value={page==='Staff & Roles'?'06':'98%'} note="Current workspace" accent="blue"/></div><section className="panel generic-table-panel"><div className="panel-head"><div><h2>{page} overview</h2><p>Review and manage your {page.toLowerCase()}.</p></div><div className="toolbar-controls"><div className="search-box compact"><Search size={16}/><input placeholder={`Search ${page.toLowerCase()}...`} value={query} onChange={e=>setQuery(e.target.value)}/></div><Button icon={Filter} onClick={()=>notify('Additional filters will be available in the next phase.')}>Filter</Button></div></div>{config.columns.length&&rows.length?<div className="table-wrap"><table><thead><tr>{config.columns.map(c=><th key={c}>{c}</th>)}<th></th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}<td><button className="icon-button small" onClick={()=>notify('Record details will be connected to the backend in a later phase.')}><Ellipsis size={18}/></button></td></tr>)}</tbody></table></div>:<EmptyState icon={Icon} title={`Your ${page.toLowerCase()} workspace is ready`} text="This screen is scaffolded with the Ritvan design system. Connect the backend in the next phase to manage real records." action={<Button variant="primary" icon={Plus} onClick={actionClick}>{config.action}</Button>}/>}<div className="table-footer"><span>Demo mode · Data is illustrative</span><span className="muted">Live database integration is next</span></div></section></>}</>;
}

function App() {
  const [auth, setAuth] = useState(() => { try { const saved = sessionStorage.getItem('ritvan.auth') || sessionStorage.getItem('nexora.auth'); const parsed = saved ? JSON.parse(saved) : null; if (parsed) { sessionStorage.setItem('ritvan.auth', JSON.stringify(parsed)); sessionStorage.removeItem('nexora.auth'); } return parsed; } catch { return null; } }); const [demoMode, setDemoMode] = useState(false); const [apiLoading, setApiLoading] = useState(Boolean(auth)); const [active, setActive] = useState('Dashboard'); const [dark, setDark] = useState(false); const [sidebarOpen, setSidebarOpen] = useState(false); const [role, setRole] = useState(() => { try { return JSON.parse(sessionStorage.getItem('ritvan.auth') || 'null')?.user?.role || 'Admin'; } catch { return 'Admin'; } }); const [items, setItems] = useState(initialItems); const [searchOpen, setSearchOpen] = useState(false); const [globalSearch, setGlobalSearch] = useState(''); const [notificationsOpen, setNotificationsOpen] = useState(false); const [toast, setToast] = useState(null); const [currency, setCurrency] = useState('INR'); const [businessName, setBusinessName] = useState('Ritvan Store'); const [businessLogo, setBusinessLogo] = useState('');
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setApiLoading(true);
    Promise.all([
      apiRequest('/items', { token: auth.token }),
      apiRequest('/settings', { token: auth.token }),
      apiRequest('/auth/me', { token: auth.token }),
    ])
      .then(([itemData, settingsData, sessionData]) => {
        if (cancelled) return;
        setItems(toUiItems(itemData.items || []));
        if (settingsData.settings?.currencyCode) setCurrency(settingsData.settings.currencyCode);
        if (settingsData.settings?.businessName) setBusinessName(settingsData.settings.businessName);
        setBusinessLogo(settingsData.settings?.logoData || '');
        if (sessionData.user) {
          setRole(sessionData.user.role);
          if (auth.user?.role !== sessionData.user.role || auth.user?.name !== sessionData.user.name || auth.user?.email !== sessionData.user.email || auth.user?.phone !== sessionData.user.phone || JSON.stringify(auth.user?.permissions || {}) !== JSON.stringify(sessionData.user.permissions || {})) {
            const currentSession = { ...auth, user: sessionData.user };
            sessionStorage.setItem('ritvan.auth', JSON.stringify(currentSession));
            setAuth(currentSession);
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        sessionStorage.removeItem('ritvan.auth'); sessionStorage.removeItem('nexora.auth');
        setAuth(null);
        setApiLoading(false);
      })
      .finally(() => { if (!cancelled) setApiLoading(false); });
    return () => { cancelled = true; };
  }, [auth]);
  const login = async credentials => {
    const result = await apiRequest('/auth/login', { method: 'POST', body: credentials });
    const session = { token: result.token, user: result.user };
    sessionStorage.setItem('ritvan.auth', JSON.stringify(session));
    setRole(result.user.role);
    setApiLoading(true);
    setAuth(session);
    setDemoMode(false);
  };
  const updateAuthFromProfile = result => {
    const currentSession = { ...(auth || {}), token: result?.token || auth?.token, user: result?.user || auth?.user };
    sessionStorage.setItem('ritvan.auth', JSON.stringify(currentSession));
    setAuth(currentSession);
    if (currentSession.user?.role) setRole(currentSession.user.role);
  };
  const logout = () => {
    sessionStorage.removeItem('ritvan.auth'); sessionStorage.removeItem('nexora.auth');
    setAuth(null);
    setDemoMode(false);
    setApiLoading(false);
    setItems(initialItems);
    setCurrency('INR');
    setBusinessName('Ritvan Store');
    setBusinessLogo('');
    setActive('Dashboard');
    setRole('Admin');
  };
  const userName = auth?.user?.name || 'Alex Rivera';
  const userInitials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'AR';
  const inventoryAttentionCount = items.filter(item => Number(item.stock) <= Number(item.reorderThreshold ?? 8)).length;
  const fallbackModules = APP_ROLE_MODULES[role] || APP_ROLE_MODULES.Cashier;
  const visibleModules = auth?.user?.permissions?.modules || (auth ? fallbackModules : fallbackModules.filter(module => module !== 'Employees'));
  const visibleNavGroups = navGroups.map(group => ({ ...group, items: group.items.filter(item => visibleModules.includes(item.id)) })).filter(group => group.items.length > 0);
  if (!auth && !demoMode) return <LoginScreen onLogin={login} onDemo={() => setDemoMode(true)} />;
  if (auth && apiLoading) return <div className="app-loading-screen"><div className="login-brand-mark"><i /><i /><i /><i /></div><h2>Preparing your workspace</h2><p>Connecting your store catalog…</p></div>;
  const notify = (message, type='info') => { setToast({message,type}); window.clearTimeout(window.__ritvanToast); window.__ritvanToast=window.setTimeout(()=>setToast(null),3600); };
  const go = page => {setActive(page);setSidebarOpen(false);};
  const allPages = visibleNavGroups.flatMap(g=>g.items.map(i=>i.id)).concat(visibleModules.includes('Settings') ? ['Settings'] : []).concat(auth ? ['My Profile'] : []);
  const searchResults = allPages.filter(p=>p.toLowerCase().includes(globalSearch.toLowerCase()));
  return <div className={`app-shell ${dark?'theme-dark':''}`}>
    {sidebarOpen&&<button className="mobile-scrim" onClick={()=>setSidebarOpen(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${sidebarOpen?'sidebar-open':''}`}><div className="brand-row"><BrandMark/><div className="brand-wordmark"><b>RITVAN</b><span>POINT OF SALE</span></div><button className="sidebar-close icon-button" onClick={()=>setSidebarOpen(false)}><X size={18}/></button></div><button className="workspace-switch"><span className="workspace-avatar">{businessLogo ? <img className="workspace-logo-image" src={businessLogo} alt="" /> : <BriefcaseBusiness size={16}/>}</span><span className="workspace-copy"><b>{businessName || 'Ritvan Store'}</b><small>Retail workspace</small></span><ChevronDown size={15}/></button><nav className="main-nav">{visibleNavGroups.map(group=><div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>go(item.id)} className={`nav-item ${active===item.id?'nav-active':''}`}><Icon size={18} strokeWidth={1.8}/><span>{item.id}</span>{item.badge&&<kbd>{item.badge}</kbd>}{item.id==='Inventory'&&inventoryAttentionCount>0&&<span className="nav-alert" title={`${inventoryAttentionCount} items low or out of stock`}>{inventoryAttentionCount}</span>}</button>})}</div>)}</nav><div className="sidebar-bottom">{visibleModules.includes('Settings') && <button className={`nav-item ${active==='Settings'?'nav-active':''}`} onClick={()=>go('Settings')}><Settings size={18}/><span>Settings</span></button>}{auth&&<button className="nav-item" onClick={logout}><LogOut size={18}/><span>Sign out</span></button>}<div className="sidebar-help"><div className="help-orb"><LifeBuoy size={18}/></div><b>Need a hand?</b><p>Our help center is always open.</p><button onClick={()=>notify('Help center link will be added in a later phase.')}>Visit help center <ArrowRight size={13}/></button></div><button className="profile-row profile-row-button" onClick={()=>auth ? go('My Profile') : notify('Sign in to manage your profile.','warning')} aria-label="Open your profile settings"><Avatar initials={userInitials} color="purple"/><span className="profile-copy"><b>{userName}</b><small>{role}</small></span><ChevronRight size={15} className="profile-row-chevron"/></button></div></aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{active}</b></div></div><div className="topbar-actions"><button className="global-search" onClick={()=>setSearchOpen(true)}><Search size={16}/><span>Search anything...</span><kbd>⌘ K</kbd></button><span className="topbar-divider"/><button className="icon-button theme-switch" onClick={()=>setDark(!dark)} title={dark?'Switch to light theme':'Switch to dark theme'}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><div className="notification-wrap"><button className={`icon-button notification-button ${notificationsOpen?'button-selected':''}`} onClick={()=>setNotificationsOpen(!notificationsOpen)} aria-label="Notifications"><Bell size={18}/><i/></button>{notificationsOpen&&<div className="notification-popover"><div className="popover-title"><b>Notifications</b><Pill tone={inventoryAttentionCount ? "warning" : "neutral"}>{inventoryAttentionCount} stock alert{inventoryAttentionCount===1?"":"s"}</Pill></div>{inventoryAttentionCount>0?<div className="notification-item"><span className="notification-icon warning-bg"><AlertTriangle size={16}/></span><div><b>Stock needs attention</b><p>{inventoryAttentionCount} item{inventoryAttentionCount===1?" is":"s are"} low or out of stock.</p><small>Based on saved inventory levels</small></div></div>:<div className="notification-item"><span className="notification-icon success-bg"><CheckCircle2 size={16}/></span><div><b>Stock levels look good</b><p>No items are at or below their reorder threshold.</p><small>Based on saved inventory levels</small></div></div>}<div className="notification-item"><span className="notification-icon success-bg"><CheckCircle2 size={16}/></span><div><b>Daily summary ready</b><p>Yesterday's sales report is available.</p><small>1 hour ago</small></div></div><button className="popover-link" onClick={()=>{setNotificationsOpen(false);go('Inventory')}}>Review stock alerts <ArrowRight size={14}/></button></div>}</div><span className="topbar-divider"/>{auth ? <div className="role-switch"><span>Signed in as</span><b>{role}</b></div> : <div className="role-switch"><span>Preview as</span><select value={role} onChange={e=>{setRole(e.target.value);notify(`Preview role changed to ${e.target.value}. Demo mode only; server permissions are not connected.`)}}><option>Admin</option><option>Manager</option><option>Cashier</option></select></div>}<button className="topbar-profile-button" onClick={()=>auth ? go('My Profile') : notify('Sign in to manage your profile.','warning')} title="My profile" aria-label="Open my profile"><Avatar initials={userInitials} color="purple"/></button></div></header><div className="page-content">{auth && active==='My Profile'?<AccountProfilePage auth={auth} notify={notify} onUnauthorized={logout} onProfileUpdated={updateAuthFromProfile}/>:active==='Dashboard'?<Dashboard items={items} onNavigate={go} isLive={Boolean(auth)} auth={auth} currency={currency}/>:active==='Point of Sale'?<POS items={items} setItems={setItems} notify={notify} role={role} currency={currency} auth={auth} onUnauthorized={logout} businessName={businessName} businessLogo={businessLogo}/>:auth && active === 'Employees' ? <EmployeesPage auth={auth} notify={notify} onUnauthorized={logout} currency={currency}/> : auth && ['Inventory','Items','Categories','Purchases','Suppliers','Customers','Transactions','Staff & Roles','Spendings','Reports','Returns & Refunds','Settings'].includes(active)?<LiveModulePage page={active} auth={auth} items={items} setItems={setItems} notify={notify} onUnauthorized={logout} onNavigate={go} currency={currency} businessName={businessName} businessLogo={businessLogo} onCurrencyChange={setCurrency} onBusinessNameChange={setBusinessName} onBusinessLogoChange={setBusinessLogo}/>:<GenericPage page={active} onNavigate={go} items={items} setItems={setItems} notify={notify} currency={currency}/>}<footer className="app-footer"><span>© 2026 Ritvan POS <span className="footer-separator">·</span> Built for better business.</span><span><span className="live-dot"/> {auth ? 'API connected' : 'Demo workspace'} <span className="footer-separator">·</span> <button onClick={()=>notify('Ritvan POS · Phase 2 integration branch')}>v0.2.0</button></span></footer></div></main>
    {searchOpen&&<div className="modal-backdrop search-backdrop" onClick={()=>setSearchOpen(false)}><div className="global-search-modal" onClick={e=>e.stopPropagation()}><div className="global-search-input"><Search size={19}/><input autoFocus placeholder="Search pages..." value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}/><kbd>ESC</kbd><button className="icon-button small" onClick={()=>setSearchOpen(false)}><X size={17}/></button></div><div className="search-results-label">NAVIGATION</div>{searchResults.length?searchResults.map(p=><button className="search-result" key={p} onClick={()=>{go(p);setSearchOpen(false);setGlobalSearch('')}}><span className="search-result-icon"><Command size={16}/></span><span>{p}</span><ArrowRight size={15}/></button>):<div className="search-no-results">No pages match “{globalSearch}”.</div>}<div className="search-modal-footer"><span>Navigate to a page</span><span><kbd>↑</kbd> <kbd>↓</kbd> to browse <kbd>↵</kbd> to open</span></div></div></div>}
    {toast&&<div className={`toast toast-${toast.type}`}><span className="toast-icon">{toast.type==='success'?<CheckCircle2 size={18}/>:toast.type==='warning'?<AlertTriangle size={18}/>:<Activity size={18}/>}</span><span>{toast.message}</span><button onClick={()=>setToast(null)}><X size={15}/></button></div>}
  </div>;
}


// Render-time failures should never leave a silent white page.
// This boundary is also useful in local development to expose the actual error.
class RitvanErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Ritvan UI render error:', error, info?.componentStack || '');
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5f3ff', color: '#25213b', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <section style={{ width: 'min(680px, 100%)', padding: 28, background: '#fff', border: '1px solid #ded8ff', borderRadius: 20, boxShadow: '0 24px 80px #30205b18' }}>
          <div style={{ fontSize: 11, letterSpacing: '.16em', fontWeight: 800, color: '#7968e8' }}>RITVAN POS · RECOVERY</div>
          <h1 style={{ fontSize: 26, margin: '12px 0 8px' }}>The workspace hit a UI error</h1>
          <p style={{ color: '#716d88', lineHeight: 1.6 }}>This version catches render errors and shows the actual message instead of leaving a blank screen.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 14, borderRadius: 10, background: '#f7f5ff', color: '#a12441', fontSize: 12 }}>{this.state.error?.stack || this.state.error?.message || 'Unknown render error'}</pre>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 10, padding: '11px 16px', background: '#7968e8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Reload workspace</button>
            <button onClick={() => { sessionStorage.removeItem('ritvan.auth'); sessionStorage.removeItem('nexora.auth'); window.location.reload(); }} style={{ border: '1px solid #ded8ff', borderRadius: 10, padding: '11px 16px', background: '#fff', color: '#4f4969', fontWeight: 700, cursor: 'pointer' }}>Return to sign in</button>
          </div>
        </section>
      </div>
    );
  }
}

export default function RitvanApp() {
  return <RitvanErrorBoundary><App /></RitvanErrorBoundary>;
}
