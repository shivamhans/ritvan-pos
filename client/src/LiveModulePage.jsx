import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, CheckCircle2, ChevronDown, ClipboardList,
  Clock3, Download, Eye, Filter, ImagePlus, Package, PackagePlus, Pencil, Plus, RefreshCw, Search, ShieldCheck,
  Tag, Truck, Users, Wallet, Store, X, RotateCcw, History, CircleCheck, CircleHelp, FileText, Save
} from 'lucide-react';
import { apiRequest, toUiItems } from './lib/api.js';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const cash = value => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const asDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const prettyStatus = value => String(value || 'Unknown').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const isManager = role => ['Admin', 'Manager'].includes(role);
const localDateInput = date => { const copy = new Date(date); copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset()); return copy.toISOString().slice(0, 10); };
const shortDay = value => new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

function EmptyState({ icon: Icon = Package, title, text, action }) {
  return <div className="empty-state">
    <div className="empty-icon"><Icon size={24}/></div>
    <h3>{title}</h3>
    <p>{text}</p>
    {action}
  </div>;
}


const PERMISSION_MODULES_BY_ROLE = {
  Admin: ['Dashboard', 'Point of Sale', 'Transactions', 'Inventory', 'Items', 'Categories', 'Purchases', 'Suppliers', 'Customers', 'Staff & Roles', 'Employees', 'Spendings', 'Reports', 'Returns & Refunds', 'Settings'],
  Manager: ['Dashboard', 'Point of Sale', 'Transactions', 'Inventory', 'Items', 'Categories', 'Purchases', 'Suppliers', 'Customers', 'Spendings', 'Reports', 'Returns & Refunds'],
  Cashier: ['Dashboard', 'Point of Sale', 'Transactions'],
};
const PERMISSION_COLUMN_OPTIONS = {
  Items: { name: 'Item', sku: 'SKU', category: 'Category', sellingPrice: 'Selling price', avgCost: 'Average cost', onHand: 'On hand', status: 'Status' },
  Inventory: { item: 'Item', sku: 'SKU', onHand: 'On hand', avgCost: 'Average cost', stockValue: 'Stock value', status: 'Status', date: 'Date', movement: 'Movement', quantity: 'Quantity', costAtTime: 'Cost at time', reason: 'Reason', user: 'Changed by' },
  Categories: { category: 'Category', itemCount: 'Item count', description: 'Description', status: 'Status' },
  Purchases: { purchaseNo: 'Purchase number', supplier: 'Supplier', purchaseDate: 'Order date', lineCount: 'Lines', totalAmount: 'Total', status: 'Status' },
  Suppliers: { supplier: 'Supplier', contact: 'Contact', emailPhone: 'Email / phone', purchaseOrders: 'Purchase orders', status: 'Status' },
  Customers: { customer: 'Customer', contact: 'Contact', orders: 'Orders', totalSpent: 'Total spent', outstandingBalance: 'Khata outstanding', lastPurchase: 'Last purchase' },
  Transactions: { receiptNo: 'Receipt', customer: 'Customer', cashier: 'Cashier', date: 'Date', payment: 'Payment method', total: 'Total', status: 'Status' },
  'Returns & Refunds': { returnNo: 'Return number', receiptNo: 'Original receipt', customer: 'Customer', date: 'Date', refund: 'Refund', settlement: 'Settlement', status: 'Status' },
};
const DEFAULT_PERMISSION_COLUMNS = {
  Items: Object.keys(PERMISSION_COLUMN_OPTIONS.Items),
  Inventory: Object.keys(PERMISSION_COLUMN_OPTIONS.Inventory),
  Categories: Object.keys(PERMISSION_COLUMN_OPTIONS.Categories),
  Purchases: Object.keys(PERMISSION_COLUMN_OPTIONS.Purchases),
  Suppliers: Object.keys(PERMISSION_COLUMN_OPTIONS.Suppliers),
  Customers: Object.keys(PERMISSION_COLUMN_OPTIONS.Customers),
  Transactions: Object.keys(PERMISSION_COLUMN_OPTIONS.Transactions),
  'Returns & Refunds': Object.keys(PERMISSION_COLUMN_OPTIONS['Returns & Refunds']),
};
const CASHIER_PERMISSION_COLUMNS = {
  Items: ['name', 'sku', 'category', 'sellingPrice', 'onHand', 'status'],
  Transactions: ['receiptNo', 'date', 'total', 'status'],
};


function LiveButton({ children, onClick, variant = 'secondary', icon: Icon, disabled, type = 'button' }) {
  return <button type={type} className={'btn btn-' + variant} onClick={onClick} disabled={disabled}>{Icon && <Icon size={16} strokeWidth={2} />}{children}</button>;
}
function StatusPill({ value }) {
  const status = String(value || '').toUpperCase();
  const tone = ['ACTIVE', 'COMPLETED', 'RECEIVED', 'PAID', 'RESOLVED', 'IN_STOCK'].includes(status) ? 'success'
    : ['OUT_OF_STOCK', 'CANCELLED', 'VOID', 'INACTIVE', 'DAMAGE_WRITE_OFF'].includes(status) ? 'danger'
    : ['ORDERED', 'PARTIALLY_RECEIVED', 'OPEN', 'LOW_STOCK', 'PENDING'].includes(status) ? 'warning' : 'neutral';
  return <span className={'pill pill-' + tone} dot="true"><i />{prettyStatus(value)}</span>;
}
function Field({ label, children, hint }) {
  return <label className="live-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function LiveModal({ title, subtitle, onClose, children, onSubmit, submitLabel = 'Save record', busy = false, wide = false }) {
  return <div className="modal-backdrop" onClick={onClose}><form className={'modal live-modal' + (wide ? ' live-modal-wide' : '')} onClick={e => e.stopPropagation()} onSubmit={onSubmit}>
    <div className="modal-head"><div><div className="eyebrow">RITVAN WORKSPACE</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    <div className="live-modal-content">{children}</div>
    <div className="modal-actions"><LiveButton onClick={onClose}>Cancel</LiveButton><LiveButton type="submit" variant="primary" icon={Save} disabled={busy}>{busy ? 'Saving…' : submitLabel}</LiveButton></div>
  </form></div>;
}
function BlankState({ title, text, onAdd, addLabel }) {
  return <div className="empty-state live-empty"><div className="empty-icon"><ClipboardList size={21}/></div><h3>{title}</h3><p>{text}</p>{onAdd && <LiveButton variant="primary" icon={Plus} onClick={onAdd}>{addLabel || 'Add first record'}</LiveButton>}</div>;
}

export default function LiveModulePage({ page, auth, items, setItems, notify, onUnauthorized, onNavigate, onCurrencyChange, businessName, businessLogo, onBusinessNameChange, onBusinessLogoChange }) {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSummary, setCustomerSummary] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [movements, setMovements] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [receivePurchase, setReceivePurchase] = useState(null);
  const [receiveQuantities, setReceiveQuantities] = useState({});
  const [transactionDetail, setTransactionDetail] = useState(null);
  const [creditLedger, setCreditLedger] = useState(null);
  const [staff, setStaff] = useState([]);
  const [returnsRows, setReturnsRows] = useState([]);
  const [spendings, setSpendings] = useState([]);
  const [spendingSummary, setSpendingSummary] = useState(null);
  const [spendingFrom, setSpendingFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return localDateInput(date); });
  const [spendingTo, setSpendingTo] = useState(() => localDateInput(new Date()));
  const [spendingQuery, setSpendingQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productSort, setProductSort] = useState('netSales');
  const [settings, setSettings] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTo, setReportTo] = useState(() => localDateInput(new Date()));
  const [reportFrom, setReportFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 6); return localDateInput(date); });
  const [returnSale, setReturnSale] = useState(null);
  const [returnLines, setReturnLines] = useState([]);
  const [pageError, setPageError] = useState('');

  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;
  const role = auth?.user?.role || 'Cashier';
  const canManage = isManager(role);
  const token = auth?.token;
  const refresh = () => setRefreshKey(value => value + 1);
  const columnVisible = (module, column) => {
    const selection = auth?.user?.permissions?.columns?.[module];
    if (Array.isArray(selection)) return selection.includes(column);
    const fallback = role === 'Cashier' ? CASHIER_PERMISSION_COLUMNS[module] : null;
    return fallback ? fallback.includes(column) : true;
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setPageError('');
      const get = path => apiRequest(path, { token });
      try {
        if (page === 'Items') {
          const [itemData, categoryData] = await Promise.all([get('/items'), get('/categories?includeInactive=' + (canManage ? '1' : '0'))]);
          if (!cancelled) { setItems(toUiItems(itemData.items || [])); setCategories(categoryData.categories || []); }
        } else if (page === 'Inventory') {
          const [itemData, movementData, reconData] = await Promise.all([get('/items'), get('/inventory/movements?limit=100'), get('/inventory/reconciliations')]);
          if (!cancelled) { setItems(toUiItems(itemData.items || [])); setMovements(movementData.movements || []); setReconciliations(reconData.reconciliations || []); }
        } else if (page === 'Categories') {
          const data = await get('/categories?includeInactive=' + (canManage ? '1' : '0'));
          if (!cancelled) setCategories(data.categories || []);
        } else if (page === 'Suppliers') {
          const data = await get('/suppliers?includeInactive=' + (canManage ? '1' : '0'));
          if (!cancelled) setSuppliers(data.suppliers || []);
        } else if (page === 'Customers') {
          const data = await get('/customers?includeInactive=' + (canManage ? '1' : '0'));
          if (!cancelled) { setCustomers(data.customers || []); setCustomerSummary(data.summary || null); }
        } else if (page === 'Purchases') {
          const [purchaseData, supplierData, itemData] = await Promise.all([get('/purchases'), get('/suppliers'), get('/items')]);
          if (!cancelled) { setPurchases(purchaseData.purchases || []); setSuppliers(supplierData.suppliers || []); setItems(toUiItems(itemData.items || [])); }
        } else if (page === 'Transactions') {
          const data = await get('/transactions?limit=100&offset=0');
          if (!cancelled) setTransactions(data.transactions || []);
        } else if (page === 'Staff & Roles') {
          const data = await get('/staff');
          if (!cancelled) setStaff(data.staff || []);
        } else if (page === 'Returns & Refunds') {
          const data = await get('/returns');
          if (!cancelled) setReturnsRows(data.returns || []);
        } else if (page === 'Spendings') {
          const data = await get('/spendings?from=' + encodeURIComponent(spendingFrom) + '&to=' + encodeURIComponent(spendingTo));
          if (!cancelled) { setSpendings(data.spendings || []); setSpendingSummary(data.summary || null); }
        } else if (page === 'Settings') {
          const data = await get('/settings');
          if (!cancelled) setSettings(data.settings || null);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error.message || 'Could not load records from the API.');
          if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (token) run();
    else { setLoading(false); setPageError('Sign in to access database-backed records.'); }
    return () => { cancelled = true; };
  }, [page, token, refreshKey, canManage, setItems, spendingFrom, spendingTo]);

  useEffect(() => {
    if (page !== 'Reports' || !token) return;
    let cancelled = false;
    setReportLoading(true);
    apiRequest('/reports/summary?from=' + encodeURIComponent(reportFrom) + '&to=' + encodeURIComponent(reportTo), { token })
      .then(data => { if (!cancelled) { setReportData(data); setPageError(''); } })
      .catch(error => {
        if (!cancelled) setPageError(error.message || 'Could not load reports.');
        if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [page, token, reportFrom, reportTo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const match = value => String(value ?? '').toLowerCase().includes(q);
    if (page === 'Items' || page === 'Inventory') return items.filter(row => [row.name, row.sku, row.category].some(match));
    if (page === 'Categories') return categories.filter(row => [row.name, row.description].some(match));
    if (page === 'Suppliers') return suppliers.filter(row => [row.name, row.contactName, row.email, row.phone].some(match));
    if (page === 'Customers') return customers.filter(row => [row.name, row.email, row.phone, row.isBusiness ? 'business' : 'individual'].some(match));
    if (page === 'Purchases') return purchases.filter(row => [row.purchaseNo, row.supplier, row.status].some(match));
    if (page === 'Transactions') return transactions.filter(row => [row.receiptNo, row.customer, row.cashier, row.paymentMethod, row.method, row.status].some(match));
    if (page === 'Staff & Roles') return staff.filter(row => [row.name, row.email, row.role].some(match));
    if (page === 'Returns & Refunds') return returnsRows.filter(row => [row.returnNo, row.receiptNo, row.customer, row.status, row.refundMethod].some(match));
    if (page === 'Spendings') return spendings.filter(row => [row.description, row.category, row.paidTo, row.referenceNo, row.paymentMode, row.status].some(match));
    return [];
  }, [page, query, items, categories, suppliers, customers, purchases, transactions, staff, returnsRows, spendings]);

  const currentRows = filtered || (page === 'Items' || page === 'Inventory' ? items : page === 'Categories' ? categories : page === 'Suppliers' ? suppliers : page === 'Customers' ? customers : page === 'Purchases' ? purchases : page === 'Staff & Roles' ? staff : page === 'Returns & Refunds' ? returnsRows : page === 'Spendings' ? spendings : transactions);
  const setValue = (key, value) => setForm(old => ({ ...old, [key]: value }));

  const handleItemPhoto = async event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Choose an image file to use as the product photo.', 'warning');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify('Choose an image under 8 MB. Ritvan will resize it before saving.', 'warning');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close?.(); throw new Error('Could not prepare the photo.'); }
      const preserveTransparency = file.type === 'image/png' || file.type === 'image/webp';
      let imageData = '';
      for (const maxSide of [560, 480, 420, 360, 300, 240, 180]) {
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!preserveTransparency) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const candidate = preserveTransparency ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.72);
        if (candidate.length <= 650000) { imageData = candidate; break; }
      }
      bitmap.close?.();
      if (!imageData) throw new Error('This photo is still too large after compression. Choose a smaller or simpler image.');
      setValue('imageData', imageData);
      notify('Product photo ready to save.', 'success');
    } catch (error) {
      notify(error.message || 'Could not read that image. Try a JPEG, PNG, or WebP file.', 'warning');
    }
  };
  const cancelPurchase = async row => {
    if (!canManage || busy || String(row.status).toUpperCase() !== 'ORDERED' || Number(row.quantityReceived || 0) > 0) return;
    const confirmed = window.confirm(`Cancel purchase ${row.purchaseNo}? This cannot be undone. No stock has been received, so inventory will remain unchanged.`);
    if (!confirmed) return;
    await runRequest('/purchases/' + encodeURIComponent(row.id) + '/cancel', 'POST', {}, `Purchase ${row.purchaseNo} cancelled. Inventory was not changed.`);
  };
  const openEdit = async row => {
    if (!canManage) return;
    if (page === 'Items') {
      setForm({
        id: row.apiId,
        name: row.name || '',
        sku: row.sku || '',
        barcode: row.barcode || '',
        categoryId: row.categoryId == null ? '' : String(row.categoryId),
        sellingPrice: String(row.price ?? ''),
        reorderThreshold: String(row.reorderThreshold ?? 5),
        imageData: row.imageUrl || '',
      });
      setModal('edit');
    } else if (page === 'Categories') {
      setForm({
        id: Number(row.id),
        name: row.name || '',
        description: row.description || '',
        isActive: Number(row.isActive) ? '1' : '0',
      });
      setModal('edit');
    } else if (page === 'Customers') {
      setForm({
        id: Number(row.id), name: row.name || '', email: row.email || '',
        phone: row.phone || '', notes: row.notes || '',
        isBusiness: Number(row.isBusiness) ? '1' : '0',
      });
      setModal('edit');
    } else if (page === 'Purchases') {
      if (String(row.status).toUpperCase() !== 'ORDERED' || Number(row.quantityReceived || 0) > 0) {
        notify('Only an order with no received quantities can be edited.', 'warning');
        return;
      }
      setBusy(true);
      try {
        const result = await apiRequest('/purchases/' + row.id, { token });
        const purchase = result.purchase;
        if (String(purchase.status).toUpperCase() !== 'ORDERED' || (purchase.lines || []).some(line => Number(line.quantityReceived || 0) > 0)) {
          notify('This purchase has already started receiving and is now read-only.', 'warning');
          refresh();
          return;
        }
        setForm({
          id: Number(purchase.id),
          supplierId: purchase.supplierId == null ? '' : String(purchase.supplierId),
          purchaseDate: String(purchase.purchaseDate || '').slice(0, 10),
          notes: purchase.notes || '',
          lines: (purchase.lines || []).map(line => ({
            itemId: String(line.itemId),
            quantity: String(line.quantityOrdered),
            unitCost: String(line.unitCost),
          })),
        });
        setModal('edit');
      } catch (error) {
        notify(error.message || 'Could not load purchase details.', 'warning');
        if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
      } finally { setBusy(false); }
    }
  };

  const openCreate = () => {
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    setForm(page === 'Items' ? { name: '', sku: '', categoryId: '', sellingPrice: '', initialCost: '', initialQty: '0', reorderThreshold: '5', barcode: '', imageData: '' }
      : page === 'Spendings' ? { spendingDate: iso, category: 'Utilities', description: '', amount: '', paymentMode: 'CASH', paidTo: '', referenceNo: '', notes: '' }
      : page === 'Staff & Roles' ? { name: '', email: '', role: 'Cashier', password: '' }
      : page === 'Categories' ? { name: '', description: '' }
      : page === 'Suppliers' ? { name: '', contactName: '', email: '', phone: '', address: '', notes: '' }
      : page === 'Customers' ? { name: '', email: '', phone: '', notes: '', isBusiness: '0' }
      : page === 'Purchases' ? { supplierId: '', purchaseDate: iso, notes: '', lines: [{ itemId: items[0]?.apiId || '', quantity: '1', unitCost: '0.00' }] }
      : {});
    setModal('create');
  };

  const runRequest = async (path, method, body, successMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(path, { method: method || 'GET', token, ...(body === undefined ? {} : { body }) });
      notify(successMessage || 'Saved successfully.', 'success');
      setModal('');
      setRefreshKey(value => value + 1);
      return true;
    } catch (error) {
      notify(error.message || 'Request failed.', 'warning');
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitSpending = async event => {
    event.preventDefault();
    if (busy) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { notify('Enter an amount greater than zero.', 'warning'); return; }
    if (!String(form.category || '').trim() || !String(form.description || '').trim()) { notify('Category and reason are required.', 'warning'); return; }
    const payload = {
      spendingDate: form.spendingDate,
      category: String(form.category).trim(),
      description: String(form.description).trim(),
      amount,
      paymentMode: form.paymentMode || 'CASH',
      paidTo: form.paidTo || null,
      referenceNo: form.referenceNo || null,
      notes: form.notes || null,
    };
    setBusy(true);
    try {
      const editing = modal === 'spending-edit';
      await apiRequest(editing ? '/spendings/' + encodeURIComponent(form.id) : '/spendings', {
        method: editing ? 'PATCH' : 'POST', token, body: payload,
      });
      notify(editing ? 'Spending record updated.' : 'Spending recorded successfully.', 'success');
      setModal('');
      setRefreshKey(value => value + 1);
    } catch (error) {
      notify(error.message || 'Could not save spending record.', 'warning');
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
    } finally { setBusy(false); }
  };

  const submitVoidSpending = async event => {
    event.preventDefault();
    if (busy) return;
    const reason = String(form.voidReason || '').trim();
    if (reason.length < 5) { notify('Enter a void reason of at least 5 characters.', 'warning'); return; }
    setBusy(true);
    try {
      await apiRequest('/spendings/' + encodeURIComponent(form.id) + '/void', {
        method: 'POST', token, body: { reason },
      });
      notify('Spending voided. The original record remains in history.', 'success');
      setModal('');
      setRefreshKey(value => value + 1);
    } catch (error) {
      notify(error.message || 'Could not void spending record.', 'warning');
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
    } finally { setBusy(false); }
  };

  const submitCreate = async event => {
    event.preventDefault();
    if (busy) return;
    const editing = modal === 'edit';
    let path = '';
    let method = editing ? 'PATCH' : 'POST';
    let payload = {};

    if (page === 'Items') {
      payload = {
        name: form.name,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        sellingPrice: Number(form.sellingPrice),
        reorderThreshold: Number(form.reorderThreshold || 5),
        barcode: form.barcode || null,
        imageData: form.imageData || null,
      };
      const enteredSku = String(form.sku || '').trim();
      if (enteredSku) payload.sku = enteredSku;
      if (editing) {
        path = '/items/' + encodeURIComponent(form.id);
      } else {
        payload.initialCost = Number(form.initialCost || 0);
        payload.initialQty = Number(form.initialQty || 0);
        path = '/items';
      }
    } else if (page === 'Categories') {
      payload = { name: form.name, description: form.description || null };
      if (editing) {
        payload.isActive = form.isActive === '1';
        path = '/categories/' + encodeURIComponent(form.id);
      } else {
        path = '/categories';
      }
    } else if (page === 'Suppliers') {
      payload = { name: form.name, contactName: form.contactName, email: form.email, phone: form.phone, address: form.address, notes: form.notes };
      path = '/suppliers';
    } else if (page === 'Customers') {
      payload = { name: form.name, email: form.email || null, phone: form.phone, notes: form.notes, isBusiness: form.isBusiness === '1' };
      path = editing ? '/customers/' + encodeURIComponent(form.id) : '/customers';
    } else if (page === 'Staff & Roles') {
      payload = { name: form.name, email: form.email, role: form.role, password: form.password };
      path = '/staff';
    } else if (page === 'Purchases') {
      const lines = (form.lines || []).map(line => ({ itemId: Number(line.itemId), quantity: Number(line.quantity), unitCost: Number(line.unitCost) }));
      if (!lines.length || lines.some(line => !Number.isInteger(line.itemId) || line.itemId < 1 || !Number.isInteger(line.quantity) || line.quantity < 1 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) {
        notify('Each purchase line needs an item, a positive whole quantity, and a non-negative unit cost.', 'warning'); return;
      }
      if (new Set(lines.map(line => line.itemId)).size !== lines.length) { notify('Choose each item only once per purchase; combine its quantity.', 'warning'); return; }
      payload = { supplierId: form.supplierId ? Number(form.supplierId) : null, purchaseDate: form.purchaseDate, notes: form.notes || null, additionalCost: 0, lines };
      path = editing ? '/purchases/' + encodeURIComponent(form.id) : '/purchases';
    } else return;

    if (!String(form.name || '').trim() && page !== 'Purchases') {
      notify('Please fill in the required name field.', 'warning');
      return;
    }
    const success = editing
      ? (page === 'Items' ? 'Item details updated.' : page === 'Categories' ? 'Category details updated.' : page === 'Customers' ? 'Customer details updated.' : 'Purchase order updated. Inventory was not changed.')
      : page === 'Purchases' ? 'Purchase order created. Stock will change only when quantities are received.'
      : ({ Items: 'Item created.', Categories: 'Category created.', Suppliers: 'Supplier created.', Customers: 'Customer created.', 'Staff & Roles': 'Staff account created.' }[page] || 'Record created.');
    await runRequest(path, method, payload, success);
  };

  const setLine = (index, key, value) => setForm(old => ({ ...old, lines: old.lines.map((line, i) => i === index ? { ...line, [key]: value } : line) }));
  const openReceive = async purchase => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await apiRequest('/purchases/' + purchase.id, { token });
      const selected = data.purchase;
      setReceivePurchase(selected);
      const quantities = {};
      for (const line of selected.lines || []) quantities[line.purchaseItemId] = String(Math.max(0, Number(line.quantityOrdered) - Number(line.quantityReceived)));
      setReceiveQuantities(quantities);
      setModal('receive');
    } catch (error) {
      notify(error.message || 'Could not load purchase details.', 'warning');
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
    } finally { setBusy(false); }
  };
  const submitReceive = async event => {
    event.preventDefault();
    if (!receivePurchase || busy) return;
    const lines = (receivePurchase.lines || []).map(line => ({ purchaseItemId: Number(line.purchaseItemId), quantity: Number(receiveQuantities[line.purchaseItemId] || 0) })).filter(line => line.quantity > 0);
    if (!lines.length || lines.some(line => !Number.isInteger(line.quantity))) { notify('Enter at least one positive whole quantity to receive.', 'warning'); return; }
    const saved = await runRequest('/purchases/' + receivePurchase.id + '/receive', 'POST', { lines }, 'Receipt recorded. On-hand stock and weighted average cost have been updated.');
    if (saved) setReceivePurchase(null);
  };

  const submitAdjustment = async event => {
    event.preventDefault();
    const delta = Number(form.delta);
    if (!Number.isInteger(delta) || delta === 0) { notify('Enter a non-zero whole-number adjustment.', 'warning'); return; }
    if (form.type === 'DAMAGE_WRITE_OFF' && (role !== 'Admin' || delta >= 0)) { notify('Damage write-offs are Admin-only and must reduce stock.', 'warning'); return; }
    await runRequest('/inventory/adjustments', 'POST', { itemId: Number(form.itemId), delta, reason: form.reason, type: form.type || 'ADJUSTMENT' }, 'Stock adjustment saved to the movement ledger.');
  };
  const submitResolve = async event => {
    event.preventDefault();
    const countedQty = Number(form.countedQty);
    if (!Number.isInteger(countedQty) || countedQty < 0 || String(form.reason || '').trim().length < 10) { notify('Enter a non-negative physical count and a reason of at least 10 characters.', 'warning'); return; }
    await runRequest('/inventory/reconciliations/' + form.itemId + '/resolve', 'POST', { countedQty, reason: form.reason }, 'Reconciliation resolved. Historical provisional sale-cost snapshots were preserved.');
  };

  const openTransaction = async row => {
    setBusy(true);
    try {
      const result = await apiRequest('/transactions/' + row.id, { token });
      setTransactionDetail(result.transaction);
      setModal('transaction');
    } catch (error) {
      notify(error.message || 'Could not load transaction details.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const openStaffPermissions = row => {
    if (row.role === 'Admin') {
      notify('Admin accounts retain full access. Configure permissions for Manager or Cashier accounts.', 'info');
      return;
    }
    const allowedModules = PERMISSION_MODULES_BY_ROLE[row.role] || PERMISSION_MODULES_BY_ROLE.Cashier;
    const stored = row.permissions || {};
    const columns = { ...(stored.columns || {}) };
    for (const module of allowedModules) {
      if (!PERMISSION_COLUMN_OPTIONS[module] || Array.isArray(columns[module])) continue;
      columns[module] = row.role === 'Cashier' && CASHIER_PERMISSION_COLUMNS[module]
        ? [...CASHIER_PERMISSION_COLUMNS[module]]
        : Object.keys(PERMISSION_COLUMN_OPTIONS[module]);
    }
    setForm({
      staffId: row.id,
      staffName: row.name,
      staffRole: row.role,
      permissionModules: Array.isArray(stored.modules) ? [...stored.modules] : [...allowedModules],
      permissionColumns: columns,
    });
    setModal('staff-permissions');
  };

  const togglePermissionModule = (module, checked) => {
    setForm(old => {
      const nextModules = checked
        ? [...new Set([...(old.permissionModules || []), module])]
        : (old.permissionModules || []).filter(value => value !== module);
      const nextColumns = { ...(old.permissionColumns || {}) };
      if (checked && PERMISSION_COLUMN_OPTIONS[module] && !Array.isArray(nextColumns[module])) {
        nextColumns[module] = (old.staffRole === 'Cashier' && CASHIER_PERMISSION_COLUMNS[module])
          ? [...CASHIER_PERMISSION_COLUMNS[module]]
          : Object.keys(PERMISSION_COLUMN_OPTIONS[module]);
      }
      return { ...old, permissionModules: nextModules, permissionColumns: nextColumns };
    });
  };

  const togglePermissionColumn = (module, column, checked) => {
    setForm(old => {
      const current = Array.isArray(old.permissionColumns?.[module])
        ? old.permissionColumns[module]
        : Object.keys(PERMISSION_COLUMN_OPTIONS[module] || {});
      const selected = checked ? [...new Set([...current, column])] : current.filter(value => value !== column);
      return { ...old, permissionColumns: { ...(old.permissionColumns || {}), [module]: selected } };
    });
  };

  const saveStaffPermissions = async event => {
    event.preventDefault();
    const modules = form.permissionModules || [];
    if (!modules.includes('Dashboard')) {
      notify('Dashboard must remain enabled so the staff member has a workspace landing page.', 'warning');
      return;
    }
    const columns = Object.fromEntries(
      Object.entries(form.permissionColumns || {}).filter(([module]) => modules.includes(module))
    );
    const saved = await runRequest('/staff/' + form.staffId, 'PATCH', { permissions: { modules, columns } }, 'Staff module access and visible columns updated.');
    if (saved) setForm({});
  };

  const openCustomerLedger = async row => {
    if (!row || busy) return;
    setBusy(true);
    try {
      const data = await apiRequest('/credit/customers/' + encodeURIComponent(row.id) + '/ledger', { token });
      setCreditLedger(data);
      setModal('credit-ledger');
    } catch (error) {
      notify(error.message || 'Could not load customer Khata history.', 'warning');
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
    } finally { setBusy(false); }
  };
  const openCreditRepayment = row => {
    const balance = Number(row?.outstandingBalance || 0);
    if (!row || balance <= 0) return;
    setForm({ customerId: Number(row.id), customerName: row.name, outstandingBalance: balance, amount: balance.toFixed(2), method: 'Cash', referenceNo: '', notes: '' });
    setModal('credit-payment');
  };

  const submitCreditRepayment = async event => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { notify('Enter a positive repayment amount.', 'warning'); return; }
    if (amount > Number(form.outstandingBalance || 0)) { notify('Repayment cannot exceed the displayed Khata balance.', 'warning'); return; }
    await runRequest('/credit/repayments', 'POST', {
      customerId: Number(form.customerId),
      amount,
      method: form.method,
      referenceNo: form.referenceNo || null,
      notes: form.notes || null,
    }, 'Khata repayment recorded. The customer balance has been refreshed.');
  };

  const changeStaffRole = async (row, nextRole) => {
    if (row.role === nextRole) return;
    await runRequest('/staff/' + row.id, 'PATCH', { role: nextRole }, 'Role updated. Existing API requests now use the current server role.');
  };

  const resetStaffPassword = async event => {
    event.preventDefault();
    if (!form.password || form.password.length < 12) { notify('Password must be at least 12 characters.', 'warning'); return; }
    const saved = await runRequest('/staff/' + form.staffId, 'PATCH', { password: form.password }, 'Staff password reset successfully.');
    if (saved) setForm(old => ({ ...old, password: '' }));
  };

  const handleBusinessLogo = async event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Choose an image file for your store logo.', 'warning'); return; }
    if (file.size > 8 * 1024 * 1024) { notify('Choose a logo image under 8 MB. Ritvan will resize it before saving.', 'warning'); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close?.(); throw new Error('Could not prepare the logo image.'); }

      // Keep the canvas transparent. Exporting as JPEG or painting white behind
      // the image destroys the alpha channel of background-removed PNG/WebP logos.
      // Shrink progressively until the transparent PNG fits the API's size limit.
      let logoData = '';
      for (const maxSide of [420, 360, 300, 240, 180, 128]) {
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const candidate = canvas.toDataURL('image/png');
        if (candidate.length <= 650000) { logoData = candidate; break; }
      }
      bitmap.close?.();
      if (!logoData) throw new Error('This logo could not be compressed enough while preserving its transparent background. Choose a simpler or smaller PNG.');
      const previousLogo = settings?.logoData || '';
      setSettings(old => ({ ...old, logoData }));
      setBusy(true);
      try {
        // Save the branding asset immediately so all receipt surfaces receive the
        // authoritative logo even if the user navigates away before saving other settings.
        const result = await apiRequest('/settings', { method: 'PATCH', token, body: { logoData } });
        const savedLogo = result.settings?.logoData || logoData;
        setSettings(old => ({ ...old, logoData: savedLogo, updatedAt: result.settings?.updatedAt || old?.updatedAt }));
        if (onBusinessLogoChange) onBusinessLogoChange(savedLogo);
        notify('Logo saved and applied to receipt branding.', 'success');
      } catch (error) {
        setSettings(old => ({ ...old, logoData: previousLogo || null }));
        notify(error.message || 'Could not save the store logo. Your previous logo remains active.', 'warning');
        if (error.status === 401 && onUnauthorized) onUnauthorized();
      } finally { setBusy(false); }
    } catch (error) { notify(error.message || 'Could not prepare the logo image.', 'warning'); }
  };
  const saveSettings = async event => {
    event.preventDefault();
    if (!settings || busy) return;
    setBusy(true);
    try {
      const result = await apiRequest('/settings', { method: 'PATCH', token, body: {
        businessName: settings.businessName,
        currencyCode: settings.currencyCode,
        locale: settings.locale,
        timezone: settings.timezone,
        receiptFooter: settings.receiptFooter || null,
        logoData: settings.logoData || null,
        taxEnabled: false,
      } });
      setSettings(result.settings);
      if (onCurrencyChange) onCurrencyChange(result.settings.currencyCode);
      if (onBusinessNameChange) onBusinessNameChange(result.settings.businessName);
      if (onBusinessLogoChange) onBusinessLogoChange(result.settings.logoData || '');
      notify('Business settings saved to MySQL.', 'success');
    } catch (error) {
      notify(error.message || 'Could not save business settings.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const loadReturnSale = async () => {
    const receiptNo = String(form.receiptNo || '').trim();
    if (!receiptNo) { notify('Enter a receipt number or sale ID first.', 'warning'); return; }
    setBusy(true);
    try {
      const result = await apiRequest('/transactions/' + encodeURIComponent(receiptNo), { token });
      const sale = result.transaction;
      if (String(sale.status).toUpperCase() !== 'COMPLETED') { notify('Only completed sales can be returned.', 'warning'); return; }
      setReturnSale(sale);
      setReturnLines((sale.lines || []).map(line => ({
        saleItemId: line.saleItemId,
        itemName: line.itemName,
        sku: line.sku,
        soldQuantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        quantity: '0',
        restock: true,
        conditionNote: '',
      })));
    } catch (error) {
      notify(error.message || 'Receipt could not be found.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const submitReturn = async event => {
    event.preventDefault();
    if (!returnSale || busy) return;
    const lines = returnLines.filter(line => Number(line.quantity) > 0).map(line => ({
      saleItemId: Number(line.saleItemId),
      quantity: Number(line.quantity),
      restock: Boolean(line.restock),
      conditionNote: line.conditionNote || null,
    }));
    if (!lines.length || lines.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 1)) {
      notify('Enter at least one positive whole quantity to return.', 'warning'); return;
    }
    setBusy(true);
    try {
      const result = await apiRequest('/returns', { method: 'POST', token, body: {
        receiptNo: returnSale.receiptNo,
        reason: form.reason,
        refundMethod: form.refundMethod,
        referenceNo: form.referenceNo || null,
        lines,
      } });
      notify('Return ' + result.return.returnNo + ' recorded · Refund ' + cash(result.return.refundTotal) + '. Manual settlement recorded; no gateway was charged.', 'success');
      setModal('');
      setReturnSale(null);
      setReturnLines([]);
      setQuery('');
      refresh();
    } catch (error) {
      notify(error.message || 'Return could not be completed.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const toggleActive = async (kind, row) => {
    const path = '/' + kind + '/' + row.id;
    await runRequest(path, 'PATCH', { isActive: !Boolean(Number(row.isActive)) }, (Number(row.isActive) ? 'Record deactivated.' : 'Record activated.'));
  };

  const exportData = () => {
    const data = currentRows || [];
    const serialized = data.map(row => Object.fromEntries(Object.entries(row).filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value))));
    const csv = serialized.length ? [Object.keys(serialized[0]).join(','), ...serialized.map(row => Object.values(row).map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(','))].join('\r\n') : '';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ritvan-' + page.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  let title = page;
  let subtitle = '';
  let eyebrow = 'LIVE DATA / WORKSPACE';
  let Icon = ClipboardList;
  let addLabel = 'Add record';
  if (page === 'Items') { title = 'Items'; subtitle = 'Your live catalog, SKU list, prices, and opening stock.'; eyebrow = 'CATALOG & STOCK'; Icon = Package; addLabel = 'Add item'; }
  if (page === 'Categories') { subtitle = 'Organize products with database-backed categories.'; eyebrow = 'CATALOG & STOCK'; Icon = Tag; addLabel = 'Add category'; }
  if (page === 'Suppliers') { subtitle = 'Manage supplier contacts used for purchase orders.'; eyebrow = 'RELATIONSHIPS'; Icon = Truck; addLabel = 'Add supplier'; }
  if (page === 'Customers') { subtitle = 'Manage individual and business customers, lifetime sales, and Khata balances.'; eyebrow = 'RELATIONSHIPS'; Icon = Users; addLabel = 'Add customer'; }
  if (page === 'Purchases') { subtitle = 'Create orders, receive quantities, and update weighted average cost.'; eyebrow = 'CATALOG & STOCK'; Icon = PackagePlus; addLabel = 'New purchase'; }
  if (page === 'Transactions') { subtitle = 'A searchable history of database-backed sales and payments.'; eyebrow = 'WORKSPACE'; Icon = History; addLabel = 'Export CSV'; }
  if (page === 'Inventory') { subtitle = 'Stock adjustments, immutable movement history, and Admin reconciliation.'; eyebrow = 'CATALOG & STOCK'; Icon = Boxes; addLabel = 'Adjust stock'; }
  if (page === 'Staff & Roles') { title = 'Staff & roles'; subtitle = 'Create team accounts, reset passwords, and manage access.'; eyebrow = 'SECURITY & ACCESS'; Icon = ShieldCheck; addLabel = 'Invite staff'; }
  if (page === 'Returns & Refunds') { title = 'Returns & refunds'; subtitle = 'Process eligible sale lines with a traceable manual refund record.'; eyebrow = 'SALES ADJUSTMENTS'; Icon = RotateCcw; addLabel = 'Start return'; }
  if (page === 'Settings') { title = 'Business settings'; subtitle = 'Configure the store profile, currency, locale, and receipt footer.'; eyebrow = 'BUSINESS CONFIGURATION'; Icon = Save; }
  if (page === 'Reports') { title = 'Reports & analytics'; subtitle = 'Sales, returns, inventory valuation, item performance, operating spendings, and cost-aware gross profit.'; eyebrow = 'LIVE BUSINESS INSIGHTS'; Icon = Wallet; }
  if (page === 'Spendings') { title = 'Spendings'; subtitle = 'Record and analyse day-to-day operating expenses for your store.'; eyebrow = 'CASH FLOW / OPERATING COSTS'; Icon = Wallet; addLabel = 'Add spending'; }
  const filteredItems = filtered || items;
  const statA = page === 'Spendings' ? spendings.length : page === 'Items' || page === 'Inventory' ? filteredItems.length
    : page === 'Staff & Roles' ? currentRows.length
    : page === 'Returns & Refunds' ? currentRows.length
    : page === 'Categories' ? currentRows.length
    : page === 'Suppliers' ? currentRows.length
    : page === 'Customers' ? currentRows.length
    : page === 'Purchases' ? currentRows.length : currentRows.length;
  const statB = page === 'Inventory' ? items.filter(row => row.stock <= 0).length
    : page === 'Items' ? items.filter(row => row.stock > 0 && row.stock <= Number(row.reorderThreshold ?? 5)).length
    : page === 'Purchases' ? purchases.filter(row => ['ORDERED', 'PARTIALLY_RECEIVED'].includes(String(row.status).toUpperCase())).length
    : page === 'Transactions' ? transactions.filter(row => String(row.status).toUpperCase() === 'COMPLETED').length
    : page === 'Customers' ? Number(customerSummary?.totalCustomerSpend ?? customers.reduce((sum, row) => sum + Number(row.totalSpent || 0), 0))
    : page === 'Suppliers' ? suppliers.reduce((sum, row) => sum + Number(row.purchaseCount || 0), 0)
    : page === 'Categories' ? categories.reduce((sum, row) => sum + Number(row.itemCount || 0), 0)
    : page === 'Staff & Roles' ? staff.filter(row => Boolean(Number(row.isActive))).length
    : page === 'Returns & Refunds' ? returnsRows.filter(row => String(row.status).toUpperCase() === 'COMPLETED').reduce((sum, row) => sum + Number(row.refundTotal || 0), 0)
    : page === 'Spendings' ? Number(spendingSummary?.totalAmount || 0) : 0;
  const statBLabel = page === 'Spendings' ? 'Total recorded spendings' : page === 'Inventory' ? 'Out of stock' : page === 'Items' ? 'Low stock items' : page === 'Purchases' ? 'Awaiting receipt' : page === 'Transactions' ? 'Completed sales' : page === 'Customers' ? 'Total customer spend' : page === 'Suppliers' ? 'Linked purchase orders' : page === 'Staff & Roles' ? 'Active accounts' : page === 'Returns & Refunds' ? 'Total refunds recorded' : 'Items assigned';
  const liveCreateAllowed = page === 'Customers' ? true : page === 'Staff & Roles' ? role === 'Admin' : canManage;
  const showCreate = !['Transactions', 'Reports', 'Settings', 'Returns & Refunds'].includes(page) && liveCreateAllowed;

  const reportMoney = value => (reportData?.currency?.currencySymbol || '₹') + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const productAnalysisRows = (reportData?.productSales || [])
    .filter(row => [row.name, row.sku].some(value => String(value || '').toLowerCase().includes(productQuery.trim().toLowerCase())))
    .sort((a, b) => productSort === 'name'
      ? String(a.name || '').localeCompare(String(b.name || ''))
      : Number(b[productSort] || 0) - Number(a[productSort] || 0));

  const exportProductAnalysisCsv = () => {
    if (!reportData) return;
    const rows = reportData.productSales || [];
    const headers = ['itemId','name','sku','unitsSold','unitsReturned','grossSales','discountAmount','refundAmount','netSales'];
    const csv = [headers.join(','), ...rows.map(row => headers.map(key => {
      const value = row[key] ?? '';
      return '"' + String(value).replace(/"/g, '""') + '"';
    }).join(','))].join('\\r\\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ritvan-item-sales-' + reportFrom + '-to-' + reportTo + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportSpendingsCsv = () => {
    const normalizedQuery = spendingQuery.trim().toLowerCase();
    const rows = spendings.filter(row => !normalizedQuery || [
      row.description, row.category, row.paidTo, row.referenceNo, row.paymentMode, row.status,
    ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)));
    const headers = ['id','spendingDate','category','description','amount','paymentMode','paidTo','referenceNo','notes','status','voidReason'];
    const csv = [headers.join(','), ...rows.map(row => headers.map(key => {
      const value = row[key] ?? '';
      return '"' + String(value).replace(/"/g, '""') + '"';
    }).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ritvan-spendings-' + spendingFrom + '-to-' + spendingTo + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportReportCsv = () => {
    if (!reportData) return;
    const rows = reportData.daily || [];
    const csv = ['date,sales,refunds,netRevenue', ...rows.map(row => [row.day, row.sales, row.refunds, row.netRevenue].join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ritvan-sales-report-' + reportFrom + '-to-' + reportTo + '.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  const moduleActions = <>
    {!['Settings', 'Returns & Refunds', 'Reports'].includes(page) && <LiveButton icon={Download} onClick={page === 'Spendings' ? exportSpendingsCsv : exportData}>Export CSV</LiveButton>}
    {page === 'Reports' && <LiveButton icon={Download} onClick={exportReportCsv} disabled={!reportData}>Export CSV</LiveButton>}
    {page === 'Reports' && <LiveButton icon={Download} onClick={exportProductAnalysisCsv} disabled={!reportData}>Export item analysis</LiveButton>}
    {page === 'Returns & Refunds' && <LiveButton variant="primary" icon={RotateCcw} onClick={() => { setForm({ receiptNo: '', reason: '', refundMethod: 'Cash', referenceNo: '' }); setReturnSale(null); setReturnLines([]); setModal('return-create'); }}>Start return</LiveButton>}
    {showCreate && <LiveButton variant="primary" icon={page === 'Purchases' ? PackagePlus : page === 'Inventory' ? Boxes : page === 'Staff & Roles' ? ShieldCheck : Plus} onClick={() => {
      if (page === 'Inventory') { setForm({ itemId: items[0]?.apiId || '', delta: '1', type: 'ADJUSTMENT', reason: '' }); setModal('adjust'); }
      else if (page === 'Spendings') { const today = localDateInput(new Date()); setForm({ spendingDate: today, category: 'Utilities', description: '', amount: '', paymentMode: 'CASH', paidTo: '', referenceNo: '', notes: '' }); setModal('spending-create'); }
      else openCreate();
    }}>{addLabel}</LiveButton>}
  </>;

  return <>
    <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="title-actions">{moduleActions}</div></div>
    {pageError && <div className="live-error"><AlertTriangle size={17}/><span>{pageError}</span><LiveButton icon={RefreshCw} onClick={refresh}>Retry</LiveButton></div>}
    {!['Settings', 'Reports'].includes(page) && <div className={'live-metrics' + (page === 'Customers' ? ' live-metrics-customers' : '')}>
      <div className="live-metric-card"><span className="live-metric-icon"><Icon size={18}/></span><div><small>{page === 'Transactions' ? 'Matching transactions' : page === 'Purchases' ? 'Purchase orders' : page === 'Inventory' ? 'Active SKUs' : 'Records'}</small><strong>{loading ? '—' : statA}</strong></div></div>
      <div className="live-metric-card"><span className="live-metric-icon metric-icon-amber"><AlertTriangle size={18}/></span><div><small>{statBLabel}</small><strong>{loading ? '—' : ['Customers', 'Returns & Refunds', 'Spendings'].includes(page) ? cash(statB) : statB}</strong></div></div>
      {page === 'Customers' && <div className="live-metric-card"><span className="live-metric-icon metric-icon-blue"><Store size={18}/></span><div><small>Business sales</small><strong>{loading ? '—' : cash(customerSummary?.businessSales || 0)}</strong></div></div>}
      <div className="live-metric-card"><span className="live-metric-icon metric-icon-green"><CircleCheck size={18}/></span><div><small>Data source</small><strong className="live-source-label">MySQL via API</strong></div></div>
    </div>}

    {page === 'Spendings' && <section className="spending-page-workspace">
      <section className="panel spending-filter-panel">
        <div className="spending-filter-copy"><div className="eyebrow">SPENDING PERIOD</div><b>Track where your money goes</b><small>Only recorded entries count toward totals. Voided entries remain visible for audit history.</small></div>
        <div className="toolbar-controls spending-period-controls">
          <Field label="From"><input className="form-input report-date" type="date" max={spendingTo} value={spendingFrom} onChange={event=>setSpendingFrom(event.target.value)}/></Field>
          <Field label="To"><input className="form-input report-date" type="date" min={spendingFrom} value={spendingTo} onChange={event=>setSpendingTo(event.target.value)}/></Field>
          <LiveButton icon={RefreshCw} onClick={refresh}>Refresh</LiveButton>
        </div>
      </section>

      <div className="spending-summary-grid">
        <div className="spending-summary-card spending-summary-primary"><span className="spending-summary-icon"><Wallet size={18}/></span><small>Total operating spendings</small><strong>{loading ? '—' : cash(spendingSummary?.totalAmount || 0)}</strong><span>Recorded entries · selected period</span></div>
        <div className="spending-summary-card"><span className="spending-summary-icon spending-summary-blue"><ReceiptText size={18}/></span><small>Recorded entries</small><strong>{loading ? '—' : Number(spendingSummary?.spendingCount || 0).toLocaleString('en-IN')}</strong><span>Voided records excluded</span></div>
        <div className="spending-summary-card"><span className="spending-summary-icon spending-summary-green"><CalendarDays size={18}/></span><small>Today's spendings</small><strong>{loading ? '—' : cash(spendingSummary?.todayAmount || 0)}</strong><span>Across all recorded categories</span></div>
        <div className="spending-summary-card"><span className="spending-summary-icon spending-summary-amber"><CalendarDays size={18}/></span><small>This month</small><strong>{loading ? '—' : cash(spendingSummary?.monthAmount || 0)}</strong><span>Month-to-date operating cost</span></div>
      </div>

      <div className="spending-breakdown-grid">
        <section className="panel spending-breakdown-panel">
          <div className="panel-head"><div><h2>Spending by category</h2><p>Where operating money is going in this date range.</p></div><Wallet size={18} color="var(--violet)"/></div>
          {loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Calculating category totals…</span></div>
          : spendingSummary?.categories?.length ? <div className="spending-category-list">{spendingSummary.categories.map(row=>{
            const max = Math.max(1,...spendingSummary.categories.map(item=>Number(item.amount||0)));
            return <div className="spending-category-row" key={row.category}><div className="spending-category-heading"><b>{row.category}</b><span>{cash(row.amount)} <small>{row.recordCount} record{Number(row.recordCount)===1?'':'s'}</small></span></div><div className="spending-category-track"><i style={{width:(Number(row.amount||0)/max*100)+'%'}}/></div></div>;
          })}</div> : <BlankState title="No category activity" text="Recorded spendings will be grouped here automatically."/>}
        </section>
        <section className="panel spending-breakdown-panel">
          <div className="panel-head"><div><h2>Payment methods</h2><p>How operating spendings were paid.</p></div><CreditCard size={18} color="var(--violet)"/></div>
          {loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Calculating payment totals…</span></div>
          : spendingSummary?.paymentModes?.length ? <div className="spending-payment-list">{spendingSummary.paymentModes.map(row=><div className="spending-payment-row" key={row.paymentMode}><div><span className="spending-payment-dot"/><b>{prettyStatus(row.paymentMode)}</b><small>{row.recordCount} payment{Number(row.recordCount)===1?'':'s'}</small></div><strong>{cash(row.amount)}</strong></div>)}</div>
          : <BlankState title="No payments recorded" text="Payment mode totals will appear when you add spendings."/>}
        </section>
      </div>

      <section className="panel live-section spending-records-panel">
        <div className="panel-head"><div><h2>Spending ledger</h2><p>Search, review and correct operating expense entries. Voiding keeps the original record for audit.</p></div><div className="toolbar-controls"><div className="search-box compact"><Search size={16}/><input placeholder="Search reason, category, payee…" value={spendingQuery} onChange={event=>setSpendingQuery(event.target.value)}/><button className="icon-button small" onClick={()=>setSpendingQuery('')} title="Clear search"><X size={14}/></button></div></div></div>
        {pageError && <div className="live-error"><AlertTriangle size={16}/><span>{pageError}</span><LiveButton icon={RefreshCw} onClick={refresh}>Retry</LiveButton></div>}
        {loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Loading spending ledger…</span></div>
        : spendings.filter(row=>[row.description,row.category,row.paidTo,row.referenceNo,row.paymentMode,row.status].some(value=>String(value||'').toLowerCase().includes(spendingQuery.trim().toLowerCase()))).length ? <div className="table-wrap"><table className="spending-table"><thead><tr><th>DATE</th><th>REASON / PAYEE</th><th>CATEGORY</th><th>PAYMENT</th><th>AMOUNT</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
          {spendings.filter(row=>[row.description,row.category,row.paidTo,row.referenceNo,row.paymentMode,row.status].some(value=>String(value||'').toLowerCase().includes(spendingQuery.trim().toLowerCase()))).map(row=><tr key={row.id}>
            <td><b>{asDate(row.spendingDate)}</b><small className="live-cell-sub">#{row.id}</small></td>
            <td><b>{row.description}</b><small className="live-cell-sub">{row.paidTo ? 'Paid to '+row.paidTo : row.notes || row.referenceNo || 'No extra details'}</small></td>
            <td><span className="spending-category-chip">{row.category}</span></td>
            <td>{prettyStatus(row.paymentMode)}</td>
            <td><b className="spending-amount">{cash(row.amount)}</b></td>
            <td><StatusPill value={row.status}/></td>
            <td><div className="table-action-group">{row.status==='RECORDED' && canManage && <>
              <button className="icon-button small" title="Edit spending" aria-label="Edit spending" onClick={()=>{setForm({id:row.id,spendingDate:row.spendingDate,category:row.category,description:row.description,amount:String(row.amount),paymentMode:row.paymentMode,paidTo:row.paidTo||'',referenceNo:row.referenceNo||'',notes:row.notes||''});setModal('spending-edit');}}><Pencil size={15}/></button>
              <button className="icon-button small spending-void-button" title="Void spending" aria-label="Void spending" onClick={()=>{setForm({id:row.id,description:row.description,voidReason:''});setModal('spending-void');}}><X size={15}/></button>
            </>}</div></td>
          </tr>)}
        </tbody></table></div> : <BlankState title={spendingQuery ? 'No matching spendings' : 'No spendings in this period'} text={spendingQuery ? 'Try another keyword or clear your search.' : 'Record rent, bills, transport, repairs, packaging or other operating costs to start your spending ledger.'} onAdd={canManage ? ()=>{const today=localDateInput(new Date());setForm({spendingDate:today,category:'Utilities',description:'',amount:'',paymentMode:'CASH',paidTo:'',referenceNo:'',notes:''});setModal('spending-create');} : undefined} addLabel="Add first spending"/>}
        <div className="table-footer"><span>{loading ? 'Loading…' : spendings.length+' record'+(spendings.length===1?'':'s')+' in selected period'}</span><span className="muted">Recorded totals exclude voided entries</span></div>
      </section>
    </section>}

    {page === 'Staff & Roles' && <section className="panel live-section">
      <div className="panel-head"><div><h2>Team accounts</h2><p>Only active Admins can create staff, reset passwords, and adjust roles.</p></div><StatusPill value={staff.filter(row=>Boolean(Number(row.isActive))).length ? 'ACTIVE' : 'INACTIVE'}/></div>
      {loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Loading staff accounts…</span></div>
      : currentRows.length === 0 ? <BlankState title="No staff accounts found" text="Create a team account with the smallest role it needs." onAdd={showCreate ? openCreate : undefined} addLabel="Invite staff"/>
      : <div className="table-wrap"><table><thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>STATUS</th><th>LAST LOGIN</th><th>CREATED</th><th>ACTIONS</th></tr></thead><tbody>{currentRows.map(row=><tr key={row.id}>
        <td><b>{row.name}</b><small className="live-cell-sub">{row.email}</small></td>
        <td>{role === 'Admin' ? <select className="staff-role-select" value={row.role} onChange={e=>changeStaffRole(row,e.target.value)}><option>Admin</option><option>Manager</option><option>Cashier</option></select> : <StatusPill value={row.role}/>}</td>
        <td><StatusPill value={Number(row.isActive) ? 'ACTIVE' : 'INACTIVE'}/></td>
        <td>{row.lastLoginAt ? asDate(row.lastLoginAt) : 'Never'}</td><td>{asDate(row.createdAt)}</td>
        <td><div className="table-action-group">{row.role !== 'Admin' && <LiveButton onClick={()=>openStaffPermissions(row)} icon={ShieldCheck}>Permissions</LiveButton>}<LiveButton onClick={()=>{setForm({staffId:row.id,staffName:row.name,password:''});setModal('staff-password');}} icon={ShieldCheck}>Reset password</LiveButton><LiveButton onClick={()=>toggleActive('staff',row)}>{Number(row.isActive) ? 'Deactivate' : 'Activate'}</LiveButton></div></td>
      </tr>)}</tbody></table></div>}
      <div className="table-footer"><span>{staff.length} account(s)</span><span className="muted">Passwords are hashed · Changes are audited</span></div>
    </section>}

    {page === 'Returns & Refunds' && <section className="panel live-section">
      <div className="panel-head"><div><h2>Return history</h2><p>Partial quantities are validated against the original sale and previous returns.</p></div><div className="toolbar-controls"><div className="search-box compact"><Search size={16}/><input placeholder="Search return or receipt…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon-button small" onClick={refresh} title="Refresh"><RefreshCw size={14}/></button></div></div></div>
      {loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Loading returns…</span></div>
      : currentRows.length === 0 ? <BlankState title="No returns recorded" text="Start a return from a completed receipt. Refund method and reason are retained in the audit trail." onAdd={showCreate ? ()=>{setForm({receiptNo:'',reason:'',refundMethod:'Cash',referenceNo:''});setReturnSale(null);setReturnLines([]);setModal('return-create');} : undefined} addLabel="Start return"/>
      : <div className="table-wrap"><table><thead><tr>{columnVisible('Returns & Refunds','returnNo') && <th>RETURN</th>}{columnVisible('Returns & Refunds','receiptNo') && <th>ORIGINAL RECEIPT</th>}{columnVisible('Returns & Refunds','customer') && <th>CUSTOMER</th>}{columnVisible('Returns & Refunds','date') && <th>DATE</th>}{columnVisible('Returns & Refunds','refund') && <th>REFUND</th>}{columnVisible('Returns & Refunds','settlement') && <th>SETTLEMENT</th>}{columnVisible('Returns & Refunds','status') && <th>STATUS</th>}</tr></thead><tbody>{currentRows.map(row=><tr key={row.id}>
        {columnVisible('Returns & Refunds','returnNo') && <td><b>{row.returnNo}</b><small className="live-cell-sub">{row.processedBy || 'Staff'}</small></td>}{columnVisible('Returns & Refunds','receiptNo') && <td>{row.receiptNo}</td>}{columnVisible('Returns & Refunds','customer') && <td>{row.customer}</td>}{columnVisible('Returns & Refunds','date') && <td>{asDate(row.completedAt || row.createdAt)}</td>}{columnVisible('Returns & Refunds','refund') && <td><b>{cash(row.refundTotal)}</b></td>}{columnVisible('Returns & Refunds','settlement') && <td>{prettyStatus(row.refundMethod || 'MANUAL')}</td>}{columnVisible('Returns & Refunds','status') && <td><StatusPill value={row.status}/></td>}
      </tr>)}</tbody></table></div>}
      <div className="warning-callout"><CircleHelp size={16}/><span>Settlement is recorded manually; Ritvan does not send money through a payment gateway. Returned lines marked as restocked increase quantity and update weighted-average cost using the original sale cost snapshot.</span></div>
    </section>}

    {page === 'Settings' && <section className="panel live-section settings-live-panel">
      <div className="panel-head"><div><h2>Business profile</h2><p>Saved to the single-store business settings record in MySQL.</p></div><StatusPill value={role === 'Admin' ? 'ADMIN EDIT' : 'READ ONLY'}/></div>
      {loading || !settings ? <div className="live-loading"><span className="login-status-pulse"/><span>Loading persisted settings…</span></div> :
      <form className="settings-live-form" onSubmit={saveSettings}>
        <div className="live-form-grid">
          <Field label="Business name *"><input className="form-input" required maxLength={140} value={settings.businessName || ''} onChange={e=>setSettings(old=>({...old,businessName:e.target.value}))} disabled={role!=='Admin'}/></Field>
          <Field label="Store logo (receipt branding)">
            <div className="business-logo-upload">
              <div className="business-logo-preview">{settings.logoData ? <img src={settings.logoData} alt="Store logo preview"/> : <Store size={24}/>}</div>
              <div className="business-logo-controls">
                <input className="form-input photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBusinessLogo} disabled={role!=='Admin' || busy}/>
                <small>Used on the WhatsApp receipt image and receipt preview. Square or landscape logos work best; Ritvan compresses the image before saving.</small>
                {settings.logoData && role === 'Admin' && <button type="button" className="text-button" onClick={()=>setSettings(old=>({...old,logoData:null}))}>Remove logo</button>}
              </div>
            </div>
          </Field>
          <Field label="Base currency"><select className="form-input" value={settings.currencyCode || 'INR'} onChange={e=>setSettings(old=>({...old,currencyCode:e.target.value}))} disabled={role!=='Admin'}><option value="INR">INR · Indian Rupee</option><option value="USD">USD · US Dollar</option><option value="GBP">GBP · British Pound</option><option value="EUR">EUR · Euro</option></select><small>Changing currency relabels values; it does not convert past amounts.</small></Field>
          <Field label="Number format locale"><select className="form-input" value={settings.locale || 'en-IN'} onChange={e=>setSettings(old=>({...old,locale:e.target.value}))} disabled={role!=='Admin'}><option value="en-IN">English (India)</option><option value="en-US">English (United States)</option><option value="en-GB">English (United Kingdom)</option></select></Field>
          <Field label="Time zone"><input className="form-input" maxLength={64} value={settings.timezone || 'Asia/Kolkata'} onChange={e=>setSettings(old=>({...old,timezone:e.target.value}))} disabled={role!=='Admin'} placeholder="Asia/Kolkata"/></Field>
          <Field label="Receipt footer"><textarea className="form-input textarea" maxLength={255} value={settings.receiptFooter || ''} onChange={e=>setSettings(old=>({...old,receiptFooter:e.target.value}))} disabled={role!=='Admin'} placeholder="Thank you for shopping with us"/></Field>
          <Field label="Inventory valuation"><input className="form-input" value="Weighted average cost (WAC)" disabled readOnly/><small>This method is fixed for v1.</small></Field>
        </div>
        <div className="settings-tax-row"><div><b>Tax calculation</b><p>Tax is disabled by default. Enabling it is blocked until a tax-rate and calculation policy are approved and implemented.</p></div><StatusPill value={settings.taxEnabled ? 'ENABLED' : 'DISABLED'}/></div>
        {role === 'Admin' && <div className="settings-live-actions"><span className="muted">Last saved: {asDate(settings.updatedAt)}</span><LiveButton type="submit" variant="primary" icon={Save} disabled={busy}>{busy?'Saving…':'Save settings'}</LiveButton></div>}
      </form>}
    </section>}

    {page === 'Reports' && <section className="live-report-workspace">
      <section className="panel live-section">
        <div className="panel-head"><div><h2>Reporting period</h2><p>Figures are calculated from saved sales, return, item-cost, and payment records.</p></div><div className="toolbar-controls"><Field label="From"><input className="form-input report-date" type="date" value={reportFrom} max={reportTo} onChange={e=>setReportFrom(e.target.value)}/></Field><Field label="To"><input className="form-input report-date" type="date" value={reportTo} min={reportFrom} onChange={e=>setReportTo(e.target.value)}/></Field></div></div>
        {pageError && <div className="live-error"><AlertTriangle size={16}/><span>{pageError}</span><LiveButton icon={RefreshCw} onClick={()=>setRefreshKey(value=>value+1)}>Refresh</LiveButton></div>}
        {reportLoading || !reportData ? <div className="live-loading"><span className="login-status-pulse"/><span>Calculating database-backed metrics…</span></div> : <>
          <div className="live-report-metrics">
            <div><small>Net revenue</small><strong>{reportMoney(reportData.summary.netRevenue)}</strong><span>Sales less recorded refunds</span></div>
            <div><small>Completed sales</small><strong>{reportData.summary.completedSales}</strong><span>{reportData.summary.completedReturns} completed returns</span></div>
            <div><small>Gross profit</small><strong>{reportData.summary.grossProfitAvailable ? reportMoney(reportData.summary.grossProfit) : '—'}</strong><span>{reportData.summary.grossProfitAvailable ? 'Uses saved cost snapshots' : 'Withheld: provisional costs exist'}</span></div>
            <div><small>Inventory cost value</small><strong>{reportMoney(reportData.summary.inventoryCostValue)}</strong><span>{reportData.summary.activeItems} active items</span></div>
            {reportData.spendingTrackingAvailable && <div><small>Operating spendings</small><strong>{reportMoney(reportData.summary.operatingSpendings)}</strong><span>{Number(reportData.summary.operatingSpendingCount || 0)} recorded entries · selected period</span></div>}
          </div>
          {reportData.spendingTrackingAvailable === false && <div className="info-callout"><AlertTriangle size={16}/><span>Operating spendings are not installed in this database yet. Back up the database, then run the updated database/ritvan-pos-all-in-one.sql to enable spending reports.</span></div>}
          <div className="live-report-chart-grid">
            <div className="panel live-report-chart-panel"><div className="panel-head"><div><h2>Daily sales & refunds</h2><p>Sales and refunds by completion date · net revenue = sales − refunds · {reportData.period.from} to {reportData.period.to}</p></div></div>
              <div className="live-report-chart-legend"><span><i className="live-report-legend-sales"/>Sales</span><span><i className="live-report-legend-refunds"/>Refunds</span><small>Net revenue is the sales total less refunds.</small></div>
              <div className="live-report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={reportData.daily} margin={{top:10,right:10,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)"/><XAxis dataKey="day" tickFormatter={shortDay} axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:10}} tickFormatter={value=>Number(value).toLocaleString('en-IN')}/><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--line)',borderRadius:10,color:'var(--text)'}} labelFormatter={shortDay} formatter={(value,name)=>[reportMoney(value),String(name).toLowerCase().includes('refund')?'Refunds':String(name).toLowerCase().includes('sale')?'Sales':String(name)]}/><Bar dataKey="sales" name="Sales" fill="#7968e8" radius={[4,4,0,0]}/><Bar dataKey="refunds" name="Refunds" fill="#e5a2aa" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
            </div>
            <div className="panel live-report-chart-panel"><div className="panel-head"><div><h2>Payment breakdown</h2><p>Payment method totals from completed sales in the selected period.</p></div></div>
              {reportData.payments.length ? <div className="live-payment-breakdown">{reportData.payments.map(row=><div key={row.method}><div><b>{prettyStatus(row.method)}</b><small>{row.paymentCount} payment(s)</small></div><strong>{reportMoney(row.amount)}</strong><div className="live-payment-track"><span style={{width:(Math.max(...reportData.payments.map(x=>Number(x.amount)),1) ? Number(row.amount)/Math.max(...reportData.payments.map(x=>Number(x.amount)),1)*100 : 0)+'%'}}/></div></div>)}</div> : <BlankState title="No payments in this period" text="Completed sales will appear here."/>}
            </div>
          </div>
          <div className="live-report-inventory-grid">
            <div className="live-report-mini"><small>Low-stock items</small><b>{reportData.summary.lowStockCount}</b></div>
            <div className="live-report-mini"><small>Out of stock</small><b>{reportData.summary.outOfStockCount}</b></div>
            <div className="live-report-mini"><small>Negative stock</small><b>{reportData.summary.negativeStockCount}</b></div>
            <div className="live-report-mini"><small>Open reconciliations</small><b>{reportData.summary.openReconciliations}</b></div>
          </div>
          <section className="panel live-section product-analysis-section">
            <div className="panel-head"><div><h2>Product sales analysis</h2><p>Item-level performance for sales completed in this period. Discounts are allocated proportionally across sale lines; refunds use the original returned line records.</p></div><TrendingUp size={18} color="var(--violet)"/></div>
            <div className="product-analysis-summary">
              <div><small>Units sold</small><b>{Number(reportData.productSalesSummary?.unitsSold || 0).toLocaleString('en-IN')}</b></div>
              <div><small>Units returned</small><b>{Number(reportData.productSalesSummary?.unitsReturned || 0).toLocaleString('en-IN')}</b></div>
              <div><small>Gross item sales</small><b>{reportMoney(reportData.productSalesSummary?.grossSales)}</b></div>
              <div><small>Allocated discounts</small><b>{reportMoney(reportData.productSalesSummary?.discountAmount)}</b></div>
              <div><small>Product refunds</small><b>{reportMoney(reportData.productSalesSummary?.refundAmount)}</b></div>
              <div><small>Net item sales</small><b>{reportMoney(reportData.productSalesSummary?.netSales)}</b></div>
            </div>
            <div className="panel-head product-analysis-toolbar">
              <div className="search-box compact"><Search size={15}/><input placeholder="Search item name or SKU…" value={productQuery} onChange={event=>setProductQuery(event.target.value)}/><button className="icon-button small" onClick={()=>setProductQuery('')} title="Clear search"><X size={14}/></button></div>
              <div className="toolbar-controls"><Field label="Sort by"><select className="select-control" value={productSort} onChange={event=>setProductSort(event.target.value)}><option value="netSales">Net sales</option><option value="unitsSold">Units sold</option><option value="grossSales">Gross sales</option><option value="refundAmount">Refunds</option><option value="name">Name</option></select></Field></div>
            </div>
            {productAnalysisRows.length ? <div className="table-wrap product-analysis-table-wrap"><table className="product-analysis-table"><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th><th>RETURNED</th><th>GROSS SALES</th><th>DISCOUNT</th><th>REFUNDS</th><th>NET ITEM SALES</th></tr></thead><tbody>{productAnalysisRows.map(row=><tr key={row.itemId}><td><b>{row.name}</b><small className="live-cell-sub">{row.sku || 'No SKU'}</small></td><td>{Number(row.unitsSold || 0).toLocaleString('en-IN')}</td><td>{Number(row.unitsReturned || 0).toLocaleString('en-IN')}</td><td>{reportMoney(row.grossSales)}</td><td>{reportMoney(row.discountAmount)}</td><td>{reportMoney(row.refundAmount)}</td><td><b className="product-net-sales">{reportMoney(row.netSales)}</b></td></tr>)}</tbody></table></div>
            : <BlankState title={productQuery ? 'No matching products' : 'No item sales in this period'} text={productQuery ? 'Try another item name or SKU.' : 'Completed sales containing items will appear here.'}/>}
            <div className="table-footer"><span>{productAnalysisRows.length} of {(reportData.productSales || []).length} product line summaries</span><span className="muted">Sale-level discounts are allocated by line value</span></div>
          </section>
          <div className="info-callout"><CircleHelp size={16}/><span>{reportData.notes.join(' ')} Sales and refunds are counted on their completion dates. This report does not calculate net profit.</span></div>
          {reportData.recentTransactions.length > 0 && <section className="panel live-section"><div className="panel-head"><div><h2>Recent sales</h2><p>Latest saved transactions in the database.</p></div><LiveButton onClick={()=>onNavigate('Transactions')}>View history</LiveButton></div><div className="table-wrap"><table><thead><tr><th>RECEIPT</th><th>CUSTOMER</th><th>CASHIER</th><th>DATE</th><th>PAYMENT</th><th>TOTAL</th></tr></thead><tbody>{reportData.recentTransactions.map(row=><tr key={row.id}><td><b>{row.receiptNo}</b></td><td>{row.customer}</td><td>{row.cashier}</td><td>{asDate(row.completedAt)}</td><td>{prettyStatus(row.paymentMethod)}</td><td>{reportMoney(row.totalAmount)}</td></tr>)}</tbody></table></div></section>}
        </>}
      </section>
    </section>}

    {page === 'Inventory' && <section className="panel live-section"><div className="panel-head"><div><h2>Negative-stock reconciliation</h2><p>Admin overrides remain visible until physical quantities are reconciled.</p></div><StatusPill value={reconciliations.length ? 'OPEN' : 'RESOLVED'}/></div>
      {reconciliations.length ? <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>RECEIPT</th><th>SHORTAGE</th><th>REASON</th><th>CREATED</th><th></th></tr></thead><tbody>{reconciliations.map(row=><tr key={row.id}><td><b>{row.itemName}</b><small className="live-cell-sub">{row.sku}</small></td><td>{row.receiptNo}</td><td><b>{row.shortageQty} units</b></td><td>{row.reason}</td><td>{asDate(row.createdAt)}</td><td>{role === 'Admin' && <LiveButton variant="primary" onClick={()=>{setForm({itemId:row.itemId,itemName:row.itemName,countedQty:String(Math.max(0, Number(items.find(i=>i.apiId === Number(row.itemId))?.stock ?? 0))),reason:''});setModal('resolve');}}>Reconcile</LiveButton>}</td></tr>)}</tbody></table></div>
      : <BlankState title="No open reconciliations" text="Negative-stock overrides will appear here for physical-count review."/>}
    </section>}

    {page === 'Inventory' && <section className="panel live-section"><div className="panel-head"><div><h2>Stock on hand</h2><p>Adjustments are recorded in the stock movement ledger.</p></div><div className="toolbar-controls"><div className="search-box compact"><Search size={16}/><input placeholder="Search item or SKU…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div></div>
      <div className="table-wrap"><table><thead><tr>{columnVisible('Inventory','item') && <th>ITEM</th>}{columnVisible('Inventory','sku') && <th>SKU</th>}{columnVisible('Inventory','onHand') && <th>ON HAND</th>}{columnVisible('Inventory','avgCost') && <th>AVERAGE COST</th>}{columnVisible('Inventory','stockValue') && <th>STOCK VALUE</th>}{columnVisible('Inventory','status') && <th>STATUS</th>}<th></th></tr></thead><tbody>{(filtered || items).map(row=><tr key={row.id}>{columnVisible('Inventory','item') && <td><b>{row.name}</b><small className="live-cell-sub">{row.category}</small></td>}{columnVisible('Inventory','sku') && <td>{row.sku}</td>}{columnVisible('Inventory','onHand') && <td><b>{row.stock}</b></td>}{columnVisible('Inventory','avgCost') && <td>{cash(row.cost)}</td>}{columnVisible('Inventory','stockValue') && <td>{cash(row.stock * row.cost)}</td>}{columnVisible('Inventory','status') && <td><StatusPill value={row.stock <= 0 ? 'OUT_OF_STOCK' : row.stock <= Number(row.reorderThreshold ?? 5) ? 'LOW_STOCK' : 'IN_STOCK'}/></td>}<td>{canManage && row.stock >= 0 && <LiveButton onClick={()=>{setForm({itemId:row.apiId,delta:'1',type:'ADJUSTMENT',reason:''});setModal('adjust');}}>Adjust</LiveButton>}</td></tr>)}</tbody></table></div>
    </section>}

    {page === 'Inventory' && <section className="panel live-section"><div className="panel-head"><div><h2>Recent stock movements</h2><p>Append-only history of quantity changes.</p></div></div>
      {movements.length ? <div className="table-wrap"><table><thead><tr>{columnVisible('Inventory','date') && <th>DATE</th>}{columnVisible('Inventory','item') && <th>ITEM</th>}{columnVisible('Inventory','movement') && <th>MOVEMENT</th>}{columnVisible('Inventory','quantity') && <th>QUANTITY</th>}{columnVisible('Inventory','costAtTime') && <th>COST AT TIME</th>}{columnVisible('Inventory','reason') && <th>REASON</th>}{columnVisible('Inventory','user') && <th>USER</th>}</tr></thead><tbody>{movements.map(row=><tr key={row.id}>{columnVisible('Inventory','date') && <td>{asDate(row.createdAt)}</td>}{columnVisible('Inventory','item') && <td><b>{row.itemName}</b><small className="live-cell-sub">{row.sku}</small></td>}{columnVisible('Inventory','movement') && <td>{prettyStatus(row.movementType)}</td>}{columnVisible('Inventory','quantity') && <td className={Number(row.quantityDelta ?? row.qtyDelta) < 0 ? 'live-negative' : 'live-positive'}>{Number(row.quantityDelta ?? row.qtyDelta) > 0 ? '+' : ''}{row.quantityDelta ?? row.qtyDelta}</td>}{columnVisible('Inventory','costAtTime') && <td>{cash(row.unitCostAtTime)}</td>}{columnVisible('Inventory','reason') && <td>{row.reason || '—'}</td>}{columnVisible('Inventory','user') && <td>{row.userName || row.user || '—'}</td>}</tr>)}</tbody></table></div> : <BlankState title="No stock movements yet" text="Opening stock, receiving, sales and adjustments will be listed here."/>}
    </section>}

    {!['Inventory', 'Settings', 'Reports', 'Returns & Refunds', 'Staff & Roles', 'Spendings'].includes(page) && <section className="panel live-section">
      <div className="panel-head"><div><h2>{page === 'Transactions' ? 'Sales history' : page + ' directory'}</h2><p>{page === 'Purchases' ? 'Purchase orders do not affect stock until received.' : page === 'Items' ? 'Live prices, cost snapshots and stock levels from the database.' : page === 'Transactions' ? 'Open a receipt to review saved line items and payments.' : 'Changes are validated and saved by the API.'}</p></div><div className="toolbar-controls"><div className="search-box compact"><Search size={16}/><input placeholder={'Search ' + page.toLowerCase() + '…'} value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon-button small" onClick={refresh} title="Refresh"><RefreshCw size={14}/></button></div></div></div>
      {loading ? <div className="live-loading"><span className="login-status-pulse"/><span>Loading live records…</span></div>
      : currentRows.length === 0 ? <BlankState title={'No ' + page.toLowerCase() + ' found'} text={query ? 'Try another search term.' : 'Create your first record to start using this workflow.'} onAdd={showCreate ? openCreate : undefined} addLabel={addLabel}/>
      : <div className="table-wrap"><table><thead><tr>
        {page === 'Items' && <>{columnVisible('Items','name') && <th>ITEM</th>}{columnVisible('Items','sku') && <th>SKU</th>}{columnVisible('Items','category') && <th>CATEGORY</th>}{columnVisible('Items','sellingPrice') && <th>SELLING PRICE</th>}{columnVisible('Items','avgCost') && <th>AVG COST</th>}{columnVisible('Items','onHand') && <th>ON HAND</th>}{columnVisible('Items','status') && <th>STATUS</th>}<th></th></>}
        {page === 'Categories' && <>{columnVisible('Categories','category') && <th>CATEGORY</th>}{columnVisible('Categories','itemCount') && <th>ITEM COUNT</th>}{columnVisible('Categories','description') && <th>DESCRIPTION</th>}{columnVisible('Categories','status') && <th>STATUS</th>}<th></th></>}
        {page === 'Suppliers' && <>{columnVisible('Suppliers','supplier') && <th>SUPPLIER</th>}{columnVisible('Suppliers','contact') && <th>CONTACT</th>}{columnVisible('Suppliers','emailPhone') && <th>EMAIL / PHONE</th>}{columnVisible('Suppliers','purchaseOrders') && <th>PURCHASE ORDERS</th>}{columnVisible('Suppliers','status') && <th>STATUS</th>}<th></th></>}
        {page === 'Customers' && <>{columnVisible('Customers','customer') && <th>CUSTOMER</th>}{columnVisible('Customers','contact') && <th>CONTACT</th>}{columnVisible('Customers','orders') && <th>ORDERS</th>}{columnVisible('Customers','totalSpent') && <th>TOTAL SPENT</th>}{columnVisible('Customers','outstandingBalance') && <th>KHATA OWED</th>}{columnVisible('Customers','lastPurchase') && <th>LAST PURCHASE</th>}<th></th></>}
        {page === 'Purchases' && <>{columnVisible('Purchases','purchaseNo') && <th>PURCHASE</th>}{columnVisible('Purchases','supplier') && <th>SUPPLIER</th>}{columnVisible('Purchases','purchaseDate') && <th>ORDER DATE</th>}{columnVisible('Purchases','lineCount') && <th>LINES</th>}{columnVisible('Purchases','totalAmount') && <th>TOTAL</th>}{columnVisible('Purchases','status') && <th>STATUS</th>}<th></th></>}
        {page === 'Transactions' && <>{columnVisible('Transactions','receiptNo') && <th>RECEIPT</th>}{columnVisible('Transactions','customer') && <th>CUSTOMER</th>}{columnVisible('Transactions','cashier') && <th>CASHIER</th>}{columnVisible('Transactions','date') && <th>DATE</th>}{columnVisible('Transactions','payment') && <th>PAYMENT</th>}{columnVisible('Transactions','total') && <th>TOTAL</th>}{columnVisible('Transactions','status') && <th>STATUS</th>}<th></th></>}
      </tr></thead><tbody>
        {page === 'Items' && currentRows.map(row=><tr key={row.id}>{columnVisible('Items','name') && <td>{row.imageUrl && <img className="item-table-thumb" src={row.imageUrl} alt="" loading="lazy"/>}<b>{row.name}</b><small className="live-cell-sub">{row.displayId || row.id}</small></td>}{columnVisible('Items','sku') && <td>{row.sku}</td>}{columnVisible('Items','category') && <td>{row.category}</td>}{columnVisible('Items','sellingPrice') && <td>{cash(row.price)}</td>}{columnVisible('Items','avgCost') && <td>{cash(row.cost)}</td>}{columnVisible('Items','onHand') && <td>{row.stock}</td>}{columnVisible('Items','status') && <td><StatusPill value={row.stock === 0 ? 'OUT_OF_STOCK' : row.stock <= Number(row.reorderThreshold ?? 5) ? 'LOW_STOCK' : 'IN_STOCK'}/></td>}<td>{canManage && <div className="table-action-group"><button className="icon-button small" onClick={()=>openEdit(row)} title="Edit item details" aria-label={"Edit " + row.name}><Pencil size={16}/></button><button className="icon-button small" onClick={()=>onNavigate('Inventory')} title="Adjust stock" aria-label={"Adjust stock for " + row.name}><Boxes size={16}/></button></div>}</td></tr>)}
        {page === 'Categories' && currentRows.map(row=><tr key={row.id}>{columnVisible('Categories','category') && <td><b>{row.name}</b></td>}{columnVisible('Categories','itemCount') && <td>{row.itemCount}</td>}{columnVisible('Categories','description') && <td>{row.description || '—'}</td>}{columnVisible('Categories','status') && <td><StatusPill value={Number(row.isActive) ? 'ACTIVE' : 'INACTIVE'}/></td>}<td>{canManage && <div className="table-action-group"><LiveButton onClick={()=>openEdit(row)} icon={Pencil}>Edit</LiveButton><LiveButton onClick={()=>toggleActive('categories',row)}>{Number(row.isActive) ? 'Deactivate' : 'Activate'}</LiveButton></div>}</td></tr>)}
        {page === 'Suppliers' && currentRows.map(row=><tr key={row.id}>{columnVisible('Suppliers','supplier') && <td><b>{row.name}</b><small className="live-cell-sub">{row.contactName || 'Supplier'}</small></td>}{columnVisible('Suppliers','contact') && <td>{row.contactName || '—'}</td>}{columnVisible('Suppliers','emailPhone') && <td>{row.email || '—'}<small className="live-cell-sub">{row.phone || ''}</small></td>}{columnVisible('Suppliers','purchaseOrders') && <td>{row.purchaseCount || 0}</td>}{columnVisible('Suppliers','status') && <td><StatusPill value={Number(row.isActive) ? 'ACTIVE' : 'INACTIVE'}/></td>}<td>{canManage && <LiveButton onClick={()=>toggleActive('suppliers',row)}>{Number(row.isActive) ? 'Deactivate' : 'Activate'}</LiveButton>}</td></tr>)}
        {page === 'Customers' && currentRows.map(row=><tr key={row.id}>{columnVisible('Customers','customer') && <td><div className="customer-primary-line"><b>{row.name}</b>{Boolean(row.isBusiness) && <span className="customer-business-tag">BUSINESS</span>}</div><small className="live-cell-sub">{row.email || 'Customer'}</small></td>}{columnVisible('Customers','contact') && <td>{row.phone || '—'}</td>}{columnVisible('Customers','orders') && <td>{row.orderCount || 0}</td>}{columnVisible('Customers','totalSpent') && <td>{cash(row.totalSpent)}</td>}{columnVisible('Customers','outstandingBalance') && <td><b className={Number(row.outstandingBalance)>0?'khata-balance-due':'khata-balance-clear'}>{cash(row.outstandingBalance)}</b></td>}{columnVisible('Customers','lastPurchase') && <td>{asDate(row.lastPurchaseAt)}</td>}<td><div className="table-action-group">{canManage && <LiveButton icon={Pencil} onClick={()=>openEdit(row)} disabled={busy}>Edit</LiveButton>}{columnVisible('Customers','outstandingBalance') && <LiveButton icon={History} onClick={()=>openCustomerLedger(row)} disabled={busy}>Khata history</LiveButton>}{canManage && columnVisible('Customers','outstandingBalance') && Number(row.outstandingBalance)>0 && <LiveButton icon={Wallet} onClick={()=>openCreditRepayment(row)} disabled={busy}>Record payment</LiveButton>}{canManage && <LiveButton onClick={()=>toggleActive('customers',row)}>{Number(row.isActive) ? 'Deactivate' : 'Activate'}</LiveButton>}</div></td></tr>)}
        {page === 'Purchases' && currentRows.map(row=><tr key={row.id}>{columnVisible('Purchases','purchaseNo') && <td><b>{row.purchaseNo}</b></td>}{columnVisible('Purchases','supplier') && <td>{row.supplier || 'No supplier'}</td>}{columnVisible('Purchases','purchaseDate') && <td>{asDate(row.purchaseDate)}</td>}{columnVisible('Purchases','lineCount') && <td>{row.lineCount || 0}</td>}{columnVisible('Purchases','totalAmount') && <td>{cash(row.totalAmount)}</td>}{columnVisible('Purchases','status') && <td><StatusPill value={row.status}/></td>}<td><div className="table-action-group">{canManage && String(row.status).toUpperCase()==='ORDERED' && Number(row.quantityReceived || 0)===0 && <><LiveButton icon={Pencil} onClick={()=>openEdit(row)} disabled={busy}>Edit</LiveButton><LiveButton variant="danger" icon={X} onClick={()=>cancelPurchase(row)} disabled={busy}>Cancel</LiveButton></>}{['ORDERED','PARTIALLY_RECEIVED'].includes(String(row.status).toUpperCase()) && canManage && <LiveButton variant="primary" onClick={()=>openReceive(row)} disabled={busy}>Receive</LiveButton>}</div></td></tr>)}
        {page === 'Transactions' && currentRows.map(row=><tr key={row.id}>{columnVisible('Transactions','receiptNo') && <td><b>{row.receiptNo}</b><small className="live-cell-sub">{row.lineCount || 0} item lines</small></td>}{columnVisible('Transactions','customer') && <td>{row.customer || 'Walk-in Customer'}</td>}{columnVisible('Transactions','cashier') && <td>{row.cashier || '—'}</td>}{columnVisible('Transactions','date') && <td>{asDate(row.completedAt)}</td>}{columnVisible('Transactions','payment') && <td>{prettyStatus(row.paymentMethod || row.method)}</td>}{columnVisible('Transactions','total') && <td>{cash(row.totalAmount)}</td>}{columnVisible('Transactions','status') && <td><StatusPill value={row.status}/></td>}<td><button className="icon-button small" onClick={()=>openTransaction(row)} aria-label="View transaction"><Eye size={16}/></button></td></tr>)}
      </tbody></table></div>}
      <div className="table-footer"><span>{loading ? 'Fetching from database…' : 'Showing ' + currentRows.length + ' live record' + (currentRows.length === 1 ? '' : 's')}</span><span className="muted">API connected · {role}</span></div>
    </section>}

    {(modal === 'spending-create' || modal === 'spending-edit') && <LiveModal
      title={modal === 'spending-edit' ? 'Edit spending' : 'Record a spending'}
      subtitle="Save an operating expense with enough detail to trace it later. This does not change inventory or employee payroll."
      onClose={()=>setModal('')}
      onSubmit={submitSpending}
      busy={busy}
      submitLabel={modal === 'spending-edit' ? 'Save changes' : 'Record spending'}
      wide
    >
      <div className="live-form-grid spending-form-grid">
        <Field label="Date *"><input className="form-input" type="date" required value={form.spendingDate || ''} onChange={event=>setValue('spendingDate',event.target.value)}/></Field>
        <Field label="Category *"><input className="form-input" list="spending-category-options" required maxLength={100} value={form.category || ''} onChange={event=>setValue('category',event.target.value)} placeholder="e.g. Rent, Utilities, Transport"/><datalist id="spending-category-options"><option value="Rent"/><option value="Utilities"/><option value="Transport"/><option value="Repairs & maintenance"/><option value="Packaging"/><option value="Office supplies"/><option value="Marketing"/><option value="Bank charges"/><option value="Other"/></datalist></Field>
        <Field label="Reason / description *"><input className="form-input" required minLength={3} maxLength={255} value={form.description || ''} onChange={event=>setValue('description',event.target.value)} placeholder="What was the money spent on?"/></Field>
        <Field label="Amount *"><input className="form-input" type="number" required min="0.01" step="0.01" max="9999999999999.99" value={form.amount || ''} onChange={event=>setValue('amount',event.target.value)} placeholder="0.00"/></Field>
        <Field label="Payment mode *"><select className="form-input" required value={form.paymentMode || 'CASH'} onChange={event=>setValue('paymentMode',event.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></select></Field>
        <Field label="Paid to (optional)"><input className="form-input" maxLength={140} value={form.paidTo || ''} onChange={event=>setValue('paidTo',event.target.value)} placeholder="Person, vendor or company"/></Field>
        <Field label="Reference number (optional)"><input className="form-input" maxLength={120} value={form.referenceNo || ''} onChange={event=>setValue('referenceNo',event.target.value)} placeholder="UPI / bank transaction ID"/></Field>
        <Field label="Additional notes (optional)"><textarea className="form-input textarea" maxLength={500} value={form.notes || ''} onChange={event=>setValue('notes',event.target.value)} placeholder="Anything else worth keeping on record"/></Field>
      </div>
      <div className="info-callout"><CircleHelp size={16}/><span>Operating spendings are reported separately from employee salary and employee expense deductions to avoid double-counting. Editing is audited; voiding keeps the original record.</span></div>
    </LiveModal>}

    {modal === 'spending-void' && <LiveModal
      title="Void spending record"
      subtitle={'This will exclude "' + (form.description || 'this record') + '" from spending totals. The original record will remain in the ledger and audit log.'}
      onClose={()=>setModal('')}
      onSubmit={submitVoidSpending}
      busy={busy}
      submitLabel="Void spending"
    >
      <Field label="Reason for voiding *"><textarea className="form-input textarea" required minLength={5} maxLength={500} value={form.voidReason || ''} onChange={event=>setValue('voidReason',event.target.value)} placeholder="Explain why this record is being voided"/></Field>
      <div className="warning-callout"><AlertTriangle size={16}/><span>This action cannot be reversed from the UI. Create a corrected spending entry if needed; do not delete the original record.</span></div>
    </LiveModal>}

    {modal === 'return-create' && <LiveModal title="Start a return" subtitle="Find the original saved sale, select returned quantities, then record the manual refund settlement." onClose={()=>{setModal('');setReturnSale(null);setReturnLines([]);}} onSubmit={submitReturn} busy={busy} submitLabel="Complete return" wide>
      <div className="live-return-lookup"><Field label="Original receipt number or sale ID"><input className="form-input" value={form.receiptNo || ''} onChange={e=>setValue('receiptNo',e.target.value)} placeholder="Full receipt, sale ID, or last 4 characters (e.g. D275)"/><small>Enter the full receipt/sale ID or its last four characters (letters or digits, e.g. D275). If more than one sale matches, Ritvan will ask for the full ID.</small></Field><LiveButton icon={Search} onClick={loadReturnSale} disabled={busy}>Find sale</LiveButton></div>
      {returnSale && <div className="live-return-sale-summary"><div><small>Receipt</small><b>{returnSale.receiptNo}</b></div><div><small>Customer</small><b>{returnSale.customer || 'Walk-in Customer'}</b></div><div><small>Original total</small><b>{cash(returnSale.totalAmount)}</b></div><div><small>Completed</small><b>{asDate(returnSale.completedAt)}</b></div></div>}
      {returnSale && <div className="live-return-lines"><div className="panel-head"><div><h3>Sale lines</h3><p>Set quantity to zero for items not being returned. Previous returns are checked by the server.</p></div></div>
        {returnLines.map((line,index)=><div className="live-return-line" key={line.saleItemId}>
          <div className="live-return-product"><b>{line.itemName}</b><small>{line.sku} · Sold {line.soldQuantity} · {cash(line.unitPrice)} each</small></div>
          <Field label="Qty to return"><input className="form-input" type="number" min="0" max={line.soldQuantity} step="1" value={line.quantity} onChange={e=>setReturnLines(old=>old.map((row,i)=>i===index?{...row,quantity:e.target.value}:row))}/></Field>
          <label className="live-restock-check"><input type="checkbox" checked={line.restock} onChange={e=>setReturnLines(old=>old.map((row,i)=>i===index?{...row,restock:e.target.checked}:row))}/><span>Restock</span></label>
          <Field label="Condition note"><input className="form-input" maxLength={300} value={line.conditionNote} onChange={e=>setReturnLines(old=>old.map((row,i)=>i===index?{...row,conditionNote:e.target.value}:row))} placeholder="Optional"/></Field>
        </div>)}
      </div>}
      <div className="live-form-grid">
        <Field label="Return reason *"><textarea className="form-input textarea" minLength={5} maxLength={500} required value={form.reason || ''} onChange={e=>setValue('reason',e.target.value)} placeholder="Reason for the return"/></Field>
        <Field label="Manual settlement method *"><select className="form-input" value={form.refundMethod || 'Cash'} onChange={e=>setValue('refundMethod',e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option></select><small>This records the declared refund method; it does not trigger a gateway transfer.</small></Field>
        <Field label="Refund reference (optional)"><input className="form-input" maxLength={120} value={form.referenceNo || ''} onChange={e=>setValue('referenceNo',e.target.value)} placeholder="UPI/card reference"/></Field>
      </div>
      {!returnSale && <div className="info-callout"><CircleHelp size={16}/><span>Load a completed sale first. The return cannot be completed until the original receipt is found.</span></div>}
    </LiveModal>}

    {modal === 'staff-permissions' && <LiveModal title={'Permissions · ' + (form.staffName || 'Staff member')} subtitle="Choose which modules this user can open and which table columns are visible to them. Their role still limits sensitive actions." onClose={()=>setModal('')} onSubmit={saveStaffPermissions} busy={busy} submitLabel="Save permissions" wide>
      <div className="permission-intro">
        <ShieldCheck size={18}/>
        <div><b>{form.staffRole || 'Cashier'} access policy</b><p>Dashboard stays enabled. A user's role limits the maximum modules and actions they can receive. Admin accounts always retain full access.</p></div>
      </div>
      <section className="permission-editor-section">
        <div className="permission-editor-heading"><h3>Module access</h3><p>Switch whole workspace pages on or off for this account.</p></div>
        <div className="permission-module-grid">
          {(PERMISSION_MODULES_BY_ROLE[form.staffRole] || PERMISSION_MODULES_BY_ROLE.Cashier).map(module=><label className="permission-choice" key={module}>
            <input type="checkbox" checked={(form.permissionModules || []).includes(module)} disabled={module === 'Dashboard'} onChange={e=>togglePermissionModule(module,e.target.checked)}/>
            <span>{module}</span>
          </label>)}
        </div>
      </section>
      <section className="permission-editor-section">
        <div className="permission-editor-heading"><h3>Visible table columns</h3><p>Choose which columns appear in each enabled table. Empty selections hide those columns from the workspace table.</p></div>
        {(PERMISSION_MODULES_BY_ROLE[form.staffRole] || PERMISSION_MODULES_BY_ROLE.Cashier)
          .filter(module => (form.permissionModules || []).includes(module) && PERMISSION_COLUMN_OPTIONS[module])
          .map(module=><div className="permission-column-group" key={module}>
            <div className="permission-column-title">{module}</div>
            <div className="permission-column-grid">
              {Object.entries(PERMISSION_COLUMN_OPTIONS[module]).filter(([column]) => form.staffRole !== 'Cashier' || !CASHIER_PERMISSION_COLUMNS[module] || CASHIER_PERMISSION_COLUMNS[module].includes(column)).map(([column,label])=><label className="permission-choice" key={column}>
                <input type="checkbox" checked={(form.permissionColumns?.[module] || (form.staffRole === 'Cashier' && CASHIER_PERMISSION_COLUMNS[module]) || Object.keys(PERMISSION_COLUMN_OPTIONS[module])).includes(column)} onChange={e=>togglePermissionColumn(module,column,e.target.checked)}/>
                <span>{label}</span>
              </label>)}
            </div>
          </div>)}
        {!(form.permissionModules || []).some(module => PERMISSION_COLUMN_OPTIONS[module]) && <div className="permission-empty">No table-based modules are enabled. Enable a module above to configure its columns.</div>}
      </section>
    </LiveModal>}

    {modal === 'credit-ledger' && creditLedger && <LiveModal title={'Khata history · ' + (creditLedger.customer?.name || 'Customer')} subtitle="An append-only customer account ledger. Credit sales add to the balance; repayments reduce it." onClose={()=>{setModal('');setCreditLedger(null);}} submitLabel="Close" onSubmit={event=>{event.preventDefault();setModal('');setCreditLedger(null);}} busy={busy} wide>
      <div className="khata-payment-summary"><span>Current outstanding balance</span><strong>{cash(creditLedger.outstandingBalance)}</strong><small>{Number(creditLedger.outstandingBalance)>0 ? 'This amount is still owed by the customer.' : 'This customer has no outstanding Khata balance.'}</small></div>
      <div className="table-wrap"><table><thead><tr><th>DATE</th><th>ENTRY</th><th>DETAIL</th><th>METHOD</th><th>AMOUNT</th></tr></thead><tbody>{(creditLedger.entries || []).map(entry=><tr key={entry.id}><td>{asDate(entry.createdAt)}</td><td><StatusPill value={entry.entryType === 'CREDIT_SALE' ? 'CREDIT SALE' : 'REPAYMENT'}/></td><td><b>{entry.saleId ? 'Sale #' + entry.saleId : 'Customer payment'}</b><small className="live-cell-sub">{entry.notes || entry.referenceNo || '—'}</small></td><td>{entry.method ? prettyStatus(entry.method) : 'Khata'}</td><td><b className={entry.entryType === 'CREDIT_SALE' ? 'khata-balance-due' : 'khata-balance-clear'}>{entry.entryType === 'CREDIT_SALE' ? '+' : '−'}{cash(entry.amount)}</b></td></tr>)}</tbody></table></div>
      {!creditLedger.entries?.length && <EmptyState icon={History} title="No Khata entries yet" text="Credit sales and repayments will be listed here."/>}
    </LiveModal>}
{modal === 'credit-payment' && <LiveModal title={'Record Khata payment · ' + (form.customerName || 'Customer')} subtitle="Record money received from the customer. This creates an immutable ledger entry and reduces their outstanding balance." onClose={()=>setModal('')} onSubmit={submitCreditRepayment} busy={busy} submitLabel="Record payment" wide={false}>
      <div className="khata-payment-summary">
        <span>Outstanding balance</span>
        <strong>{cash(form.outstandingBalance)}</strong>
        <small>Payments cannot exceed the current balance.</small>
      </div>
      <div className="live-form-grid">
        <Field label="Amount received *"><input className="form-input" type="number" required min="0.01" max={form.outstandingBalance} step="0.01" value={form.amount || ''} onChange={e=>setValue('amount',e.target.value)}/></Field>
        <Field label="Payment method *"><select className="form-input" value={form.method || 'Cash'} onChange={e=>setValue('method',e.target.value)}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Card">Card</option></select></Field>
        <Field label="Reference number (optional)"><input className="form-input" maxLength={120} value={form.referenceNo || ''} onChange={e=>setValue('referenceNo',e.target.value)} placeholder="UPI or transaction reference"/></Field>
        <Field label="Notes (optional)"><input className="form-input" maxLength={500} value={form.notes || ''} onChange={e=>setValue('notes',e.target.value)} placeholder="Repayment note"/></Field>
      </div>
      <div className="info-callout"><CircleHelp size={16}/><span>Repayments are recorded in the Khata ledger. This does not initiate a UPI, card, or bank transfer.</span></div>
    </LiveModal>}

    {modal === 'staff-password' && <LiveModal title="Reset staff password" subtitle={'Set a new sign-in password for ' + (form.staffName || 'this account') + '.'} onClose={()=>setModal('')} onSubmit={resetStaffPassword} busy={busy} submitLabel="Reset password">
      <Field label="New password *"><input className="form-input" type="password" autoComplete="new-password" minLength={12} maxLength={200} required value={form.password || ''} onChange={e=>setValue('password',e.target.value)} placeholder="At least 12 characters"/></Field>
      <div className="warning-callout"><ShieldCheck size={16}/><span>The password will be hashed by the server. The user should sign in with this new password; the existing session role is reloaded from the database.</span></div>
    </LiveModal>}

    {(modal === 'create' || modal === 'edit') && <LiveModal title={modal === 'edit' ? (page === 'Items' ? 'Edit item details' : page === 'Categories' ? 'Edit category details' : page === 'Customers' ? 'Edit customer details' : 'Edit purchase order') : page === 'Items' ? 'Add item' : page === 'Categories' ? 'Add category' : page === 'Suppliers' ? 'Add supplier' : page === 'Customers' ? 'Add customer' : page === 'Staff & Roles' ? 'Invite staff member' : 'Create purchase order'} subtitle={modal === 'edit' ? 'Changes are validated by the API and saved to MySQL.' : "Required fields are validated by Ritvan's API."} onClose={()=>setModal('')} onSubmit={submitCreate} busy={busy} submitLabel={modal === 'edit' ? 'Save changes' : page === 'Purchases' ? 'Create purchase order' : 'Save record'} wide={page === 'Purchases' || modal === 'edit'}>
      {(page === 'Items' || page === 'Categories' || page === 'Suppliers' || page === 'Customers' || page === 'Staff & Roles') && <div className="live-form-grid">
        <Field label="Name *"><input className="form-input" required maxLength={page === 'Categories' ? 120 : 200} value={form.name || ''} onChange={e=>setValue('name',e.target.value)} placeholder={page === 'Items' ? 'e.g. Matcha Energy Blend' : page === 'Categories' ? 'e.g. Beverages' : page === 'Suppliers' ? 'Supplier business name' : page === 'Staff & Roles' ? 'Team member name' : 'Customer full name'}/></Field>
        {page === 'Items' && <>
          <Field label="SKU (optional)"><input className="form-input" maxLength={80} value={form.sku || ''} onChange={e=>setValue('sku',e.target.value)} placeholder="Leave blank to generate automatically"/><small>{modal === 'edit' ? 'Leave blank to keep the current SKU unchanged.' : 'If left blank, Ritvan creates a unique SKU when saving.'}</small></Field>
          <Field label="Product photo (optional)">
            <div className="photo-upload-control"><ImagePlus size={18}/><input className="form-input photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleItemPhoto}/></div>
            <small>JPEG, PNG or WebP. Ritvan resizes and compresses the photo before saving it with the item.</small>
          </Field>
          {form.imageData && <div className="item-photo-preview"><img src={form.imageData} alt="Product photo preview"/><div><b>{modal === 'edit' ? 'Current photo' : 'Photo ready'}</b><small>{modal === 'edit' ? 'Keep this image or remove it before saving changes.' : 'It will appear on item cards and in the POS catalog.'}</small><LiveButton onClick={()=>setValue('imageData','')} icon={X}>Remove photo</LiveButton></div></div>}
          <Field label="Category"><select className="form-input" value={form.categoryId || ''} onChange={e=>setValue('categoryId',e.target.value)}><option value="">Uncategorized</option>{categories.map(c=><option key={c.id} value={c.id} disabled={!Number(c.isActive) && String(form.categoryId) !== String(c.id)}>{c.name}{Number(c.isActive) ? '' : ' (inactive)'}</option>)}</select></Field>
          <Field label="Selling price *"><input className="form-input" type="number" required min="0" step="0.01" value={form.sellingPrice || ''} onChange={e=>setValue('sellingPrice',e.target.value)}/></Field>
          {modal !== 'edit' && <><Field label="Opening unit cost"><input className="form-input" type="number" min="0" step="0.0001" value={form.initialCost || ''} onChange={e=>setValue('initialCost',e.target.value)}/></Field>
          <Field label="Opening quantity"><input className="form-input" type="number" min="0" step="1" value={form.initialQty ?? '0'} onChange={e=>setValue('initialQty',e.target.value)}/></Field></>}
          <Field label="Low-stock threshold"><input className="form-input" type="number" min="0" step="1" value={form.reorderThreshold ?? '5'} onChange={e=>setValue('reorderThreshold',e.target.value)}/></Field>
          <Field label="Barcode (optional)"><input className="form-input" value={form.barcode || ''} onChange={e=>setValue('barcode',e.target.value)} /></Field>
        </>}
        {page === 'Categories' && <><Field label="Description"><textarea className="form-input textarea" maxLength={500} value={form.description || ''} onChange={e=>setValue('description',e.target.value)} placeholder="What belongs in this category?"/></Field>{modal === 'edit' && <Field label="Status"><select className="form-input" value={form.isActive ?? '1'} onChange={e=>setValue('isActive',e.target.value)}><option value="1">Active</option><option value="0">Inactive</option></select><small>Existing items keep their category history if a category is deactivated.</small></Field>}</>}
        {(page === 'Suppliers' || page === 'Customers' || page === 'Staff & Roles') && <>
          <Field label={page === 'Customers' ? "Email (optional)" : "Email *"}><input className="form-input" type="email" required={page !== 'Customers'} value={form.email || ''} onChange={e=>setValue('email',e.target.value)} placeholder="name@example.com"/></Field>
          {page === 'Staff & Roles' ? <>
            <Field label="Temporary password *"><input className="form-input" type="password" minLength={12} required autoComplete="new-password" value={form.password || ''} onChange={e=>setValue('password',e.target.value)} placeholder="At least 12 characters"/><small>Passwords are hashed before storage. Share the temporary password securely.</small></Field>
            <Field label="Role"><select className="form-input" value={form.role || 'Cashier'} onChange={e=>setValue('role',e.target.value)}><option>Cashier</option><option>Manager</option><option>Admin</option></select></Field>
          </> : <Field label="Phone"><input className="form-input" value={form.phone || ''} onChange={e=>setValue('phone',e.target.value)} placeholder="Contact number"/></Field>}
          {page === 'Suppliers' && <>
            <Field label="Contact person"><input className="form-input" value={form.contactName || ''} onChange={e=>setValue('contactName',e.target.value)}/></Field>
            <Field label="Address"><input className="form-input" value={form.address || ''} onChange={e=>setValue('address',e.target.value)}/></Field>
          </>}
          {page === 'Customers' && canManage && <Field label="Customer type"><select className="form-input" value={form.isBusiness || '0'} onChange={e=>setValue('isBusiness',e.target.value)}><option value="0">Individual customer</option><option value="1">Business customer</option></select><small>Completed sales linked to business customers are included in the Business sales statistic.</small></Field>}
          {(page === 'Suppliers' || page === 'Customers') && <Field label="Notes"><textarea className="form-input textarea" value={form.notes || ''} onChange={e=>setValue('notes',e.target.value)}/></Field>}
        </>}
      </div>}
      {page === 'Purchases' && <div className="live-purchase-form">
        <div className="live-form-grid">
          <Field label="Supplier"><select className="form-input" value={form.supplierId || ''} onChange={e=>setValue('supplierId',e.target.value)}><option value="">No supplier selected</option>{suppliers.filter(x=>Number(x.isActive)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Purchase date *"><input className="form-input" type="date" required value={form.purchaseDate || ''} onChange={e=>setValue('purchaseDate',e.target.value)}/></Field>
          <Field label="Notes"><input className="form-input" value={form.notes || ''} onChange={e=>setValue('notes',e.target.value)} /></Field>
        </div>
        <div className="live-purchase-lines"><div className="panel-head"><div><h3>Purchase lines</h3><p>Stock is not changed until receiving is recorded.</p></div><LiveButton icon={Plus} onClick={()=>setForm(old=>({...old,lines:[...(old.lines||[]),{itemId:'',quantity:'1',unitCost:'0.00'}]}))}>Add line</LiveButton></div>
          {(form.lines || []).map((line,index)=><div className="live-purchase-line" key={index}>
            <Field label="Item"><select className="form-input" required value={line.itemId || ''} onChange={e=>setLine(index,'itemId',e.target.value)}><option value="">Choose item</option>{items.map(item=><option key={item.id} value={item.apiId}>{item.name} · {item.sku}</option>)}</select></Field>
            <Field label="Quantity"><input className="form-input" type="number" min="1" step="1" required value={line.quantity} onChange={e=>setLine(index,'quantity',e.target.value)}/></Field>
            <Field label="Unit cost"><input className="form-input" type="number" min="0" step="0.0001" required value={line.unitCost} onChange={e=>setLine(index,'unitCost',e.target.value)}/></Field>
            <button type="button" className="icon-button small" title="Remove line" disabled={(form.lines || []).length === 1} onClick={()=>setForm(old=>({...old,lines:old.lines.filter((_,i)=>i!==index)}))}><X size={15}/></button>
          </div>)}
        </div>
        <div className="info-callout"><CircleHelp size={16}/><span>Additional charges are kept at zero until the freight-capitalization policy is approved. Weighted average cost is updated when items are received.</span></div>
      </div>}
    </LiveModal>}

    {modal === 'receive' && receivePurchase && <LiveModal title={'Receive ' + receivePurchase.purchaseNo} subtitle="Enter the quantities physically received. Leave a line at zero if it is not part of this receipt." onClose={()=>{setModal('');setReceivePurchase(null);}} onSubmit={submitReceive} busy={busy} submitLabel="Confirm receipt" wide>
      <div className="live-receive-list">{(receivePurchase.lines || []).map(line=>{
        const outstanding = Math.max(0,Number(line.quantityOrdered)-Number(line.quantityReceived));
        return <div className="live-receive-line" key={line.purchaseItemId}><div><b>{line.itemName}</b><small>{line.sku} · {line.quantityReceived} received of {line.quantityOrdered}</small><small>{outstanding} still outstanding</small></div><Field label="Receive now"><input className="form-input" type="number" min="0" max={outstanding} step="1" value={receiveQuantities[line.purchaseItemId] ?? '0'} onChange={e=>setReceiveQuantities(old=>({...old,[line.purchaseItemId]:e.target.value}))}/></Field></div>;
      })}</div>
      <div className="warning-callout"><AlertTriangle size={16}/><span>Receiving will update on-hand stock and weighted average cost inside a database transaction. Open negative-stock reconciliations must be resolved first.</span></div>
    </LiveModal>}

    {modal === 'adjust' && <LiveModal title="Adjust stock" subtitle="Every quantity change is written to the stock movement ledger." onClose={()=>setModal('')} onSubmit={submitAdjustment} busy={busy} submitLabel="Save adjustment">
      <Field label="Item"><select className="form-input" required value={form.itemId || ''} onChange={e=>setValue('itemId',e.target.value)}>{items.filter(x=>x.stock >= 0).map(item=><option key={item.id} value={item.apiId}>{item.name} · {item.stock} on hand</option>)}</select></Field>
      <Field label="Quantity change *" hint="Use a positive number to add stock or a negative number to remove it."><input className="form-input" type="number" step="1" required value={form.delta || ''} onChange={e=>setValue('delta',e.target.value)} placeholder="e.g. 12 or -2"/></Field>
      {role === 'Admin' && <Field label="Adjustment type"><select className="form-input" value={form.type || 'ADJUSTMENT'} onChange={e=>setValue('type',e.target.value)}><option value="ADJUSTMENT">Normal adjustment</option><option value="DAMAGE_WRITE_OFF">Damaged stock write-off</option></select></Field>}
      <Field label="Reason *"><textarea className="form-input textarea" minLength={5} maxLength={500} required value={form.reason || ''} onChange={e=>setValue('reason',e.target.value)} placeholder="Reason for changing the stock count"/></Field>
    </LiveModal>}

    {modal === 'resolve' && <LiveModal title="Resolve stock reconciliation" subtitle={'Physical count for ' + (form.itemName || 'selected item') + '. This closes every open reconciliation for that SKU.'} onClose={()=>setModal('')} onSubmit={submitResolve} busy={busy} submitLabel="Confirm physical count">
      <Field label="Counted quantity *"><input className="form-input" type="number" min="0" step="1" required value={form.countedQty || '0'} onChange={e=>setValue('countedQty',e.target.value)}/></Field>
      <Field label="Reason *" hint="At least 10 characters."><textarea className="form-input textarea" required minLength={10} maxLength={500} value={form.reason || ''} onChange={e=>setValue('reason',e.target.value)} placeholder="Explain the physical count and reconciliation"/></Field>
      <div className="warning-callout"><ShieldCheck size={16}/><span>Only an Admin can resolve this queue. Historical sale cost snapshots are retained and will not be silently restated.</span></div>
    </LiveModal>}

    {modal === 'transaction' && transactionDetail && <div className="modal-backdrop" onClick={()=>setModal('')}><div className="modal live-modal live-modal-wide" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">SAVED TRANSACTION</div><h2>{transactionDetail.receiptNo}</h2><p>{asDate(transactionDetail.completedAt)} · {transactionDetail.customer || 'Walk-in Customer'} · {transactionDetail.cashier || 'Unknown cashier'}</p></div><button className="icon-button" onClick={()=>setModal('')}><X size={18}/></button></div>
      <div className="print-only printable-receipt transaction-print-receipt">
        <div className="print-receipt-brand">{businessLogo && <img className="print-receipt-logo" src={businessLogo} alt={businessName || 'Store logo'}/>}<strong>{businessName || 'RITVAN'}</strong><small>POINT OF SALE · SALES RECEIPT</small></div>
        <div className="print-receipt-meta">
          <div><span>Receipt</span><b>{transactionDetail.receiptNo}</b></div>
          <div><span>Date</span><b>{asDate(transactionDetail.completedAt)}</b></div>
          <div><span>Customer</span><b>{transactionDetail.customer || 'Walk-in Customer'}</b></div>
          <div><span>Cashier</span><b>{transactionDetail.cashier || '—'}</b></div>
        </div>
        <div className="print-receipt-lines">
          {(transactionDetail.lines || []).map(line=><div className="print-receipt-line" key={line.saleItemId}>
            <span>{line.itemName} × {line.quantity}</span><b>{cash(Number(line.unitPrice) * Number(line.quantity) - Number(line.discountAmount || 0))}</b>
            <small>{line.sku} · {cash(line.unitPrice)} each</small>
          </div>)}
        </div>
        <div className="print-receipt-totals">
          <div><span>Subtotal</span><b>{cash(transactionDetail.subtotal)}</b></div>
          <div><span>Discount</span><b>−{cash(transactionDetail.discountTotal)}</b></div>
          <div><span>Tax</span><b>{cash(transactionDetail.taxTotal)}</b></div>
          <div className="print-grand-total"><span>Total paid</span><b>{cash(transactionDetail.totalAmount)}</b></div>
        </div>
        <div className="print-receipt-meta">
          {(transactionDetail.payments || []).map(payment=><div key={payment.id}><span>{prettyStatus(payment.method)}{payment.referenceNo ? ' · ' + payment.referenceNo : ''}</span><b>{cash(payment.amountReceived)}</b></div>)}
          {(transactionDetail.payments || []).some(payment=>Number(payment.changeDue)>0) && <div><span>Change due</span><b>{cash((transactionDetail.payments || []).reduce((sum,payment)=>sum+Number(payment.changeDue||0),0))}</b></div>}
        </div>
        <div className="print-receipt-footer">Thank you for shopping with us.</div>
      </div>
      <div className="live-detail-summary"><div><small>Subtotal</small><b>{cash(transactionDetail.subtotal)}</b></div><div><small>Discount</small><b>−{cash(transactionDetail.discountTotal)}</b></div><div><small>Tax</small><b>{cash(transactionDetail.taxTotal)}</b></div><div><small>Total paid</small><b>{cash(transactionDetail.totalAmount)}</b></div></div>
      <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>SKU</th><th>QTY</th><th>UNIT PRICE</th><th>COST SNAPSHOT</th><th>LINE TOTAL</th></tr></thead><tbody>{(transactionDetail.lines || []).map(line=><tr key={line.saleItemId}><td><b>{line.itemName}</b>{line.provisionalCost ? <small className="live-negative">Provisional cost</small> : null}</td><td>{line.sku}</td><td>{line.quantity}</td><td>{cash(line.unitPriceActual)}</td><td>{cash(line.unitCostSnapshot)}</td><td>{cash(Number(line.unitPriceActual)*Number(line.quantity)-Number(line.discountAmount||0))}</td></tr>)}</tbody></table></div>
      <div className="live-payments"><b>Payments</b>{(transactionDetail.payments || []).map(payment=><div key={payment.id}><span>{prettyStatus(payment.method)}{payment.referenceNo ? ' · ' + payment.referenceNo : ''}</span><b>{cash(payment.amountReceived)}{Number(payment.changeDue) ? ' (change ' + cash(payment.changeDue) + ')' : ''}</b></div>)}</div>
      {transactionDetail.negativeStockOverride && <div className="warning-callout"><AlertTriangle size={16}/><span>This sale used an Admin negative-stock override. Review it in Inventory → Negative-stock reconciliation.</span></div>}
      <div className="modal-actions"><LiveButton onClick={()=>setModal('')}>Close</LiveButton><LiveButton icon={Download} onClick={()=>window.print()}>Print receipt</LiveButton></div>
    </div></div>}
  </>;
}
