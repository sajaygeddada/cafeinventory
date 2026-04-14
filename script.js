// =============================================
//  Sajay's Café — Inventory Manager
//  script.js
// =============================================

// ─── CONFIG ───────────────────────────────────
const SUPABASE_URL  = 'https://cebhmyeelkndpyoysswg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYmhteWVlbGtuZHB5b3lzc3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzYyOTYsImV4cCI6MjA5MTc1MjI5Nn0._46DfnsLqxgngXhV6xjevYkBZtBjlQCKSNIPtck9Vac';

const ADMIN_USERNAME = 'sajaygeddada';
// Password is hashed & stored in localStorage on first run.
// Default password (change after first login): sajaysCafe@2026
const DEFAULT_PASSWORD_HASH = btoa('123456789'); // simple base64 for demo; see note in README

// ─── SUPABASE INIT ────────────────────────────
let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
} catch(e) {
  console.warn('Supabase init failed. Running in offline/local mode.', e);
}

// ─── STATE ────────────────────────────────────
let allInventory  = [];
let allExpenses   = [];
let allBills      = [];
let rentConfig    = null;
let pendingDelete = null;
let billModalPreset = {};

// ─── INIT ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'long', year:'numeric' });

  // Set today as default for date inputs
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('exp-date').value = today;
  document.getElementById('bill-duedate').value = today;
  document.getElementById('bill-month').value = today.slice(0,7);

  checkSession();
  updateDBStatus();
  // restore saved theme
const savedTheme = localStorage.getItem('sc_theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = savedTheme === 'light' ? '☀️ Light' : '🌙 Dark';
}
});

// ─── AUTH ─────────────────────────────────────
function checkSession() {
  const sess = sessionStorage.getItem('sc_auth');
  if (sess === 'ok') showApp();
}

function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;

  if (user !== ADMIN_USERNAME) return showLoginError();

  try {
    const stored = localStorage.getItem('sc_pw') || DEFAULT_PASSWORD_HASH;
    if (btoa(unescape(encodeURIComponent(pass))) !== stored) return showLoginError();
  } catch(e) {
    return showLoginError();
  }

  document.getElementById('login-error').classList.add('hidden');
  sessionStorage.setItem('sc_auth', 'ok');
  showApp();
}

function showLoginError() {
  document.getElementById('login-error').classList.remove('hidden');
  document.getElementById('login-pass').value = '';
}

function handleLogout() {
  sessionStorage.removeItem('sc_auth');
  location.reload();
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  loadAll();
}

// allow pressing Enter on login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) {
    handleLogin();
  }
});

// ─── DB STATUS ────────────────────────────────
async function updateDBStatus() {
  const el = document.getElementById('db-status');
  if (!sb || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    el.textContent = '● DB not configured';
    el.className = 'db-status error';
    return;
  }
  try {
    const { error } = await sb.from('inventory').select('id').limit(1);
    if (error) throw error;
    el.textContent = '● Supabase Connected';
    el.className = 'db-status connected';
  } catch {
    el.textContent = '● DB error';
    el.className = 'db-status error';
  }
}

// ─── LOAD ALL ─────────────────────────────────
async function loadAll() {
  await Promise.all([
    loadInventory(),
    loadExpenses(),
    loadBills(),
    loadRent(),
  ]);
  renderDashboard();
  populateMonthFilters();
  populateLogMonths();
}

// ─── TAB SWITCHING ────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  btn.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    expenses:  'Expenses',
    bills:     'Bills & Rent',
    restock:   'Restock List',
    log:       'Monthly Log',
  };
  document.getElementById('page-title').textContent = titles[name] || name;

  if (name === 'restock')   renderRestockList();
  if (name === 'log')       renderMonthlyLog();
  if (name === 'dashboard') renderDashboard();
  if (name === 'bills')     renderBillsTab();
}

// ─── INVENTORY ────────────────────────────────
async function loadInventory() {
  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    const { data, error } = await sb.from('inventory').select('*').order('name');
    if (!error) allInventory = data || [];
  } else {
    allInventory = JSON.parse(localStorage.getItem('sc_inventory') || '[]');
  }
  renderInventoryTable(allInventory);
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('inv-tbody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📦</div>No inventory items yet. Add your first item!</div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(i => {
    const qty = parseFloat(i.quantity) || 0;
    const min = parseFloat(i.min_stock) || 0;
    let status, statusClass;
    if (qty === 0)          { status = 'Out of Stock'; statusClass = 'status-out'; }
    else if (qty <= min)    { status = 'Low Stock';    statusClass = 'status-low'; }
    else                    { status = 'In Stock';     statusClass = 'status-ok';  }
    return `
    <tr>
      <td><strong>${esc(i.name)}</strong></td>
      <td>${esc(i.category || '—')}</td>
      <td>${qty}</td>
      <td>${esc(i.unit || '')}</td>
      <td>${min}</td>
      <td>${i.cost_per_unit ? '₹' + parseFloat(i.cost_per_unit).toFixed(2) : '—'}</td>
      <td>${esc(i.supplier || '—')}</td>
      <td><span class="${statusClass}">${status}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editInventory('${i.id}')">✏️</button>
          <button class="btn-del"  onclick="confirmDelete('inventory','${i.id}','${esc(i.name)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterInventory() {
  const q    = document.getElementById('inv-search').value.toLowerCase();
  const cat  = document.getElementById('inv-category-filter').value;
  const filtered = allInventory.filter(i =>
    (!q   || i.name.toLowerCase().includes(q) || (i.supplier||'').toLowerCase().includes(q)) &&
    (!cat || i.category === cat)
  );
  renderInventoryTable(filtered);
}

function openModal(id, preset) {
  if (id === 'bill-modal' && preset) billModalPreset = preset;
  document.getElementById(id).classList.remove('hidden');
  if (id === 'bill-modal' && preset && preset.type) {
    document.getElementById('bill-type').value = preset.type;
  }
  if (id === 'inv-modal') {
    document.getElementById('inv-modal-title').textContent = 'Add Inventory Item';
    clearInvForm();
  }
  if (id === 'exp-modal') {
    document.getElementById('exp-modal-title').textContent = 'Add Expense';
    clearExpForm();
  }
  if (id === 'bill-modal') {
    document.getElementById('bill-modal-title').textContent = 'Add Bill';
    clearBillForm();
  }
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function clearInvForm() {
  ['inv-edit-id','inv-name','inv-qty','inv-minstock','inv-cost','inv-supplier','inv-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('inv-cat').value  = 'Beverages';
  document.getElementById('inv-unit').value = 'kg';
}

async function saveInventory() {
  const id       = document.getElementById('inv-edit-id').value;
  const name     = document.getElementById('inv-name').value.trim();
  const category = document.getElementById('inv-cat').value;
  const quantity = parseFloat(document.getElementById('inv-qty').value) || 0;
  const unit     = document.getElementById('inv-unit').value;
  const min_stock= parseFloat(document.getElementById('inv-minstock').value) || 0;
  const cost     = parseFloat(document.getElementById('inv-cost').value) || 0;
  const supplier = document.getElementById('inv-supplier').value.trim();
  const notes    = document.getElementById('inv-notes').value.trim();

  if (!name) return showToast('Item name is required', 'error');

  const record = { name, category, quantity, unit, min_stock, cost_per_unit: cost, supplier, notes };

  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    if (id) {
      await sb.from('inventory').update(record).eq('id', id);
    } else {
      await sb.from('inventory').insert([record]);
    }
  } else {
    if (id) {
      const idx = allInventory.findIndex(i => i.id === id);
      if (idx >= 0) allInventory[idx] = { ...allInventory[idx], ...record };
    } else {
      allInventory.push({ ...record, id: uid() });
    }
    localStorage.setItem('sc_inventory', JSON.stringify(allInventory));
  }

  closeModal('inv-modal');
  await loadInventory();
  renderDashboard();
  showToast(id ? 'Item updated!' : 'Item added!', 'success');
}

function editInventory(id) {
  const item = allInventory.find(i => i.id === id);
  if (!item) return;
  document.getElementById('inv-modal-title').textContent = 'Edit Inventory Item';
  document.getElementById('inv-edit-id').value   = item.id;
  document.getElementById('inv-name').value      = item.name;
  document.getElementById('inv-cat').value       = item.category || 'Other';
  document.getElementById('inv-qty').value       = item.quantity;
  document.getElementById('inv-unit').value      = item.unit || 'kg';
  document.getElementById('inv-minstock').value  = item.min_stock || 0;
  document.getElementById('inv-cost').value      = item.cost_per_unit || '';
  document.getElementById('inv-supplier').value  = item.supplier || '';
  document.getElementById('inv-notes').value     = item.notes || '';
  document.getElementById('inv-modal').classList.remove('hidden');
}

// ─── EXPENSES ─────────────────────────────────
async function loadExpenses() {
  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    const { data, error } = await sb.from('expenses').select('*').order('date', { ascending: false });
    if (!error) allExpenses = data || [];
  } else {
    allExpenses = JSON.parse(localStorage.getItem('sc_expenses') || '[]');
  }
  renderExpensesTable(allExpenses);
}

function renderExpensesTable(items) {
  const tbody = document.getElementById('exp-tbody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💸</div>No expenses recorded yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td>${esc(e.description)}</td>
      <td>${esc(e.category || '—')}</td>
      <td><strong>₹${parseFloat(e.amount).toFixed(2)}</strong></td>
      <td>${esc(e.paid_by || '—')}</td>
      <td>${esc(e.notes || '—')}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editExpense('${e.id}')">✏️</button>
          <button class="btn-del"  onclick="confirmDelete('expense','${e.id}','${esc(e.description)}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterExpenses() {
  const q     = document.getElementById('exp-search').value.toLowerCase();
  const month = document.getElementById('exp-month-filter').value;
  const filtered = allExpenses.filter(e =>
    (!q     || (e.description||'').toLowerCase().includes(q) || (e.category||'').toLowerCase().includes(q)) &&
    (!month || (e.date||'').startsWith(month))
  );
  renderExpensesTable(filtered);
}

function clearExpForm() {
  ['exp-edit-id','exp-desc','exp-amount','exp-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('exp-cat').value    = 'Supplies';
  document.getElementById('exp-paidby').value = 'Cash';
  document.getElementById('exp-date').value   = new Date().toISOString().split('T')[0];
}

async function saveExpense() {
  const id   = document.getElementById('exp-edit-id').value;
  const date = document.getElementById('exp-date').value;
  const desc = document.getElementById('exp-desc').value.trim();
  const cat  = document.getElementById('exp-cat').value;
  const amt  = parseFloat(document.getElementById('exp-amount').value) || 0;
  const paid = document.getElementById('exp-paidby').value;
  const note = document.getElementById('exp-notes').value.trim();

  if (!desc)  return showToast('Description is required', 'error');
  if (amt <= 0) return showToast('Enter a valid amount', 'error');

  const record = { date, description: desc, category: cat, amount: amt, paid_by: paid, notes: note };

  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    if (id) {
      await sb.from('expenses').update(record).eq('id', id);
    } else {
      await sb.from('expenses').insert([record]);
    }
  } else {
    if (id) {
      const idx = allExpenses.findIndex(e => e.id === id);
      if (idx >= 0) allExpenses[idx] = { ...allExpenses[idx], ...record };
    } else {
      allExpenses.push({ ...record, id: uid() });
    }
    allExpenses.sort((a,b) => b.date.localeCompare(a.date));
    localStorage.setItem('sc_expenses', JSON.stringify(allExpenses));
  }

  closeModal('exp-modal');
  await loadExpenses();
  renderDashboard();
  populateMonthFilters();
  populateLogMonths();
  showToast(id ? 'Expense updated!' : 'Expense recorded!', 'success');
}

function editExpense(id) {
  const e = allExpenses.find(x => x.id === id);
  if (!e) return;
  document.getElementById('exp-modal-title').textContent = 'Edit Expense';
  document.getElementById('exp-edit-id').value   = e.id;
  document.getElementById('exp-date').value      = e.date;
  document.getElementById('exp-desc').value      = e.description;
  document.getElementById('exp-cat').value       = e.category;
  document.getElementById('exp-amount').value    = e.amount;
  document.getElementById('exp-paidby').value    = e.paid_by || 'Cash';
  document.getElementById('exp-notes').value     = e.notes || '';
  document.getElementById('exp-modal').classList.remove('hidden');
}

// ─── BILLS ────────────────────────────────────
async function loadBills() {
  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    const { data, error } = await sb.from('bills').select('*').order('month_year', { ascending: false });
    if (!error) allBills = data || [];
  } else {
    allBills = JSON.parse(localStorage.getItem('sc_bills') || '[]');
  }
  renderBillsTab();
}

function renderBillsTab() {
  // Mini lists
  const types = ['Electricity','Water','Other'];
  const ids   = ['elec-list','water-list','other-list'];
  types.forEach((type, i) => {
    const subset = allBills.filter(b => type === 'Other' ? !['Electricity','Water'].includes(b.type) : b.type === type);
    const el = document.getElementById(ids[i]);
    if (!el) return;
    if (!subset.length) {
      el.innerHTML = '<div class="empty-state" style="padding:0.75rem;font-size:0.8rem">No records yet</div>';
      return;
    }
    el.innerHTML = subset.slice(0,4).map(b => `
      <div class="bill-mini-row">
        <span>${b.month_year}</span>
        <span>₹${parseFloat(b.amount).toFixed(0)}</span>
        <span class="${b.paid === 'Paid' ? 'paid-badge' : 'unpaid-badge'}">${b.paid}</span>
      </div>`).join('');
  });

  // Full table
  const tbody = document.getElementById('bills-tbody');
  if (!allBills.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🧾</div>No bills recorded yet.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = allBills.map(b => `
    <tr>
      <td>${esc(b.month_year)}</td>
      <td>${esc(b.type)}</td>
      <td><strong>₹${parseFloat(b.amount).toFixed(2)}</strong></td>
      <td>${b.due_date ? formatDate(b.due_date) : '—'}</td>
      <td><span class="${b.paid==='Paid'?'paid-badge':'unpaid-badge'}">${b.paid}</span></td>
      <td>${esc(b.notes || '—')}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editBill('${b.id}')">✏️</button>
          <button class="btn-del"  onclick="confirmDelete('bill','${b.id}','${esc(b.type)} bill')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function clearBillForm() {
  ['bill-edit-id','bill-amount','bill-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bill-type').value   = 'Electricity';
  document.getElementById('bill-paid').value   = 'Unpaid';
  document.getElementById('bill-month').value  = new Date().toISOString().slice(0,7);
  document.getElementById('bill-duedate').value= '';
}

async function saveBill() {
  const id      = document.getElementById('bill-edit-id').value;
  const type    = document.getElementById('bill-type').value;
  const month   = document.getElementById('bill-month').value;
  const amount  = parseFloat(document.getElementById('bill-amount').value) || 0;
  const duedate = document.getElementById('bill-duedate').value;
  const paid    = document.getElementById('bill-paid').value;
  const notes   = document.getElementById('bill-notes').value.trim();

  if (amount <= 0) return showToast('Enter a valid amount', 'error');

  const record = { type, month_year: month, amount, due_date: duedate || null, paid, notes };

  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    if (id) {
      await sb.from('bills').update(record).eq('id', id);
    } else {
      await sb.from('bills').insert([record]);
    }
  } else {
    if (id) {
      const idx = allBills.findIndex(b => b.id === id);
      if (idx >= 0) allBills[idx] = { ...allBills[idx], ...record };
    } else {
      allBills.push({ ...record, id: uid() });
    }
    localStorage.setItem('sc_bills', JSON.stringify(allBills));
  }

  closeModal('bill-modal');
  await loadBills();
  renderDashboard();
  showToast(id ? 'Bill updated!' : 'Bill saved!', 'success');
}

function editBill(id) {
  const b = allBills.find(x => x.id === id);
  if (!b) return;
  document.getElementById('bill-modal-title').textContent = 'Edit Bill';
  document.getElementById('bill-edit-id').value  = b.id;
  document.getElementById('bill-type').value     = b.type;
  document.getElementById('bill-month').value    = b.month_year;
  document.getElementById('bill-amount').value   = b.amount;
  document.getElementById('bill-duedate').value  = b.due_date || '';
  document.getElementById('bill-paid').value     = b.paid;
  document.getElementById('bill-notes').value    = b.notes || '';
  document.getElementById('bill-modal').classList.remove('hidden');
}

// ─── RENT ─────────────────────────────────────
async function loadRent() {
  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    const { data } = await sb.from('rent_config').select('*').limit(1);
    rentConfig = data && data[0] ? data[0] : null;
  } else {
    rentConfig = JSON.parse(localStorage.getItem('sc_rent') || 'null');
  }
  renderRentCard();
}

function renderRentCard() {
  const el   = document.getElementById('rent-display');
  const meta = document.getElementById('rent-meta');
  if (!el || !meta) return;
  if (!rentConfig) {
    el.textContent   = '₹ —';
    meta.textContent = 'Not configured yet';
    return;
  }
  el.textContent   = '₹ ' + parseFloat(rentConfig.amount).toLocaleString('en-IN');
  const parts = [];
  if (rentConfig.landlord) parts.push('Landlord: ' + rentConfig.landlord);
  if (rentConfig.due_day)  parts.push('Due: ' + ordinal(rentConfig.due_day) + ' of each month');
  if (rentConfig.notes)    parts.push(rentConfig.notes);
  meta.textContent = parts.join(' · ') || 'Configured';
}

function openRentModal() {
  if (rentConfig) {
    document.getElementById('rent-amount').value   = rentConfig.amount || '';
    document.getElementById('rent-landlord').value = rentConfig.landlord || '';
    document.getElementById('rent-dueday').value   = rentConfig.due_day || '';
    document.getElementById('rent-notes').value    = rentConfig.notes || '';
  }
  document.getElementById('rent-modal').classList.remove('hidden');
}

async function saveRent() {
  const amount   = parseFloat(document.getElementById('rent-amount').value) || 0;
  const landlord = document.getElementById('rent-landlord').value.trim();
  const due_day  = parseInt(document.getElementById('rent-dueday').value) || null;
  const notes    = document.getElementById('rent-notes').value.trim();

  if (amount <= 0) return showToast('Enter a valid rent amount', 'error');

  const record = { amount, landlord, due_day, notes };

  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    if (rentConfig && rentConfig.id) {
      await sb.from('rent_config').update(record).eq('id', rentConfig.id);
    } else {
      await sb.from('rent_config').insert([record]);
    }
  } else {
    rentConfig = { ...(rentConfig||{}), ...record, id: rentConfig?.id || uid() };
    localStorage.setItem('sc_rent', JSON.stringify(rentConfig));
  }

  closeModal('rent-modal');
  renderRentCard();
  renderDashboard();
  showToast('Rent saved!', 'success');
}

// ─── DELETE FLOW ──────────────────────────────
function confirmDelete(table, id, label) {
  document.getElementById('confirm-msg').textContent = `Delete "${label}"? This cannot be undone.`;
  document.getElementById('confirm-ok-btn').onclick = () => doDelete(table, id);
  document.getElementById('confirm-modal').classList.remove('hidden');
}

async function doDelete(table, id) {
  closeModal('confirm-modal');

  if (sb && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    const tbl = table === 'inventory' ? 'inventory' : table === 'expense' ? 'expenses' : 'bills';
    await sb.from(tbl).delete().eq('id', id);
  } else {
    if (table === 'inventory') {
      allInventory = allInventory.filter(i => i.id !== id);
      localStorage.setItem('sc_inventory', JSON.stringify(allInventory));
    } else if (table === 'expense') {
      allExpenses = allExpenses.filter(e => e.id !== id);
      localStorage.setItem('sc_expenses', JSON.stringify(allExpenses));
    } else if (table === 'bill') {
      allBills = allBills.filter(b => b.id !== id);
      localStorage.setItem('sc_bills', JSON.stringify(allBills));
    }
  }

  if (table === 'inventory') { await loadInventory(); renderDashboard(); }
  if (table === 'expense')   { await loadExpenses();  renderDashboard(); }
  if (table === 'bill')      { await loadBills();     renderDashboard(); }
  showToast('Deleted successfully', 'success');
}

// ─── DASHBOARD ────────────────────────────────
function renderDashboard() {
  // Stats
  document.getElementById('stat-items').textContent = allInventory.length;

  const lowItems = allInventory.filter(i => {
    const qty = parseFloat(i.quantity) || 0;
    const min = parseFloat(i.min_stock) || 0;
    return qty <= min;
  });
  document.getElementById('stat-low').textContent = lowItems.length;

  const thisMonth = new Date().toISOString().slice(0,7);
  const monthTotal = allExpenses
    .filter(e => (e.date||'').startsWith(thisMonth))
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  document.getElementById('stat-expenses').textContent =
    '₹' + monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 });

  document.getElementById('stat-rent').textContent =
    rentConfig ? '₹' + parseFloat(rentConfig.amount).toLocaleString('en-IN') : '—';

  // Low stock panel
  const ls = document.getElementById('dash-lowstock');
  if (!lowItems.length) {
    ls.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:0.82rem">✅ All items well stocked</div>';
  } else {
    ls.innerHTML = lowItems.slice(0,6).map(i => `
      <div class="panel-row">
        <span>${esc(i.name)}</span>
        <span class="badge-low">${i.quantity} ${i.unit}</span>
      </div>`).join('');
  }

  // Recent expenses
  const re = document.getElementById('dash-recent-expenses');
  const recent = allExpenses.slice(0,6);
  if (!recent.length) {
    re.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:0.82rem">No expenses yet</div>';
  } else {
    re.innerHTML = recent.map(e => `
      <div class="panel-row">
        <span>${esc(e.description)}</span>
        <span>₹${parseFloat(e.amount).toFixed(0)}</span>
      </div>`).join('');
  }
}

// ─── RESTOCK ──────────────────────────────────
function renderRestockList() {
  const low = allInventory.filter(i => {
    const qty = parseFloat(i.quantity) || 0;
    const min = parseFloat(i.min_stock) || 0;
    return qty <= min;
  });

  const el = document.getElementById('restock-grid');
  if (!low.length) {
    el.innerHTML = '<div class="empty-state" style="padding:3rem"><div class="empty-icon">✅</div>All items are stocked well!</div>';
    return;
  }
  el.innerHTML = low.map(i => {
    const qty = parseFloat(i.quantity) || 0;
    const isOut = qty === 0;
    return `
    <div class="restock-card">
      <div class="restock-card-name">${esc(i.name)}</div>
      <div class="restock-card-info">
        Category: ${esc(i.category || '—')}<br>
        Current: ${qty} ${esc(i.unit || '')}<br>
        Min Required: ${i.min_stock} ${esc(i.unit || '')}<br>
        ${i.supplier ? 'Supplier: ' + esc(i.supplier) : ''}
      </div>
      <span class="restock-urgency ${isOut ? 'urgency-critical' : 'urgency-low'}">
        ${isOut ? '🚨 Out of Stock' : '⚠️ Low Stock'}
      </span>
    </div>`;
  }).join('');
}

// ─── MONTHLY LOG ──────────────────────────────
function populateLogMonths() {
  const months = new Set();
  allExpenses.forEach(e => { if (e.date) months.add(e.date.slice(0,7)); });
  allBills.forEach(b => { if (b.month_year) months.add(b.month_year); });
  months.add(new Date().toISOString().slice(0,7));

  const sel = document.getElementById('log-month-select');
  const sorted = [...months].sort().reverse();
  sel.innerHTML = sorted.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('');
  renderMonthlyLog();
}

function renderMonthlyLog() {
  const month = document.getElementById('log-month-select').value;
  if (!month) return;

  const expenses = allExpenses.filter(e => (e.date||'').startsWith(month));
  const bills    = allBills.filter(b => b.month_year === month);
  const expTotal = expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const billTotal= bills.reduce((s,b) => s + (parseFloat(b.amount)||0), 0);
  const rentAmt  = rentConfig ? parseFloat(rentConfig.amount)||0 : 0;
  const grandTotal = expTotal + billTotal + rentAmt;

  const el = document.getElementById('monthly-log-content');

  let html = `
  <div class="stat-grid" style="margin-bottom:1.5rem">
    <div class="stat-card"><div class="stat-icon">🛒</div><div class="stat-info"><div class="stat-label">Expenses</div><div class="stat-value">₹${expTotal.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">🧾</div><div class="stat-info"><div class="stat-label">Bills</div><div class="stat-value">₹${billTotal.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">🏠</div><div class="stat-info"><div class="stat-label">Rent</div><div class="stat-value">₹${rentAmt.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-info"><div class="stat-label">Grand Total</div><div class="stat-value" style="color:var(--accent2)">₹${grandTotal.toLocaleString('en-IN')}</div></div></div>
  </div>`;

  if (expenses.length) {
    html += `
    <div class="log-section">
      <div class="log-section-header"><span>🛒 Expenses</span><span class="log-total">₹${expTotal.toLocaleString('en-IN')}</span></div>
      <div class="table-wrap" style="border:none;border-radius:0">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Paid By</th></tr></thead>
          <tbody>${expenses.map(e=>`<tr><td>${formatDate(e.date)}</td><td>${esc(e.description)}</td><td>${esc(e.category)}</td><td>₹${parseFloat(e.amount).toFixed(2)}</td><td>${esc(e.paid_by||'—')}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }

  if (bills.length) {
    html += `
    <div class="log-section">
      <div class="log-section-header"><span>🧾 Bills</span><span class="log-total">₹${billTotal.toLocaleString('en-IN')}</span></div>
      <div class="table-wrap" style="border:none;border-radius:0">
        <table class="data-table">
          <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>${bills.map(b=>`<tr><td>${esc(b.type)}</td><td>₹${parseFloat(b.amount).toFixed(2)}</td><td><span class="${b.paid==='Paid'?'paid-badge':'unpaid-badge'}">${b.paid}</span></td><td>${esc(b.notes||'—')}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }

  if (!expenses.length && !bills.length) {
    html += `<div class="empty-state"><div class="empty-icon">📅</div>No records for ${formatMonth(month)}</div>`;
  }

  el.innerHTML = html;
}

function populateMonthFilters() {
  const months = new Set();
  allExpenses.forEach(e => { if (e.date) months.add(e.date.slice(0,7)); });
  const sorted = [...months].sort().reverse();
  const sel = document.getElementById('exp-month-filter');
  sel.innerHTML = '<option value="">All Months</option>' +
    sorted.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('');
}

// ─── UTILS ────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  } catch { return dateStr; }
}

function formatMonth(m) {
  if (!m) return '';
  const [year, month] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[parseInt(month)-1] + ' ' + year;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = (type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ') + msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ─── THEME TOGGLE ─────────────────────────────
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-toggle').textContent = isDark ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('sc_theme', isDark ? 'light' : 'dark');
}
