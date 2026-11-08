import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowRight, Banknote, BriefcaseBusiness, CalendarDays,
  Check, CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Contact, CreditCard,
  Download, Eye, FileText, History, ImagePlus, IndianRupee, LoaderCircle, MoreHorizontal,
  Pencil, Plus, RefreshCw, Search, ShieldCheck, Smartphone, Trash2, TrendingDown,
  UserRound, Users, Wallet, X
} from 'lucide-react';
import { apiRequest } from './lib/api.js';

const cash = (value, currency = 'INR') => {
  const symbols = { INR: '₹', USD: '$', GBP: '£', EUR: '€' };
  return (symbols[currency] || currency + ' ') + Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
};
const ymd = date => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const monthNow = () => ymd(new Date()).slice(0, 7);
const initials = name => String(name || 'Employee').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
const friendlyDate = value => {
  if (!value) return '—';
  const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const monthLabel = value => {
  if (!value) return '—';
  const date = new Date(String(value).slice(0, 7) + '-01T12:00:00');
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
function dateWindow(preset) {
  const today = new Date();
  const to = ymd(today);
  if (preset === 'all') return { from: '1970-01-01', to };
  if (preset === 'month') return { from: to.slice(0, 7) + '-01', to };
  const days = preset === '7d' ? 7 : preset === '21d' ? 21 : 30;
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - days + 1);
  return { from: ymd(fromDate), to };
}
function ActionButton({ children, icon: Icon, variant = 'secondary', ...props }) {
  return <button className={'btn btn-' + variant + ' employee-action'} {...props}>{Icon && <Icon size={15}/>}<span>{children}</span></button>;
}
function FormField({ label, required, hint, children, full = false }) {
  return <label className={'employee-field' + (full ? ' employee-field-full' : '')}><span>{label}{required && <b className="employee-required"> *</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function PersonAvatar({ employee, large = false }) {
  return <span className={'employee-avatar' + (large ? ' employee-avatar-large' : '')}>
    {employee?.photoData ? <img src={employee.photoData} alt={employee.name || 'Employee photo'}/> : <span>{initials(employee?.name)}</span>}
  </span>;
}
function StatCard({ icon: Icon, label, value, note, tone = 'violet' }) {
  return <section className="employee-stat-card">
    <span className={'employee-stat-icon employee-stat-' + tone}><Icon size={18}/></span>
    <div className="employee-stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
  </section>;
}
function EmptyPanel({ icon: Icon = Users, title, text, action }) {
  return <div className="employee-empty"><span><Icon size={23}/></span><b>{title}</b><p>{text}</p>{action}</div>;
}
function PayrollStatus({ status }) {
  return <span className={'employee-status ' + (status === 'PAID' ? 'employee-status-paid' : 'employee-status-unpaid')}><i/>{status === 'PAID' ? 'Paid' : 'Unpaid'}</span>;
}

export default function EmployeesPage({ auth, notify, onUnauthorized, currency = 'INR' }) {
  const token = auth?.token;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;
  const [periodPreset, setPeriodPreset] = useState('30d');
  const [directory, setDirectory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [tab, setTab] = useState('directory');
  const [refreshKey, setRefreshKey] = useState(0);
  const [month, setMonth] = useState(monthNow());
  const [payroll, setPayroll] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(null);
  const [employeeFormError, setEmployeeFormError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseEmployeeId, setExpenseEmployeeId] = useState('');
  const [expenseForm, setExpenseForm] = useState(null);
  const [expenseFormError, setExpenseFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingPayrollId, setSavingPayrollId] = useState(null);
  const period = useMemo(() => dateWindow(periodPreset), [periodPreset]);
  const money = value => cash(value, currency);

  const loadDirectory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setPageError('');
    try {
      const query = new URLSearchParams({ from: period.from, to: period.to, includeInactive: includeInactive ? '1' : '0' });
      const result = await apiRequest('/employees?' + query.toString(), { token });
      setDirectory(result.employees || []);
      setSummary(result.summary || null);
    } catch (error) {
      setPageError(error.message || 'Could not load employee records.');
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
    } finally { setLoading(false); }
  }, [token, period.from, period.to, includeInactive, refreshKey]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  const loadPayroll = useCallback(async () => {
    if (!token) return;
    setPayrollLoading(true);
    try {
      const result = await apiRequest('/employees/payroll?month=' + encodeURIComponent(month), { token });
      setPayroll(result.payroll || []);
    } catch (error) {
      setPayroll([]);
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
      if (error.status && error.status !== 404) notifyRef.current(error.message || 'Could not load payroll.', 'warning');
    } finally { setPayrollLoading(false); }
  }, [token, month, refreshKey]);

  const loadExpenses = useCallback(async () => {
    if (!token) return;
    setExpensesLoading(true);
    try {
      const query = new URLSearchParams(period);
      const result = await apiRequest('/employees/expenses?' + query.toString(), { token });
      setExpenses(result.expenses || []);
    } catch (error) {
      setExpenses([]);
      if (error.status === 401 && onUnauthorizedRef.current) onUnauthorizedRef.current();
      if (error.status) notifyRef.current(error.message || 'Could not load employee expenses.', 'warning');
    } finally { setExpensesLoading(false); }
  }, [token, period.from, period.to, refreshKey]);

  useEffect(() => { loadPayroll(); }, [loadPayroll]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const refreshAll = async () => {
    setRefreshKey(value => value + 1);
    if (selectedId) {
      try {
        setDetailLoading(true);
        const data = await apiRequest('/employees/' + selectedId, { token });
        setDetail(data);
      } catch (error) {
        notify(error.message || 'Could not refresh employee details.', 'warning');
      } finally { setDetailLoading(false); }
    }
  };

  const openDetail = async employee => {
    setSelectedId(employee.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await apiRequest('/employees/' + employee.id, { token });
      setDetail(data);
    } catch (error) {
      notify(error.message || 'Could not open employee details.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
      setSelectedId(null);
    } finally { setDetailLoading(false); }
  };

  const openCreateEmployee = () => {
    setEditing(false);
    setEmployeeForm({
      name: '', phone: '', aadhaar: '', aadhaarLast4: '', photoData: '',
      dateOfJoining: ymd(new Date()), monthlySalary: '', jobRole: '',
      salaryDueDay: '1', clearAadhaar: false,
    });
    setEmployeeFormError('');
    setEmployeeModal(true);
  };
  const openEditEmployee = data => {
    const employee = data?.employee || data;
    setEditing(true);
    setEmployeeForm({
      name: employee.name || '', phone: employee.phone || '', aadhaar: '',
      aadhaarLast4: employee.aadhaarLast4 || '', photoData: employee.photoData || '',
      dateOfJoining: employee.dateOfJoining || ymd(new Date()),
      monthlySalary: String(employee.monthlySalary ?? ''), jobRole: employee.jobRole || '',
      salaryDueDay: String(employee.salaryDueDay || 1), clearAadhaar: false,
      isActive: Boolean(employee.isActive),
    });
    setEmployeeFormError('');
    setEmployeeModal(true);
  };
  const setEmployeeValue = (key, value) => setEmployeeForm(previous => ({ ...previous, [key]: value }));

  const handlePhoto = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setEmployeeFormError('Choose a JPEG, PNG or WebP image.');
      event.target.value = '';
      return;
    }
    setPhotoBusy(true);
    setEmployeeFormError('');
    try {
      const bitmap = await createImageBitmap(file);
      const side = 144;
      const scale = Math.max(side / bitmap.width, side / bitmap.height);
      const scaledWidth = Math.round(bitmap.width * scale);
      const scaledHeight = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = side; canvas.height = side;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo compression is not available in this browser.');
      const cropX = Math.max(0, (scaledWidth - side) / 2);
      const cropY = Math.max(0, (scaledHeight - side) / 2);
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, side, side);
      context.drawImage(bitmap, -cropX, -cropY, scaledWidth, scaledHeight);
      bitmap.close?.();
      const photoData = canvas.toDataURL('image/jpeg', 0.68);
      if (photoData.length > 220000) throw new Error('This photo is still too large after compression. Choose another photo.');
      setEmployeeValue('photoData', photoData);
    } catch (error) {
      setEmployeeFormError(error.message || 'Could not prepare the employee photo.');
    } finally { setPhotoBusy(false); event.target.value = ''; }
  };

  const saveEmployee = async event => {
    event.preventDefault();
    if (!employeeForm || busy || photoBusy) return;
    setBusy(true); setEmployeeFormError('');
    try {
      const body = {
        name: employeeForm.name.trim(),
        phone: employeeForm.phone.trim(),
        dateOfJoining: employeeForm.dateOfJoining,
        monthlySalary: Number(employeeForm.monthlySalary),
        jobRole: employeeForm.jobRole.trim(),
        salaryDueDay: Number(employeeForm.salaryDueDay),
        photoData: employeeForm.photoData || null,
      };
      if (employeeForm.aadhaar.trim()) body.aadhaar = employeeForm.aadhaar;
      else if (employeeForm.clearAadhaar) body.aadhaar = '';
      let result;
      if (editing) {
        if (employeeForm.isActive !== undefined) body.isActive = employeeForm.isActive;
        result = await apiRequest('/employees/' + selectedId, { method: 'PATCH', token, body });
      } else {
        result = await apiRequest('/employees', { method: 'POST', token, body });
      }
      setEmployeeModal(false);
      notify(editing ? 'Employee details updated.' : 'Employee added to the directory.', 'success');
      setRefreshKey(value => value + 1);
      if (editing) {
        const refreshed = await apiRequest('/employees/' + selectedId, { token });
        setDetail(refreshed);
      } else if (result.employee?.id) {
        await openDetail(result.employee);
      }
    } catch (error) {
      setEmployeeFormError(error.message || 'Employee could not be saved.');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const openExpense = employee => {
    const selected = employee?.employee || employee;
    setExpenseEmployeeId(String(selected?.id || ''));
    setExpenseForm({
      expenseDate: ymd(new Date()), description: '', category: 'Other',
      amount: '', settlementMode: 'COMPANY_PAID', paymentMode: 'CASH',
    });
    setExpenseFormError('');
    setExpenseModal(true);
  };
  const setExpenseValue = (key, value) => setExpenseForm(previous => ({ ...previous, [key]: value }));
  const saveExpense = async event => {
    event.preventDefault();
    if (!expenseForm || busy) return;
    setBusy(true); setExpenseFormError('');
    try {
      const body = {
        expenseDate: expenseForm.expenseDate,
        description: expenseForm.description.trim(),
        category: expenseForm.category.trim(),
        amount: Number(expenseForm.amount),
        settlementMode: expenseForm.settlementMode,
      };
      if (expenseForm.settlementMode === 'COMPANY_PAID') body.paymentMode = expenseForm.paymentMode;
      const result = await apiRequest('/employees/' + expenseEmployeeId + '/expenses', { method: 'POST', token, body });
      setExpenseModal(false);
      notify(result.message || 'Employee expense recorded.', 'success');
      setRefreshKey(value => value + 1);
      if (selectedId) {
        const refreshed = await apiRequest('/employees/' + selectedId, { token });
        setDetail(refreshed);
      }
    } catch (error) {
      setExpenseFormError(error.message || 'Expense could not be saved.');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const generatePayroll = async () => {
    if (busy) return;
    if (!window.confirm('Generate payroll for ' + monthLabel(month) + '? Existing payroll entries will not be overwritten.')) return;
    setBusy(true);
    try {
      const result = await apiRequest('/employees/payroll/generate', { method: 'POST', token, body: { month } });
      notify(result.message + ' New: ' + result.generated + ', already existed: ' + result.skipped + '.', 'success');
      setRefreshKey(value => value + 1);
    } catch (error) {
      notify(error.message || 'Payroll could not be generated.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setBusy(false); }
  };

  const setPayrollStatus = async (row, status) => {
    setSavingPayrollId(row.id);
    try {
      const result = await apiRequest('/employees/payroll/' + row.id, { method: 'PATCH', token, body: { status } });
      setPayroll(previous => previous.map(item => item.id === row.id ? result.payroll : item));
      notify(result.message || 'Payroll status updated.', 'success');
      setRefreshKey(value => value + 1);
    } catch (error) {
      notify(error.message || 'Payroll status could not be updated.', 'warning');
      if (error.status === 401 && onUnauthorized) onUnauthorized();
    } finally { setSavingPayrollId(null); }
  };

  const deactivateEmployee = async employee => {
    const nextActive = !Boolean(employee.isActive);
    if (!window.confirm((nextActive ? 'Reactivate ' : 'Deactivate ') + employee.name + '? Payroll and expense history will be retained.')) return;
    setBusy(true);
    try {
      await apiRequest('/employees/' + employee.id, { method: 'PATCH', token, body: { isActive: nextActive } });
      notify(nextActive ? 'Employee reactivated.' : 'Employee deactivated; history was retained.', 'success');
      setRefreshKey(value => value + 1);
      const data = await apiRequest('/employees/' + employee.id, { token });
      setDetail(data);
    } catch (error) {
      notify(error.message || 'Employee status could not be changed.', 'warning');
    } finally { setBusy(false); }
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return directory;
    return directory.filter(employee => [employee.name, employee.phone, employee.jobRole, employee.aadhaarLast4].some(value => String(value || '').toLowerCase().includes(query)));
  }, [directory, search]);

  const totalPayrollMonth = payroll.reduce((sum, row) => sum + Number(row.payableAmount || 0), 0);
  const paidPayrollMonth = payroll.filter(row => row.status === 'PAID').reduce((sum, row) => sum + Number(row.payableAmount || 0), 0);
  const unpaidPayrollMonth = payroll.filter(row => row.status !== 'PAID').reduce((sum, row) => sum + Number(row.payableAmount || 0), 0);
  const selectedEmployee = detail?.employee || null;

  if (auth?.user?.role !== 'Admin') {
    return <div className="employees-workspace"><EmptyPanel icon={ShieldCheck} title="Administrator access required" text="Employee identities, Aadhaar metadata and payroll are restricted to Admin accounts."/></div>;
  }

  return <div className="employees-workspace">
    <div className="employees-heading">
      <div className="employees-heading-copy">
        <div className="employee-eyebrow"><span className="employee-eyebrow-dot"/><span>PEOPLE OPERATIONS</span><span className="employee-eyebrow-divider">/</span><span>PAYROLL & BENEFITS</span></div>
        <h1>Employees <span className="employees-title-count">{summary?.activeEmployees ?? '—'}</span></h1>
        <p>One clean workspace for your team, monthly salaries and employee expenses.</p>
      </div>
      <div className="employees-heading-actions">
        <label className="employee-period-select"><CalendarDays size={16}/><select value={periodPreset} onChange={event => setPeriodPreset(event.target.value)} aria-label="Employee statistics period">
          <option value="7d">Last 7 days</option><option value="21d">Last 3 weeks</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="all">All time</option>
        </select><ChevronDown size={14}/></label>
        <ActionButton icon={Plus} variant="primary" onClick={openCreateEmployee}>Add employee</ActionButton>
      </div>
    </div>

    <div className="employees-security-note"><ShieldCheck size={16}/><span>Payroll and personal details are available to administrators only. Aadhaar is optional and encrypted before it is stored.</span></div>
    {pageError && <div className="employees-error-banner"><AlertTriangle size={17}/><span>{pageError.includes("doesn't exist") || pageError.includes('does not exist') ? pageError + ' Run database/phase6-employees-migration.sql in MySQL Workbench and restart the API.' : pageError}</span><ActionButton icon={RefreshCw} onClick={loadDirectory}>Retry</ActionButton></div>}

    <div className="employee-stats-grid">
      <StatCard icon={Users} label="Active employees" value={loading ? '—' : Number(summary?.activeEmployees || 0).toLocaleString('en-IN')} note="Current active directory" tone="violet"/>
      <StatCard icon={CheckCircle2} label="Salary paid" value={loading ? '—' : money(summary?.salaryPaid)} note={periodPreset === 'all' ? 'All recorded salary payments' : 'Paid within selected period'} tone="green"/>
      <StatCard icon={Clock3} label="Salary due" value={loading ? '—' : money(summary?.salaryDue)} note={periodPreset === 'all' ? 'All unpaid payroll due up to today' : 'Unpaid payroll due in selected period'} tone="blue"/>
      <StatCard icon={CircleDollarSign} label="Employee expenses" value={loading ? '—' : money(summary?.expensesTotal)} note={periodPreset === 'all' ? 'All recorded employee expenses' : 'Expenses within selected period'} tone="amber"/>
    </div>

    <div className="employee-subnav-wrap">
      <div className="employee-subnav" role="tablist" aria-label="Employee management views">
        <button type="button" className={tab === 'directory' ? 'active' : ''} onClick={() => setTab('directory')}><Contact size={16}/>Directory<span>{summary?.activeEmployees ?? 0}</span></button>
        <button type="button" className={tab === 'payroll' ? 'active' : ''} onClick={() => setTab('payroll')}><Wallet size={16}/>Payroll</button>
        <button type="button" className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}><FileText size={16}/>Expenses<span>{summary?.expenseCount ?? 0}</span></button>
      </div>
      <span className="employee-period-caption">Monthly salary commitment: {loading ? '—' : money(summary?.monthlyPayroll)} · {friendlyDate(period.from)} — {friendlyDate(period.to)}</span>
    </div>

    {tab === 'directory' && <section className="employee-panel">
      <div className="employee-panel-heading">
        <div><h2>Team directory</h2><p>Open any employee to view their profile, payroll history and expenses.</p></div>
        <div className="employee-toolbar-actions">
          <label className="employee-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, phone or role…"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={13}/></button>}</label>
          <label className="employee-check-filter"><input type="checkbox" checked={includeInactive} onChange={event => setIncludeInactive(event.target.checked)}/>Include inactive</label>
          <button className="employee-icon-action" onClick={refreshAll} title="Refresh directory" aria-label="Refresh directory"><RefreshCw size={16}/></button>
        </div>
      </div>
      {loading ? <div className="employee-loading"><LoaderCircle size={21}/>Loading employee records…</div> :
      filteredEmployees.length ? <div className="employee-table-scroll"><table className="employee-table">
        <thead><tr><th>EMPLOYEE</th><th>ROLE</th><th>PHONE</th><th>JOINED</th><th>MONTHLY SALARY</th><th>SALARY DUE</th><th>STATUS</th><th></th></tr></thead>
        <tbody>{filteredEmployees.map(employee => <tr key={employee.id} onDoubleClick={() => openDetail(employee)}>
          <td><button className="employee-person-cell" onClick={() => openDetail(employee)}><PersonAvatar employee={employee}/><span><b>{employee.name}</b><small>{employee.hasAadhaar ? 'Aadhaar •••• ' + employee.aadhaarLast4 : 'Employee ID · ' + employee.id}</small></span></button></td>
          <td><span className="employee-role-chip">{employee.jobRole}</span></td>
          <td className="employee-phone-cell">{employee.phone}</td>
          <td>{friendlyDate(employee.dateOfJoining)}</td>
          <td className="employee-money-cell">{money(employee.monthlySalary)}</td>
          <td>Monthly · {employee.salaryDueDay}{employee.salaryDueDay === 1 ? 'st' : employee.salaryDueDay === 2 ? 'nd' : employee.salaryDueDay === 3 ? 'rd' : 'th'}</td>
          <td><span className={'employee-directory-status ' + (employee.isActive ? 'active' : 'inactive')}><i/>{employee.isActive ? 'Active' : 'Inactive'}</span></td>
          <td><div className="employee-row-actions"><button className="employee-icon-action" title="Record expense" aria-label={'Record expense for ' + employee.name} onClick={() => openExpense(employee)}><CircleDollarSign size={15}/></button><button className="employee-icon-action" title="View details" aria-label={'View ' + employee.name} onClick={() => openDetail(employee)}><Eye size={15}/></button><button className="employee-icon-action" title="More actions" aria-label={'More actions for ' + employee.name} onClick={() => openDetail(employee)}><MoreHorizontal size={15}/></button></div></td>
        </tr>)}</tbody>
      </table></div> : <EmptyPanel icon={Users} title={search ? 'No matching employees' : 'Your team starts here'} text={search ? 'Try a different employee name, phone or job role.' : 'Add your first employee to start tracking salaries, expenses and monthly payment status.'} action={!search && <ActionButton icon={Plus} variant="primary" onClick={openCreateEmployee}>Add first employee</ActionButton>}/>}
      <div className="employee-panel-footer"><span>{filteredEmployees.length} employee{filteredEmployees.length === 1 ? '' : 's'} shown</span><span>Monthly salaries are stored as records; payroll is generated separately for each month.</span></div>
    </section>}

    {tab === 'payroll' && <section className="employee-panel">
      <div className="employee-panel-heading employee-payroll-heading">
        <div><h2>Monthly payroll</h2><p>Generate a month once, review deductions and mark salaries paid or unpaid.</p></div>
        <div className="employee-toolbar-actions employee-payroll-actions"><label className="employee-month-input"><CalendarDays size={15}/><input type="month" value={month} onChange={event => setMonth(event.target.value)}/></label><ActionButton icon={Plus} variant="primary" disabled={busy || !directory.length} onClick={generatePayroll}>{busy ? 'Processing…' : 'Generate payroll'}</ActionButton></div>
      </div>
      <div className="employee-payroll-summary">
        <div><span>Net payroll</span><b>{money(totalPayrollMonth)}</b><small>{monthLabel(month)}</small></div>
        <div><span>Paid</span><b className="employee-positive">{money(paidPayrollMonth)}</b><small>{payroll.filter(row => row.status === 'PAID').length} employees marked paid</small></div>
        <div><span>Unpaid</span><b className={unpaidPayrollMonth > 0 ? 'employee-negative' : ''}>{money(unpaidPayrollMonth)}</b><small>{payroll.filter(row => row.status !== 'PAID').length} payments pending</small></div>
      </div>
      {payrollLoading ? <div className="employee-loading"><LoaderCircle size={21}/>Loading payroll…</div> :
      payroll.length ? <div className="employee-table-scroll"><table className="employee-table employee-payroll-table"><thead><tr><th>EMPLOYEE</th><th>BASE SALARY</th><th>DEDUCTIONS</th><th>NET PAYABLE</th><th>DUE DATE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{payroll.map(row => <tr key={row.id}>
        <td><button className="employee-person-cell" onClick={() => openDetail({ id: row.employeeId })}><PersonAvatar employee={{ name: row.employeeName, photoData: row.photoData }}/><span><b>{row.employeeName}</b><small>{row.jobRole}</small></span></button></td>
        <td className="employee-money-cell">{money(row.baseSalary)}</td><td className={Number(row.deductions) > 0 ? 'employee-negative employee-money-cell' : 'employee-money-cell'}>{Number(row.deductions) > 0 ? '−' : ''}{money(row.deductions)}</td>
        <td className="employee-money-cell employee-net-cell">{money(row.payableAmount)}</td><td>{friendlyDate(row.dueDate)}</td><td><PayrollStatus status={row.status}/>{row.paidAt && <small className="employee-cell-sub">Paid {friendlyDate(row.paidAt)}</small>}</td>
        <td>{row.status === 'PAID' ? <button className="employee-mark-unpaid" disabled={savingPayrollId === row.id} onClick={() => setPayrollStatus(row, 'UNPAID')}>{savingPayrollId === row.id ? 'Saving…' : 'Mark unpaid'}</button> : <button className="employee-mark-paid" disabled={savingPayrollId === row.id} onClick={() => setPayrollStatus(row, 'PAID')}><Check size={14}/>{savingPayrollId === row.id ? 'Saving…' : 'Mark paid'}</button>}</td>
      </tr>)}</tbody></table></div> :
      <EmptyPanel icon={CalendarDays} title={'Payroll not generated for ' + monthLabel(month)} text="Generate this month's payroll to snapshot each active employee's salary and apply any deductions scheduled for this month. Existing payroll months are never overwritten." action={<ActionButton icon={Plus} variant="primary" disabled={busy || !directory.length} onClick={generatePayroll}>Generate payroll</ActionButton>}/>}
      <div className="employee-panel-footer"><span>Payroll month: {monthLabel(month)}</span><span>Once generated, payroll amounts are snapshots. Add deductions before generating the applicable month.</span></div>
    </section>}

    {tab === 'expenses' && <section className="employee-panel">
      <div className="employee-panel-heading"><div><h2>Employee expenses</h2><p>Track company-paid expenses and deductions from future salary.</p></div><ActionButton icon={Plus} variant="primary" onClick={() => openExpense(null)}>Add expense</ActionButton></div>
      {expensesLoading ? <div className="employee-loading"><LoaderCircle size={21}/>Loading employee expenses…</div> :
      expenses.length ? <div className="employee-table-scroll"><table className="employee-table employee-expense-table"><thead><tr><th>DATE</th><th>EMPLOYEE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>TREATMENT</th><th>PAYMENT / DEDUCTION</th></tr></thead><tbody>{expenses.map(row => <tr key={row.id}>
        <td>{friendlyDate(row.expenseDate)}</td><td><button className="employee-text-link" onClick={() => openDetail({ id: row.employeeId })}>{row.employeeName}</button></td>
        <td><b>{row.description}</b><small className="employee-cell-sub">{row.category}</small></td><td className="employee-money-cell">{money(row.amount)}</td>
        <td><span className={'employee-expense-mode ' + (row.settlementMode === 'DEDUCT_NEXT_MONTH' ? 'deduction' : 'company')}>{row.settlementMode === 'DEDUCT_NEXT_MONTH' ? <><TrendingDown size={13}/> Salary deduction</> : <><CheckCircle2 size={13}/> Company paid</>}</span></td>
        <td>{row.settlementMode === 'DEDUCT_NEXT_MONTH' ? 'Scheduled · ' + monthLabel(row.deductionMonth) : row.paymentMode ? row.paymentMode.replace('_', ' ') : '—'}</td>
      </tr>)}</tbody></table></div> : <EmptyPanel icon={FileText} title="No employee expenses in this period" text="Add an expense to record a reimbursement, a company-paid cost, or an amount to deduct from next month's salary." action={<ActionButton icon={Plus} variant="primary" onClick={() => openExpense(null)}>Add expense</ActionButton>}/>}
      <div className="employee-panel-footer"><span>{expenses.length} expense record{expenses.length === 1 ? '' : 's'} in selected period</span><span>Changing the period filters expenses and summary totals; the employee directory remains intact.</span></div>
    </section>}

    {selectedId != null && <div className="employee-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !employeeModal && !expenseModal) { setSelectedId(null); setDetail(null); } }}>
      <section className="employee-detail-modal" role="dialog" aria-modal="true" aria-label="Employee details">
        <div className="employee-detail-top">
          <div className="employee-detail-identity">{detailLoading && !detail ? <span className="employee-detail-skeleton"/> : <PersonAvatar employee={selectedEmployee} large/>}<div><div className="employee-eyebrow">EMPLOYEE PROFILE</div><h2>{selectedEmployee?.name || 'Loading employee…'}</h2><p>{selectedEmployee?.jobRole || 'Loading details'}{selectedEmployee?.id ? ' · ID ' + selectedEmployee.id : ''}</p></div></div>
          <div className="employee-detail-actions">{selectedEmployee && <><ActionButton icon={CircleDollarSign} onClick={() => openExpense(selectedEmployee)}>Add expense</ActionButton><ActionButton icon={Pencil} onClick={() => openEditEmployee(detail)}>Edit</ActionButton></>}<button className="employee-icon-action" onClick={() => { setSelectedId(null); setDetail(null); }} aria-label="Close employee details"><X size={18}/></button></div>
        </div>
        {detailLoading && !detail ? <div className="employee-loading"><LoaderCircle size={22}/>Loading profile, payroll and expense history…</div> : selectedEmployee && <>
          <div className="employee-detail-metrics">
            <div><span>Monthly salary</span><strong>{money(selectedEmployee.monthlySalary)}</strong></div>
            <div><span>Salary due</span><strong>Every {selectedEmployee.salaryDueDay}{selectedEmployee.salaryDueDay === 1 ? 'st' : selectedEmployee.salaryDueDay === 2 ? 'nd' : selectedEmployee.salaryDueDay === 3 ? 'rd' : 'th'}</strong><small>of each month</small></div>
            <div><span>Latest payroll</span><strong>{detail.payroll?.[0] ? money(detail.payroll[0].payableAmount) : '—'}</strong><small>{detail.payroll?.[0] ? monthLabel(detail.payroll[0].payrollMonth) + ' · ' + (detail.payroll[0].status === 'PAID' ? 'paid' : 'unpaid') : 'Not generated yet'}</small></div>
          </div>
          <div className="employee-detail-content">
            <section className="employee-detail-section"><div className="employee-detail-section-head"><h3>Personal & employment details</h3><span className={'employee-directory-status ' + (selectedEmployee.isActive ? 'active' : 'inactive')}><i/>{selectedEmployee.isActive ? 'Active' : 'Inactive'}</span></div>
              <div className="employee-fact-grid">
                <div><small>Phone number</small><b>{selectedEmployee.phone}</b></div><div><small>Date of joining</small><b>{friendlyDate(selectedEmployee.dateOfJoining)}</b></div>
                <div><small>Aadhaar</small><b>{selectedEmployee.hasAadhaar ? '•••• •••• ' + selectedEmployee.aadhaarLast4 : 'Not provided'}</b></div>
                <div><small>Employee role</small><b>{selectedEmployee.jobRole}</b></div>
              </div>
              <div className="employee-detail-footer-actions"><ActionButton icon={selectedEmployee.isActive ? Trash2 : CheckCircle2} variant="secondary" disabled={busy} onClick={() => deactivateEmployee(selectedEmployee)}>{selectedEmployee.isActive ? 'Deactivate employee' : 'Reactivate employee'}</ActionButton><span>Deactivation preserves all previous payroll and expense records.</span></div>
            </section>
            <section className="employee-detail-section"><div className="employee-detail-section-head"><h3>Salary history</h3><button className="employee-text-link" onClick={() => { setTab('payroll'); setMonth(monthNow()); setSelectedId(null); setDetail(null); }}>Open payroll</button></div>
              {detail.payroll?.length ? <div className="employee-mini-history">{detail.payroll.slice(0, 6).map(row => <div key={row.id}><span><b>{monthLabel(row.payrollMonth)}</b><small>{row.deductions > 0 ? 'Includes ' + money(row.deductions) + ' deductions' : 'No salary deductions'}</small></span><span><b>{money(row.payableAmount)}</b><PayrollStatus status={row.status}/></span></div>)}</div> : <p className="employee-detail-empty">Monthly salary records appear here after payroll is generated.</p>}
            </section>
            <section className="employee-detail-section"><div className="employee-detail-section-head"><h3>Recent expenses</h3><button className="employee-text-link" onClick={() => { setTab('expenses'); setSelectedId(null); setDetail(null); }}>View expense register</button></div>
              {detail.expenses?.length ? <div className="employee-mini-history">{detail.expenses.slice(0, 6).map(row => <div key={row.id}><span><b>{row.description}</b><small>{friendlyDate(row.expenseDate)} · {row.category}</small></span><span><b>{money(row.amount)}</b><small className={row.settlementMode === 'DEDUCT_NEXT_MONTH' ? 'employee-negative' : 'employee-positive'}>{row.settlementMode === 'DEDUCT_NEXT_MONTH' ? 'Deduct · ' + monthLabel(row.deductionMonth) : 'Company paid'}</small></span></div>)}</div> : <p className="employee-detail-empty">No expense records for this employee yet.</p>}
            </section>
            {detail.deductions?.length > 0 && <section className="employee-detail-section"><div className="employee-detail-section-head"><h3>Applied salary deductions</h3><span>{detail.deductions.length} allocations</span></div><div className="employee-mini-history">{detail.deductions.slice(0, 10).map(row => <div key={row.payrollId + '-' + row.expenseId}><span><b>{row.description}</b><small>Salary month · {monthLabel(row.scheduledMonth)}</small></span><b className="employee-negative">{money(row.amount)}</b></div>)}</div></section>}
          </div>
        </>}
      </section>
    </div>}

    {employeeModal && employeeForm && <div className="employee-overlay employee-form-overlay"><form className="employee-form-modal" onSubmit={saveEmployee}>
      <div className="employee-modal-head"><div><div className="employee-eyebrow">{editing ? 'EDIT PROFILE' : 'NEW TEAM MEMBER'}</div><h2>{editing ? 'Edit employee' : 'Add an employee'}</h2><p>Complete the core details now; you can update the profile later.</p></div><button className="employee-icon-action" type="button" onClick={() => setEmployeeModal(false)} aria-label="Close form"><X size={18}/></button></div>
      {employeeFormError && <div className="employee-inline-error"><AlertTriangle size={15}/>{employeeFormError}</div>}
      <div className="employee-photo-upload"><div className="employee-photo-large">{employeeForm.photoData ? <img src={employeeForm.photoData} alt="Employee preview"/> : <span><ImagePlus size={23}/></span>}</div><div><b>Employee photo</b><p>Square headshot recommended. The browser compresses your image before saving.</p><label className="employee-file-button"><ImagePlus size={15}/>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} disabled={busy || photoBusy} hidden/></label>{employeeForm.photoData && <button className="employee-text-link employee-remove-photo" type="button" onClick={() => setEmployeeValue('photoData','')}>Remove photo</button>}</div></div>
      <div className="employee-form-grid">
        <FormField label="Full name" required><input required maxLength={180} autoFocus value={employeeForm.name} onChange={event => setEmployeeValue('name', event.target.value)} placeholder="e.g. Priya Sharma"/></FormField>
        <FormField label="Phone number" required><input required type="tel" maxLength={24} value={employeeForm.phone} onChange={event => setEmployeeValue('phone', event.target.value)} placeholder="+91 98765 43210"/></FormField>
        <FormField label="Job role / designation" required><input required maxLength={100} value={employeeForm.jobRole} onChange={event => setEmployeeValue('jobRole', event.target.value)} placeholder="e.g. Store associate"/></FormField>
        <FormField label="Date of joining" required><input required type="date" value={employeeForm.dateOfJoining} onChange={event => setEmployeeValue('dateOfJoining', event.target.value)}/></FormField>
        <FormField label="Monthly salary (₹)" required><input required type="number" min="0" max="99999999999999" step="0.01" value={employeeForm.monthlySalary} onChange={event => setEmployeeValue('monthlySalary', event.target.value)} placeholder="e.g. 18000.00"/></FormField>
        <FormField label="Salary due day" required hint="Recurring day each month (1–28)."><select required value={employeeForm.salaryDueDay} onChange={event => setEmployeeValue('salaryDueDay', event.target.value)}>{Array.from({length:28}, (_,index) => index+1).map(day => <option key={day} value={day}>{day}{day===1?'st':day===2?'nd':day===3?'rd':'th'} of each month</option>)}</select></FormField>
        <FormField label="Aadhaar number (optional)" full hint={employeeForm.aadhaarLast4 && !employeeForm.clearAadhaar ? 'Saved securely •••• ' + employeeForm.aadhaarLast4 + '. Leave blank to keep it.' : 'Stored encrypted, never displayed in full. Requires the server encryption key.'}><input type="password" inputMode="numeric" autoComplete="off" maxLength={14} value={employeeForm.aadhaar} onChange={event => setEmployeeValue('aadhaar', event.target.value)} placeholder="12 digits (optional)"/>{editing && employeeForm.aadhaarLast4 && <label className="employee-clear-aadhaar"><input type="checkbox" checked={employeeForm.clearAadhaar} onChange={event => setEmployeeValue('clearAadhaar', event.target.checked)}/>Remove saved Aadhaar number</label>}</FormField>
        {editing && <FormField label="Employment status"><select value={employeeForm.isActive ? 'active' : 'inactive'} onChange={event => setEmployeeValue('isActive', event.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>}
      </div>
      <div className="employee-form-footer"><span><ShieldCheck size={14}/> Aadhaar is optional and encrypted at rest.</span><div><ActionButton type="button" disabled={busy} onClick={() => setEmployeeModal(false)}>Cancel</ActionButton><ActionButton type="submit" icon={Check} variant="primary" disabled={busy || photoBusy}>{busy ? 'Saving…' : photoBusy ? 'Preparing photo…' : editing ? 'Save changes' : 'Create employee'}</ActionButton></div></div>
    </form></div>}

    {expenseModal && expenseForm && <div className="employee-overlay employee-form-overlay"><form className="employee-form-modal employee-expense-modal" onSubmit={saveExpense}>
      <div className="employee-modal-head"><div><div className="employee-eyebrow">EXPENSE MANAGEMENT</div><h2>Record an employee expense</h2><p>Company-paid costs are tracked separately from salary deductions.</p></div><button className="employee-icon-action" type="button" onClick={() => setExpenseModal(false)} aria-label="Close expense form"><X size={18}/></button></div>
      {expenseFormError && <div className="employee-inline-error"><AlertTriangle size={15}/>{expenseFormError}</div>}
      <div className="employee-form-grid">
        <FormField label="Employee" required full><select required value={expenseEmployeeId} onChange={event => setExpenseEmployeeId(event.target.value)}><option value="">Select employee…</option>{directory.map(employee => <option key={employee.id} value={employee.id}>{employee.name}{employee.isActive ? '' : ' · inactive'}</option>)}</select></FormField>
        <FormField label="Expense date" required><input required type="date" value={expenseForm.expenseDate} onChange={event => setExpenseValue('expenseDate', event.target.value)}/></FormField>
        <FormField label="Amount (₹)" required><input required type="number" min="0.01" max="99999999999999" step="0.01" value={expenseForm.amount} onChange={event => setExpenseValue('amount', event.target.value)} placeholder="0.00"/></FormField>
        <FormField label="Description" required><input required maxLength={255} value={expenseForm.description} onChange={event => setExpenseValue('description', event.target.value)} placeholder="e.g. Uniform purchase"/></FormField>
        <FormField label="Category" required><select required value={expenseForm.category} onChange={event => setExpenseValue('category', event.target.value)}>{['Other','Travel','Uniform','Meals','Medical','Advance','Tools & supplies','Reimbursement','Training','Shortage / adjustment'].map(value => <option key={value} value={value}>{value}</option>)}</select></FormField>
        <FormField label="Expense treatment" required full><div className="employee-settlement-options">
          <button type="button" className={expenseForm.settlementMode === 'COMPANY_PAID' ? 'selected' : ''} onClick={() => setExpenseValue('settlementMode','COMPANY_PAID')}><Wallet size={17}/><span><b>Company paid</b><small>Recorded as an expense; does not reduce salary.</small></span>{expenseForm.settlementMode === 'COMPANY_PAID' && <CheckCircle2 size={16}/>}</button>
          <button type="button" className={expenseForm.settlementMode === 'DEDUCT_NEXT_MONTH' ? 'selected' : ''} onClick={() => setExpenseValue('settlementMode','DEDUCT_NEXT_MONTH')}><TrendingDown size={17}/><span><b>Deduct from salary</b><small>Reduces the next month's salary; remainder rolls forward.</small></span>{expenseForm.settlementMode === 'DEDUCT_NEXT_MONTH' && <CheckCircle2 size={16}/>}</button>
        </div></FormField>
        {expenseForm.settlementMode === 'COMPANY_PAID' ? <FormField label="Payment method" required><select required value={expenseForm.paymentMode} onChange={event => setExpenseValue('paymentMode', event.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></select></FormField> : <div className="employee-deduction-note"><TrendingDown size={16}/><span>This will be scheduled for <b>{monthLabel((() => {const date=new Date(expenseForm.expenseDate+'T12:00:00');date.setDate(1);date.setMonth(date.getMonth()+1);return ymd(date).slice(0,7);})())}</b> payroll. If deductions exceed the employee's net salary, the unpaid remainder carries to later months.</span></div>}
      </div>
      <div className="employee-form-footer"><span><ShieldCheck size={14}/> Entries are recorded in the audit log.</span><div><ActionButton type="button" disabled={busy} onClick={() => setExpenseModal(false)}>Cancel</ActionButton><ActionButton type="submit" icon={Check} variant="primary" disabled={busy || !expenseEmployeeId}>{busy ? 'Saving…' : 'Save expense'}</ActionButton></div></div>
    </form></div>}
  </div>;
}
