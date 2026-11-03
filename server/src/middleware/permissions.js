export const ALL_MODULES = [
  'Dashboard', 'Point of Sale', 'Transactions', 'Inventory', 'Items', 'Categories',
  'Purchases', 'Suppliers', 'Customers', 'Staff & Roles', 'Employees', 'Spendings', 'Reports', 'Returns & Refunds', 'Settings',
];

export const ROLE_MODULES = {
  Admin: [...ALL_MODULES],
  Manager: ['Dashboard', 'Point of Sale', 'Transactions', 'Inventory', 'Items', 'Categories', 'Purchases', 'Suppliers', 'Customers', 'Spendings', 'Reports', 'Returns & Refunds'],
  Cashier: ['Dashboard', 'Point of Sale', 'Transactions'],
};

export const COLUMN_OPTIONS = {
  Items: {
    name: 'Item', sku: 'SKU', category: 'Category', sellingPrice: 'Selling price', avgCost: 'Average cost', onHand: 'On hand', status: 'Status',
  },
  Inventory: {
    item: 'Item', sku: 'SKU', onHand: 'On hand', avgCost: 'Average cost', stockValue: 'Stock value', status: 'Status',
    date: 'Date', movement: 'Movement', quantity: 'Quantity', costAtTime: 'Cost at time', reason: 'Reason', user: 'Changed by',
  },
  Categories: { category: 'Category', itemCount: 'Item count', description: 'Description', status: 'Status' },
  Purchases: { purchaseNo: 'Purchase number', supplier: 'Supplier', purchaseDate: 'Order date', lineCount: 'Lines', totalAmount: 'Total', status: 'Status' },
  Suppliers: { supplier: 'Supplier', contact: 'Contact', emailPhone: 'Email / phone', purchaseOrders: 'Purchase orders', status: 'Status' },
  Customers: { customer: 'Customer', contact: 'Contact', orders: 'Orders', totalSpent: 'Total spent', outstandingBalance: 'Khata outstanding', lastPurchase: 'Last purchase' },
  Transactions: { receiptNo: 'Receipt', customer: 'Customer', cashier: 'Cashier', date: 'Date', payment: 'Payment method', total: 'Total', status: 'Status' },
  'Returns & Refunds': { returnNo: 'Return number', receiptNo: 'Original receipt', customer: 'Customer', date: 'Date', refund: 'Refund', settlement: 'Settlement', status: 'Status' },
};

const CASHIER_DEFAULT_COLUMNS = {
  Items: ['name', 'sku', 'category', 'sellingPrice', 'onHand', 'status'],
  Transactions: ['receiptNo', 'date', 'total', 'status'],
};

function parseJson(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } }
  return typeof value === 'object' ? value : null;
}

export function effectivePermissions(role, storedValue) {
  const roleModules = ROLE_MODULES[role] || ROLE_MODULES.Cashier;
  if (role === 'Admin') {
    return {
      modules: [...ALL_MODULES],
      columns: Object.fromEntries(Object.entries(COLUMN_OPTIONS).map(([module, columns]) => [module, Object.keys(columns)])),
    };
  }
  const stored = parseJson(storedValue);
  const requestedModules = Array.isArray(stored?.modules) ? stored.modules : roleModules;
  const modules = roleModules.filter(module => requestedModules.includes(module));
  if (roleModules.includes('Dashboard') && !modules.includes('Dashboard')) modules.unshift('Dashboard');
  const columns = {};
  for (const [module, options] of Object.entries(COLUMN_OPTIONS)) {
    const roleDefaults = CASHIER_DEFAULT_COLUMNS[module] || Object.keys(options);
    const requested = stored?.columns && Object.hasOwn(stored.columns, module) ? stored.columns[module] : roleDefaults;
    const safe = Array.isArray(requested) ? requested.filter(key => Object.hasOwn(options, key) && roleDefaults.includes(key)) : roleDefaults;
    columns[module] = safe;
  }
  return { modules, columns };
}

export function requireModuleAccessFor(readModules, writeModules = readModules) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (req.user.role === 'Admin') return next();
    const allowed = req.method === 'GET' || req.method === 'HEAD' ? readModules : writeModules;
    const modules = req.user.permissions?.modules || ROLE_MODULES[req.user.role] || ROLE_MODULES.Cashier;
    if (allowed.some(module => modules.includes(module))) return next();
    return res.status(403).json({ error: 'Your account does not have access to this Nexora module.' });
  };
}

export function validatePermissions(role, value) {
  const stored = parseJson(value);
  if (!stored || !Array.isArray(stored.modules) || !stored.columns || typeof stored.columns !== 'object' || Array.isArray(stored.columns)) {
    return { error: 'Permissions must contain module access and visible-column selections.' };
  }
  if (role === 'Admin') return { error: 'Admin accounts always retain full access and do not use custom restrictions.' };
  const allowedModules = ROLE_MODULES[role] || ROLE_MODULES.Cashier;
  if (!stored.modules.includes('Dashboard') || stored.modules.some(module => !allowedModules.includes(module))) {
    return { error: 'Select Dashboard and only modules allowed for the selected role.' };
  }
  const columns = {};
  for (const [module, selected] of Object.entries(stored.columns)) {
    if (!Object.hasOwn(COLUMN_OPTIONS, module) || !Array.isArray(selected)) return { error: 'Invalid visible-column configuration.' };
    if (!allowedModules.includes(module) || !stored.modules.includes(module)) {
      if (selected.length) return { error: 'Visible columns may only be configured for modules this account can access.' };
    }
    const valid = Object.keys(COLUMN_OPTIONS[module]);
    const roleAllowedColumns = role === 'Cashier' && CASHIER_DEFAULT_COLUMNS[module] ? CASHIER_DEFAULT_COLUMNS[module] : valid;
    if (selected.some(key => !valid.includes(key) || !roleAllowedColumns.includes(key)) || new Set(selected).size !== selected.length) {
      return { error: 'One or more selected table columns are invalid.' };
    }
    columns[module] = selected;
  }
  for (const [module, available] of Object.entries(COLUMN_OPTIONS)) {
    if (stored.modules.includes(module) && !Object.hasOwn(columns, module)) columns[module] = Object.keys(available);
  }
  return { permissions: { modules: [...new Set(stored.modules)], columns } };
}
