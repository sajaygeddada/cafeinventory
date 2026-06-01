// =============================================
//  Sajay's Café — Inventory Manager
//  script.js — Row D&D + Column D&D + Sorting
// =============================================

const SUPABASE_URL  = 'https://cebhmyeelkndpyoysswg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYmhteWVlbGtuZHB5b3lzc3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzYyOTYsImV4cCI6MjA5MTc1MjI5Nn0._46DfnsLqxgngXhV6xjevYkBZtBjlQCKSNIPtck9Vac';
const ADMIN_USERNAME = 'sajaygeddada';
const DEFAULT_PASSWORD_HASH = btoa('sajaysCafe@2026');

let sbClient;
try { sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
catch(e) { console.warn('Supabase offline mode', e); }

// ─── DATA STATE ───────────────────────────────
let allInventory = [], allExpenses = [], allBills = [], rentConfig = null, billModalPreset = {};

// ─── SORT STATE ───────────────────────────────
const sortState = {
  inventory: { col: null, dir: 'asc' },
  expenses:  { col: null, dir: 'asc' },
  bills:     { col: null, dir: 'asc' },
};

// ─── COLUMN ORDER ─────────────────────────────
const defaultColOrder = {
  inventory: ['name','category','quantity','unit','min_stock','cost_per_unit','supplier','status','actions'],
  expenses:  ['date','description','category','amount','paid_by','notes','actions'],
  bills:     ['month_year','type','amount','due_date','paid','notes','actions'],
};

function getColOrder(t) {
  try {
    const s = localStorage.getItem('sc_cols_'+t);
    if (s) { const p = JSON.parse(s); if (p.length === defaultColOrder[t].length) return p; }
  } catch {}
  return [...defaultColOrder[t]];
}
function saveColOrder(t,o) { localStorage.setItem('sc_cols_'+t, JSON.stringify(o)); }

// ─── COLUMN DEFINITIONS ───────────────────────
const colDefs = {
  inventory: {
    name:          { label:'Item Name',    sortKey:'name',          render: i=>`<strong>${esc(i.name)}</strong>` },
    category:      { label:'Category',     sortKey:'category',      render: i=>esc(i.category||'—') },
    quantity:      { label:'Qty',          sortKey:'quantity',      render: i=>parseFloat(i.quantity)||0 },
    unit:          { label:'Unit',         sortKey:'unit',          render: i=>esc(i.unit||'') },
    min_stock:     { label:'Min Stock',    sortKey:'min_stock',     render: i=>parseFloat(i.min_stock)||0 },
    cost_per_unit: { label:'Cost/Unit (₹)',sortKey:'cost_per_unit', render: i=>i.cost_per_unit?'₹'+parseFloat(i.cost_per_unit).toFixed(2):'—' },
    supplier:      { label:'Supplier',     sortKey:'supplier',      render: i=>esc(i.supplier||'—') },
    status:        { label:'Status',       sortKey:null,            render: i=>{
      const q=parseFloat(i.quantity)||0, m=parseFloat(i.min_stock)||0;
      return q===0?`<span class="status-out">Out of Stock</span>`:q<=m?`<span class="status-low">Low Stock</span>`:`<span class="status-ok">In Stock</span>`;
    }},
    actions:       { label:'Actions',      sortKey:null,            render: i=>`<div class="action-btns"><button class="btn-edit" onclick="editInventory('${i.id}')">✏️</button><button class="btn-del" onclick="confirmDelete('inventory','${i.id}','${esc(i.name)}')">🗑️</button></div>` },
  },
  expenses: {
    date:        { label:'Date',       sortKey:'date',        render: e=>formatDate(e.date) },
    description: { label:'Description',sortKey:'description', render: e=>esc(e.description) },
    category:    { label:'Category',   sortKey:'category',    render: e=>esc(e.category||'—') },
    amount:      { label:'Amount (₹)', sortKey:'amount',      render: e=>`<strong>₹${parseFloat(e.amount).toFixed(2)}</strong>` },
    paid_by:     { label:'Paid By',    sortKey:'paid_by',     render: e=>esc(e.paid_by||'—') },
    notes:       { label:'Notes',      sortKey:null,          render: e=>esc(e.notes||'—') },
    actions:     { label:'Actions',    sortKey:null,          render: e=>`<div class="action-btns"><button class="btn-edit" onclick="editExpense('${e.id}')">✏️</button><button class="btn-del" onclick="confirmDelete('expense','${e.id}','${esc(e.description)}')">🗑️</button></div>` },
  },
  bills: {
    month_year:{ label:'Month/Year', sortKey:'month_year', render: b=>esc(b.month_year) },
    type:      { label:'Type',       sortKey:'type',       render: b=>esc(b.type) },
    amount:    { label:'Amount (₹)', sortKey:'amount',     render: b=>`<strong>₹${parseFloat(b.amount).toFixed(2)}</strong>` },
    due_date:  { label:'Due Date',   sortKey:'due_date',   render: b=>b.due_date?formatDate(b.due_date):'—' },
    paid:      { label:'Status',     sortKey:'paid',       render: b=>`<span class="${b.paid==='Paid'?'paid-badge':'unpaid-badge'}">${b.paid}</span>` },
    notes:     { label:'Notes',      sortKey:null,         render: b=>esc(b.notes||'—') },
    actions:   { label:'Actions',    sortKey:null,         render: b=>`<div class="action-btns"><button class="btn-edit" onclick="editBill('${b.id}')">✏️</button><button class="btn-del" onclick="confirmDelete('bill','${b.id}','${esc(b.type)} bill')">🗑️</button></div>` },
  },
};

// ─── DRAG STATE ───────────────────────────────
let dragRow=null, dragRowTable=null, dragColTable=null, colDragGhost=null, colDropIndicator=null;

// =============================================
//  INIT
// =============================================
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('exp-date').value     = today;
  document.getElementById('bill-duedate').value = today;
  document.getElementById('bill-month').value   = today.slice(0,7);

  colDropIndicator = document.createElement('div');
  colDropIndicator.className = 'col-drop-indicator';
  document.body.appendChild(colDropIndicator);

  checkSession();
  updateDBStatus();
});

// ─── AUTH ─────────────────────────────────────
function checkSession() { if (sessionStorage.getItem('sc_auth')==='ok') showApp(); }

function handleLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (user !== ADMIN_USERNAME) return showLoginError();
  if (btoa(pass) !== (localStorage.getItem('sc_pw')||DEFAULT_PASSWORD_HASH)) return showLoginError();
  document.getElementById('login-error').classList.add('hidden');
  sessionStorage.setItem('sc_auth','ok');
  showApp();
}
function showLoginError() { document.getElementById('login-error').classList.remove('hidden'); document.getElementById('login-pass').value=''; }
function handleLogout() { sessionStorage.removeItem('sc_auth'); location.reload(); }
function showApp() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); loadAll(); }
document.addEventListener('keydown', e => { if (e.key==='Enter' && !document.getElementById('login-screen').classList.contains('hidden')) handleLogin(); });

async function updateDBStatus() {
  const el = document.getElementById('db-status');
  if (!sbClient || SUPABASE_URL==='YOUR_SUPABASE_URL') { el.textContent='● DB not configured'; el.className='db-status error'; return; }
  try { const {error}=await sbClient.from('inventory').select('id').limit(1); if(error)throw error; el.textContent='● Supabase Connected'; el.className='db-status connected'; }
  catch { el.textContent='● DB error'; el.className='db-status error'; }
}

async function loadAll() {
  await Promise.all([loadInventory(),loadExpenses(),loadBills(),loadRent()]);
  renderDashboard(); populateMonthFilters(); populateLogMonths();
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('tab-'+name).classList.remove('hidden');
  btn.classList.add('active');
  document.getElementById('page-title').textContent = {dashboard:'Dashboard',inventory:'Inventory',expenses:'Expenses',bills:'Bills & Rent',restock:'Restock List',log:'Monthly Log'}[name]||name;
  if (name==='restock')   renderRestockList();
  if (name==='log')       renderMonthlyLog();
  if (name==='dashboard') renderDashboard();
  if (name==='bills')     renderBillsTab();
}

// =============================================
//  GENERIC TABLE RENDERER
// =============================================
function renderTable(tableKey, items, tbodyId, theadId) {
  const colOrder = getColOrder(tableKey);
  const defs     = colDefs[tableKey];
  const sort     = sortState[tableKey];

  // THEAD
  const thead = document.getElementById(theadId);
  if (thead) {
    thead.innerHTML = '<tr>' + colOrder.map((col, ci) => {
      const def = defs[col];
      const isAct = col==='actions';
      const sortable = def.sortKey!==null && !isAct;
      let sortIcon = sortable
        ? (sort.col===col ? (sort.dir==='asc'?' <span class="sort-arrow">▲</span>':' <span class="sort-arrow">▼</span>') : ' <span class="sort-arrow muted">⇅</span>')
        : '';
      const dragAttr = isAct ? '' : `draggable="true" data-col="${col}" data-colidx="${ci}" data-table="${tableKey}"`;
      const clickAttr = sortable ? `onclick="sortTable('${tableKey}','${col}')"` : '';
      const cls = isAct ? 'th-actions' : `col-draggable${sortable?' sortable':''}`;
      const title = isAct ? '' : (sortable ? 'Click to sort · Drag to reorder column' : 'Drag to reorder column');
      return `<th class="${cls}" ${dragAttr} ${clickAttr} title="${title}">${def.label}${sortIcon}</th>`;
    }).join('') + '</tr>';

    thead.querySelectorAll('th[draggable="true"]').forEach(th => {
      th.addEventListener('dragstart', onColDragStart);
      th.addEventListener('dragover',  onColDragOver);
      th.addEventListener('drop',      onColDrop);
      th.addEventListener('dragend',   onColDragEnd);
    });
  }

  // TBODY
  const tbody = document.getElementById(tbodyId);
  if (!items.length) {
    const ic={inventory:'📦',expenses:'💸',bills:'🧾'}[tableKey];
    const msg={inventory:'No inventory items yet.',expenses:'No expenses yet.',bills:'No bills yet.'}[tableKey];
    tbody.innerHTML=`<tr><td colspan="${colOrder.length}"><div class="empty-state"><div class="empty-icon">${ic}</div>${msg}</div></td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, ri) => {
    const cells = colOrder.map(col => `<td data-col="${col}">${defs[col].render(item)}</td>`).join('');
    return `<tr draggable="true" data-id="${item.id}" data-rowidx="${ri}" data-table="${tableKey}" class="draggable-row">${cells}</tr>`;
  }).join('');

  // Row drag events
  tbody.querySelectorAll('tr.draggable-row').forEach(tr => {
    tr.addEventListener('dragstart', onRowDragStart);
    tr.addEventListener('dragover',  onRowDragOver);
    tr.addEventListener('drop',      onRowDrop);
    tr.addEventListener('dragend',   onRowDragEnd);
    tr.addEventListener('dragleave', onRowDragLeave);
  });

  // ── TOTALS FOOTER ──
  const table = tbody.closest('table');
  let tfoot = table.querySelector('tfoot');
  if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }

  // Per-table totals logic
  const totals = buildTotals(tableKey, items, colOrder);
  tfoot.innerHTML = `<tr class="totals-row">${colOrder.map((col, ci) => {
    const val = totals[col];
    const isFirst = ci === 0;
    return `<td class="totals-cell${isFirst?' totals-label':''}">${val}</td>`;
  }).join('')}</tr>`;
}

// ─── TOTALS BUILDER ───────────────────────────
function buildTotals(tableKey, items, colOrder) {
  const result = {};
  let labelSet = false;

  if (tableKey === 'inventory') {
    const totalQty      = items.reduce((s,i) => s + (parseFloat(i.quantity)||0), 0);
    const totalMinStock = items.reduce((s,i) => s + (parseFloat(i.min_stock)||0), 0);
    const totalValue    = items.reduce((s,i) => s + ((parseFloat(i.quantity)||0) * (parseFloat(i.cost_per_unit)||0)), 0);
    const lowCount      = items.filter(i => (parseFloat(i.quantity)||0) <= (parseFloat(i.min_stock)||0)).length;
    const cats          = [...new Set(items.map(i=>i.category).filter(Boolean))];

    colOrder.forEach(col => {
      if (!labelSet) { result[col] = `<span class="totals-tag">TOTALS</span><span class="totals-count">${items.length} items</span>`; labelSet=true; return; }
      if (col==='quantity')      result[col] = `<span class="totals-num">${totalQty.toLocaleString('en-IN',{maximumFractionDigits:2})}</span>`;
      else if (col==='min_stock')result[col] = `<span class="totals-num">${totalMinStock.toLocaleString('en-IN',{maximumFractionDigits:2})}</span>`;
      else if (col==='cost_per_unit') result[col] = `<span class="totals-money">₹${totalValue.toLocaleString('en-IN',{maximumFractionDigits:2})}<span class="totals-sublabel"> stock value</span></span>`;
      else if (col==='status')   result[col] = lowCount>0 ? `<span class="totals-warn">${lowCount} low / out</span>` : `<span class="totals-ok">All OK</span>`;
      else if (col==='category') result[col] = `<span class="totals-muted">${cats.length} categor${cats.length===1?'y':'ies'}</span>`;
      else result[col] = '';
    });

  } else if (tableKey === 'expenses') {
    const totalAmt  = items.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
    const byCash    = items.filter(e=>e.paid_by==='Cash').reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
    const byUPI     = items.filter(e=>e.paid_by==='UPI').reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
    const cats      = [...new Set(items.map(e=>e.category).filter(Boolean))];
    const dateRange = items.length >= 2
      ? `${formatDate(items[items.length-1].date)} – ${formatDate(items[0].date)}`
      : items.length === 1 ? formatDate(items[0].date) : '';

    colOrder.forEach(col => {
      if (!labelSet) { result[col] = `<span class="totals-tag">TOTALS</span><span class="totals-count">${items.length} records</span>`; labelSet=true; return; }
      if (col==='amount')      result[col] = `<span class="totals-money">₹${totalAmt.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
      else if (col==='paid_by')result[col] = `<span class="totals-muted">${byCash>0?'Cash ₹'+Math.round(byCash).toLocaleString('en-IN'):''}${byCash>0&&byUPI>0?' · ':''}${byUPI>0?'UPI ₹'+Math.round(byUPI).toLocaleString('en-IN'):''}</span>`;
      else if (col==='category')result[col] = `<span class="totals-muted">${cats.length} categor${cats.length===1?'y':'ies'}</span>`;
      else if (col==='date')   result[col] = `<span class="totals-muted" style="font-size:0.75rem">${dateRange}</span>`;
      else result[col] = '';
    });

  } else if (tableKey === 'bills') {
    const totalAmt  = items.reduce((s,b) => s + (parseFloat(b.amount)||0), 0);
    const paidAmt   = items.filter(b=>b.paid==='Paid').reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
    const unpaidAmt = totalAmt - paidAmt;
    const types     = [...new Set(items.map(b=>b.type).filter(Boolean))];

    colOrder.forEach(col => {
      if (!labelSet) { result[col] = `<span class="totals-tag">TOTALS</span><span class="totals-count">${items.length} bills</span>`; labelSet=true; return; }
      if (col==='amount')      result[col] = `<span class="totals-money">₹${totalAmt.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
      else if (col==='paid')   result[col] = `<span class="totals-ok">✓ ₹${Math.round(paidAmt).toLocaleString('en-IN')}</span>${unpaidAmt>0?` <span class="totals-warn">✗ ₹${Math.round(unpaidAmt).toLocaleString('en-IN')}</span>`:''}`;
      else if (col==='type')   result[col] = `<span class="totals-muted">${types.length} type${types.length===1?'':'s'}</span>`;
      else result[col] = '';
    });
  }

  // Fill any unset cols
  colOrder.forEach(col => { if (result[col]==null) result[col]=''; });
  return result;
}

// =============================================
//  SORTING
// =============================================
function sortTable(tableKey, col) {
  const s = sortState[tableKey];
  s.dir = s.col===col ? (s.dir==='asc'?'desc':'asc') : 'asc';
  s.col = col;
  if (tableKey==='inventory') renderInventoryTable(getCurrentInventory());
  if (tableKey==='expenses')  renderExpensesTable(getCurrentExpenses());
  if (tableKey==='bills')     renderBillsTableFull();
}

function applySort(items, tableKey) {
  const {col, dir} = sortState[tableKey];
  if (!col) return items;
  const key = colDefs[tableKey][col]?.sortKey;
  if (!key) return items;
  return [...items].sort((a,b) => {
    let av=a[key]??'', bv=b[key]??'';
    const na=parseFloat(av), nb=parseFloat(bv);
    const isNum = !isNaN(na)&&!isNaN(nb);
    const cmp = isNum ? na-nb : String(av).localeCompare(String(bv));
    return dir==='asc' ? cmp : -cmp;
  });
}

// =============================================
//  ROW DRAG & DROP
// =============================================
function onRowDragStart(e) {
  dragRow=this; dragRowTable=this.dataset.table;
  this.classList.add('row-dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function onRowDragOver(e) {
  e.preventDefault(); e.dataTransfer.dropEffect='move';
  if (this===dragRow || this.dataset.table!==dragRowTable) return;
  const mid = this.getBoundingClientRect().top + this.getBoundingClientRect().height/2;
  this.classList.remove('row-drop-above','row-drop-below');
  this.classList.add(e.clientY<mid?'row-drop-above':'row-drop-below');
}

function onRowDragLeave() { this.classList.remove('row-drop-above','row-drop-below'); }

function onRowDrop(e) {
  e.preventDefault();
  if (!dragRow || this===dragRow || this.dataset.table!==dragRowTable) return;
  this.classList.remove('row-drop-above','row-drop-below');
  const table=dragRowTable;
  let arr = table==='inventory'?allInventory:table==='expenses'?allExpenses:allBills;
  const fi=arr.findIndex(r=>r.id===dragRow.dataset.id);
  const ti=arr.findIndex(r=>r.id===this.dataset.id);
  if (fi<0||ti<0) return;
  const [moved]=arr.splice(fi,1);
  const rect=this.getBoundingClientRect();
  let ins=e.clientY<rect.top+rect.height/2?ti:ti+(fi<ti?0:1);
  arr.splice(Math.min(ins,arr.length),0,moved);
  sortState[table].col=null;
  const lk=table==='inventory'?'sc_inventory':table==='expenses'?'sc_expenses':'sc_bills';
  localStorage.setItem(lk, JSON.stringify(arr));
  if (table==='inventory') renderInventoryTable(arr);
  if (table==='expenses')  renderExpensesTable(arr);
  if (table==='bills')     renderBillsTableFull();
  showToast('Row reordered!','success');
}

function onRowDragEnd() {
  document.querySelectorAll('.draggable-row').forEach(r=>r.classList.remove('row-dragging','row-drop-above','row-drop-below'));
  dragRow=null;
}

// =============================================
//  COLUMN DRAG & DROP
// =============================================
function onColDragStart(e) {
  dragColTable=this.dataset.table;
  this.classList.add('col-dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain', this.dataset.col);
  colDragGhost=document.createElement('div');
  colDragGhost.className='col-drag-ghost';
  colDragGhost.textContent=this.textContent.replace(/[▲▼⇅]/g,'').trim();
  document.body.appendChild(colDragGhost);
  e.dataTransfer.setDragImage(colDragGhost,40,20);
}

function onColDragOver(e) {
  e.preventDefault();
  if (this.dataset.table!==dragColTable||this.dataset.col==='actions') return;
  e.dataTransfer.dropEffect='move';
  const r=this.getBoundingClientRect();
  const x=e.clientX<r.left+r.width/2?r.left:r.right;
  colDropIndicator.style.left=(x+window.scrollX-1)+'px';
  colDropIndicator.style.top=(r.top+window.scrollY)+'px';
  colDropIndicator.style.height=r.height+'px';
  colDropIndicator.style.display='block';
}

function onColDrop(e) {
  e.preventDefault();
  colDropIndicator.style.display='none';
  if (this.dataset.table!==dragColTable) return;
  const toCol=this.dataset.col;
  if (!toCol||toCol==='actions') return;
  const table=dragColTable;
  const order=getColOrder(table);
  const fromCol=e.dataTransfer.getData('text/plain');
  if (fromCol===toCol) return;
  const fi=order.indexOf(fromCol), ti=order.indexOf(toCol);
  if (fi<0||ti<0) return;
  const r=this.getBoundingClientRect();
  let ins=e.clientX>=r.left+r.width/2?ti+1:ti;
  if (fi<ins) ins--;
  order.splice(fi,1); order.splice(ins,0,fromCol);
  saveColOrder(table,order);
  if (table==='inventory') renderInventoryTable(getCurrentInventory());
  if (table==='expenses')  renderExpensesTable(getCurrentExpenses());
  if (table==='bills')     renderBillsTableFull();
  showToast('Column moved!','success');
}

function onColDragEnd() {
  colDropIndicator.style.display='none';
  if (colDragGhost){colDragGhost.remove();colDragGhost=null;}
  document.querySelectorAll('th.col-dragging').forEach(th=>th.classList.remove('col-dragging'));
}

// =============================================
//  INVENTORY
// =============================================
async function loadInventory() {
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    const {data,error}=await sbClient.from('inventory').select('*').order('name');
    if (!error) allInventory=data||[];
  } else { allInventory=JSON.parse(localStorage.getItem('sc_inventory')||'[]'); }
  renderInventoryTable(allInventory);
}

function getCurrentInventory() {
  const q=document.getElementById('inv-search')?.value.toLowerCase()||'';
  const cat=document.getElementById('inv-category-filter')?.value||'';
  return allInventory.filter(i=>(!q||i.name.toLowerCase().includes(q)||(i.supplier||'').toLowerCase().includes(q))&&(!cat||i.category===cat));
}

function renderInventoryTable(items) { renderTable('inventory', applySort(items,'inventory'), 'inv-tbody', 'inv-thead'); }
function filterInventory() { renderInventoryTable(getCurrentInventory()); }

// =============================================
//  EXPENSES
// =============================================
async function loadExpenses() {
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    const {data,error}=await sbClient.from('expenses').select('*').order('date',{ascending:false});
    if (!error) allExpenses=data||[];
  } else { allExpenses=JSON.parse(localStorage.getItem('sc_expenses')||'[]'); }
  renderExpensesTable(allExpenses);
}

function getCurrentExpenses() {
  const q=document.getElementById('exp-search')?.value.toLowerCase()||'';
  const month=document.getElementById('exp-month-filter')?.value||'';
  return allExpenses.filter(e=>(!q||(e.description||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q))&&(!month||(e.date||'').startsWith(month)));
}

function renderExpensesTable(items) { renderTable('expenses', applySort(items,'expenses'), 'exp-tbody', 'exp-thead'); }
function filterExpenses() { renderExpensesTable(getCurrentExpenses()); }

// =============================================
//  BILLS
// =============================================
async function loadBills() {
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    const {data,error}=await sbClient.from('bills').select('*').order('month_year',{ascending:false});
    if (!error) allBills=data||[];
  } else { allBills=JSON.parse(localStorage.getItem('sc_bills')||'[]'); }
  renderBillsTab();
}

function renderBillsTableFull() { renderTable('bills', applySort(allBills,'bills'), 'bills-tbody', 'bills-thead'); }

function renderBillsTab() {
  const types=['Electricity','Water','Other'], ids=['elec-list','water-list','other-list'];
  types.forEach((type,i)=>{
    const subset=allBills.filter(b=>type==='Other'?!['Electricity','Water'].includes(b.type):b.type===type);
    const el=document.getElementById(ids[i]);
    if (!el) return;
    el.innerHTML=!subset.length?'<div class="empty-state" style="padding:0.75rem;font-size:0.8rem">No records yet</div>'
      :subset.slice(0,4).map(b=>`<div class="bill-mini-row"><span>${b.month_year}</span><span>₹${parseFloat(b.amount).toFixed(0)}</span><span class="${b.paid==='Paid'?'paid-badge':'unpaid-badge'}">${b.paid}</span></div>`).join('');
  });
  renderBillsTableFull();
}

// =============================================
//  RENT
// =============================================
async function loadRent() {
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    const {data}=await sbClient.from('rent_config').select('*').limit(1);
    rentConfig=data&&data[0]?data[0]:null;
  } else { rentConfig=JSON.parse(localStorage.getItem('sc_rent')||'null'); }
  renderRentCard();
}

function renderRentCard() {
  const el=document.getElementById('rent-display'), meta=document.getElementById('rent-meta');
  if (!el||!meta) return;
  if (!rentConfig){el.textContent='₹ —';meta.textContent='Not configured yet';return;}
  el.textContent='₹ '+parseFloat(rentConfig.amount).toLocaleString('en-IN');
  const parts=[];
  if (rentConfig.landlord) parts.push('Landlord: '+rentConfig.landlord);
  if (rentConfig.due_day)  parts.push('Due: '+ordinal(rentConfig.due_day)+' of each month');
  if (rentConfig.notes)    parts.push(rentConfig.notes);
  meta.textContent=parts.join(' · ')||'Configured';
}

async function saveRent() {
  const amount=parseFloat(document.getElementById('rent-amount').value)||0;
  const landlord=document.getElementById('rent-landlord').value.trim();
  const due_day=parseInt(document.getElementById('rent-dueday').value)||null;
  const notes=document.getElementById('rent-notes').value.trim();
  if (amount<=0) return showToast('Enter a valid rent amount','error');
  const record={amount,landlord,due_day,notes};
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    if (rentConfig?.id){await sbClient.from('rent_config').update(record).eq('id',rentConfig.id);}
    else {await sbClient.from('rent_config').insert([record]);}
  } else { rentConfig={...(rentConfig||{}), ...record, id:rentConfig?.id||uid()}; localStorage.setItem('sc_rent',JSON.stringify(rentConfig)); }
  closeModal('rent-modal'); renderRentCard(); renderDashboard(); showToast('Rent saved!','success');
}

// =============================================
//  MODALS
// =============================================
function openModal(id, preset) {
  if (id==='bill-modal'&&preset) { billModalPreset=preset; }
  document.getElementById(id).classList.remove('hidden');
  if (id==='bill-modal'&&preset?.type) document.getElementById('bill-type').value=preset.type;
  if (id==='inv-modal')  {document.getElementById('inv-modal-title').textContent='Add Inventory Item'; clearInvForm();}
  if (id==='exp-modal')  {document.getElementById('exp-modal-title').textContent='Add Expense'; clearExpForm();}
  if (id==='bill-modal') {document.getElementById('bill-modal-title').textContent='Add Bill'; clearBillForm();}
  if (id==='rent-modal'&&rentConfig) {
    document.getElementById('rent-amount').value=rentConfig.amount||'';
    document.getElementById('rent-landlord').value=rentConfig.landlord||'';
    document.getElementById('rent-dueday').value=rentConfig.due_day||'';
    document.getElementById('rent-notes').value=rentConfig.notes||'';
  }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function clearInvForm() {
  ['inv-edit-id','inv-name','inv-qty','inv-minstock','inv-cost','inv-supplier','inv-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('inv-cat').value='Beverages'; document.getElementById('inv-unit').value='kg';
}
function clearExpForm() {
  ['exp-edit-id','exp-desc','exp-amount','exp-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('exp-cat').value='Supplies'; document.getElementById('exp-paidby').value='Cash';
  document.getElementById('exp-date').value=new Date().toISOString().split('T')[0];
}
function clearBillForm() {
  ['bill-edit-id','bill-amount','bill-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('bill-type').value=billModalPreset?.type||'Electricity';
  document.getElementById('bill-paid').value='Unpaid';
  document.getElementById('bill-month').value=new Date().toISOString().slice(0,7);
  document.getElementById('bill-duedate').value='';
}

// ── INVENTORY CRUD ──
async function saveInventory() {
  const id=document.getElementById('inv-edit-id').value;
  const name=document.getElementById('inv-name').value.trim();
  if (!name) return showToast('Item name is required','error');
  const record={
    name, category:document.getElementById('inv-cat').value,
    quantity:parseFloat(document.getElementById('inv-qty').value)||0,
    unit:document.getElementById('inv-unit').value,
    min_stock:parseFloat(document.getElementById('inv-minstock').value)||0,
    cost_per_unit:parseFloat(document.getElementById('inv-cost').value)||0,
    supplier:document.getElementById('inv-supplier').value.trim(),
    notes:document.getElementById('inv-notes').value.trim(),
  };
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    if (id){await sbClient.from('inventory').update(record).eq('id',id);}
    else   {await sbClient.from('inventory').insert([record]);}
  } else {
    if (id){const idx=allInventory.findIndex(i=>i.id===id);if(idx>=0)allInventory[idx]={...allInventory[idx],...record};}
    else   {allInventory.push({...record,id:uid()});}
    localStorage.setItem('sc_inventory',JSON.stringify(allInventory));
  }
  closeModal('inv-modal'); await loadInventory(); renderDashboard();
  showToast(id?'Item updated!':'Item added!','success');
}

function editInventory(id) {
  const item=allInventory.find(i=>i.id===id); if (!item) return;
  document.getElementById('inv-modal-title').textContent='Edit Inventory Item';
  document.getElementById('inv-edit-id').value=item.id; document.getElementById('inv-name').value=item.name;
  document.getElementById('inv-cat').value=item.category||'Other'; document.getElementById('inv-qty').value=item.quantity;
  document.getElementById('inv-unit').value=item.unit||'kg'; document.getElementById('inv-minstock').value=item.min_stock||0;
  document.getElementById('inv-cost').value=item.cost_per_unit||''; document.getElementById('inv-supplier').value=item.supplier||'';
  document.getElementById('inv-notes').value=item.notes||'';
  document.getElementById('inv-modal').classList.remove('hidden');
}

// ── EXPENSE CRUD ──
async function saveExpense() {
  const id=document.getElementById('exp-edit-id').value;
  const desc=document.getElementById('exp-desc').value.trim();
  const amt=parseFloat(document.getElementById('exp-amount').value)||0;
  if (!desc) return showToast('Description is required','error');
  if (amt<=0) return showToast('Enter a valid amount','error');
  const record={
    date:document.getElementById('exp-date').value, description:desc,
    category:document.getElementById('exp-cat').value, amount:amt,
    paid_by:document.getElementById('exp-paidby').value, notes:document.getElementById('exp-notes').value.trim(),
  };
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    if (id){await sbClient.from('expenses').update(record).eq('id',id);}
    else   {await sbClient.from('expenses').insert([record]);}
  } else {
    if (id){const idx=allExpenses.findIndex(e=>e.id===id);if(idx>=0)allExpenses[idx]={...allExpenses[idx],...record};}
    else   {allExpenses.push({...record,id:uid()});}
    localStorage.setItem('sc_expenses',JSON.stringify(allExpenses));
  }
  closeModal('exp-modal'); await loadExpenses(); renderDashboard(); populateMonthFilters(); populateLogMonths();
  showToast(id?'Expense updated!':'Expense recorded!','success');
}

function editExpense(id) {
  const e=allExpenses.find(x=>x.id===id); if (!e) return;
  document.getElementById('exp-modal-title').textContent='Edit Expense';
  document.getElementById('exp-edit-id').value=e.id; document.getElementById('exp-date').value=e.date;
  document.getElementById('exp-desc').value=e.description; document.getElementById('exp-cat').value=e.category;
  document.getElementById('exp-amount').value=e.amount; document.getElementById('exp-paidby').value=e.paid_by||'Cash';
  document.getElementById('exp-notes').value=e.notes||'';
  document.getElementById('exp-modal').classList.remove('hidden');
}

// ── BILL CRUD ──
async function saveBill() {
  const id=document.getElementById('bill-edit-id').value;
  const amount=parseFloat(document.getElementById('bill-amount').value)||0;
  if (amount<=0) return showToast('Enter a valid amount','error');
  const record={
    type:document.getElementById('bill-type').value, month_year:document.getElementById('bill-month').value,
    amount, due_date:document.getElementById('bill-duedate').value||null,
    paid:document.getElementById('bill-paid').value, notes:document.getElementById('bill-notes').value.trim(),
  };
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    if (id){await sbClient.from('bills').update(record).eq('id',id);}
    else   {await sbClient.from('bills').insert([record]);}
  } else {
    if (id){const idx=allBills.findIndex(b=>b.id===id);if(idx>=0)allBills[idx]={...allBills[idx],...record};}
    else   {allBills.push({...record,id:uid()});}
    localStorage.setItem('sc_bills',JSON.stringify(allBills));
  }
  closeModal('bill-modal'); await loadBills(); renderDashboard();
  showToast(id?'Bill updated!':'Bill saved!','success');
}

function editBill(id) {
  const b=allBills.find(x=>x.id===id); if (!b) return;
  document.getElementById('bill-modal-title').textContent='Edit Bill';
  document.getElementById('bill-edit-id').value=b.id; document.getElementById('bill-type').value=b.type;
  document.getElementById('bill-month').value=b.month_year; document.getElementById('bill-amount').value=b.amount;
  document.getElementById('bill-duedate').value=b.due_date||''; document.getElementById('bill-paid').value=b.paid;
  document.getElementById('bill-notes').value=b.notes||'';
  document.getElementById('bill-modal').classList.remove('hidden');
}

// ── DELETE ──
function confirmDelete(table,id,label) {
  document.getElementById('confirm-msg').textContent=`Delete "${label}"? This cannot be undone.`;
  document.getElementById('confirm-ok-btn').onclick=()=>doDelete(table,id);
  document.getElementById('confirm-modal').classList.remove('hidden');
}

async function doDelete(table,id) {
  closeModal('confirm-modal');
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    await sbClient.from(table==='inventory'?'inventory':table==='expense'?'expenses':'bills').delete().eq('id',id);
  } else {
    if (table==='inventory'){allInventory=allInventory.filter(i=>i.id!==id);localStorage.setItem('sc_inventory',JSON.stringify(allInventory));}
    if (table==='expense')  {allExpenses=allExpenses.filter(e=>e.id!==id);localStorage.setItem('sc_expenses',JSON.stringify(allExpenses));}
    if (table==='bill')     {allBills=allBills.filter(b=>b.id!==id);localStorage.setItem('sc_bills',JSON.stringify(allBills));}
  }
  if (table==='inventory'){await loadInventory();renderDashboard();}
  if (table==='expense')  {await loadExpenses();renderDashboard();}
  if (table==='bill')     {await loadBills();renderDashboard();}
  showToast('Deleted successfully','success');
}

// =============================================
//  DASHBOARD
// =============================================
function renderDashboard() {
  document.getElementById('stat-items').textContent=allInventory.length;
  const low=allInventory.filter(i=>(parseFloat(i.quantity)||0)<=(parseFloat(i.min_stock)||0));
  document.getElementById('stat-low').textContent=low.length;
  const tm=new Date().toISOString().slice(0,7);
  const mt=allExpenses.filter(e=>(e.date||'').startsWith(tm)).reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  document.getElementById('stat-expenses').textContent='₹'+mt.toLocaleString('en-IN');
  document.getElementById('stat-rent').textContent=rentConfig?'₹'+parseFloat(rentConfig.amount).toLocaleString('en-IN'):'—';
  document.getElementById('dash-lowstock').innerHTML=!low.length
    ?'<div class="empty-state" style="padding:1rem;font-size:0.82rem">✅ All items well stocked</div>'
    :low.slice(0,6).map(i=>`<div class="panel-row"><span>${esc(i.name)}</span><span class="badge-low">${i.quantity} ${i.unit}</span></div>`).join('');
  document.getElementById('dash-recent-expenses').innerHTML=!allExpenses.length
    ?'<div class="empty-state" style="padding:1rem;font-size:0.82rem">No expenses yet</div>'
    :allExpenses.slice(0,6).map(e=>`<div class="panel-row"><span>${esc(e.description)}</span><span>₹${parseFloat(e.amount).toFixed(0)}</span></div>`).join('');
}

// =============================================
//  RESTOCK
// =============================================
function renderRestockList() {
  const low=allInventory.filter(i=>(parseFloat(i.quantity)||0)<=(parseFloat(i.min_stock)||0));
  const el=document.getElementById('restock-grid');
  if (!low.length){el.innerHTML='<div class="empty-state" style="padding:3rem"><div class="empty-icon">✅</div>All items are stocked well!</div>';return;}
  el.innerHTML=low.map(i=>{
    const q=parseFloat(i.quantity)||0;
    return `<div class="restock-card"><div class="restock-card-name">${esc(i.name)}</div><div class="restock-card-info">Category: ${esc(i.category||'—')}<br>Current: ${q} ${esc(i.unit||'')}<br>Min Required: ${i.min_stock} ${esc(i.unit||'')}${i.supplier?'<br>Supplier: '+esc(i.supplier):''}</div><span class="restock-urgency ${q===0?'urgency-critical':'urgency-low'}">${q===0?'🚨 Out of Stock':'⚠️ Low Stock'}</span></div>`;
  }).join('');
}

// =============================================
//  MONTHLY LOG
// =============================================
function populateLogMonths() {
  const months=new Set();
  allExpenses.forEach(e=>{if(e.date)months.add(e.date.slice(0,7));});
  allBills.forEach(b=>{if(b.month_year)months.add(b.month_year);});
  months.add(new Date().toISOString().slice(0,7));
  const sel=document.getElementById('log-month-select');
  sel.innerHTML=[...months].sort().reverse().map(m=>`<option value="${m}">${formatMonth(m)}</option>`).join('');
  renderMonthlyLog();
}

function renderMonthlyLog() {
  const month=document.getElementById('log-month-select').value; if (!month) return;
  const exps=allExpenses.filter(e=>(e.date||'').startsWith(month));
  const bils=allBills.filter(b=>b.month_year===month);
  const et=exps.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const bt=bils.reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
  const ra=rentConfig?parseFloat(rentConfig.amount)||0:0;
  const gt=et+bt+ra;
  let html=`<div class="stat-grid" style="margin-bottom:1.5rem">
    <div class="stat-card"><div class="stat-icon">🛒</div><div class="stat-info"><div class="stat-label">Expenses</div><div class="stat-value">₹${et.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">🧾</div><div class="stat-info"><div class="stat-label">Bills</div><div class="stat-value">₹${bt.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">🏠</div><div class="stat-info"><div class="stat-label">Rent</div><div class="stat-value">₹${ra.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-info"><div class="stat-label">Grand Total</div><div class="stat-value" style="color:var(--accent2)">₹${gt.toLocaleString('en-IN')}</div></div></div>
  </div>`;
  if (exps.length) html+=`<div class="log-section"><div class="log-section-header"><span>🛒 Expenses</span><span class="log-total">₹${et.toLocaleString('en-IN')}</span></div><div class="table-wrap" style="border:none;border-radius:0"><table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Paid By</th></tr></thead><tbody>${exps.map(e=>`<tr><td>${formatDate(e.date)}</td><td>${esc(e.description)}</td><td>${esc(e.category)}</td><td>₹${parseFloat(e.amount).toFixed(2)}</td><td>${esc(e.paid_by||'—')}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (bils.length) html+=`<div class="log-section"><div class="log-section-header"><span>🧾 Bills</span><span class="log-total">₹${bt.toLocaleString('en-IN')}</span></div><div class="table-wrap" style="border:none;border-radius:0"><table class="data-table"><thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Notes</th></tr></thead><tbody>${bils.map(b=>`<tr><td>${esc(b.type)}</td><td>₹${parseFloat(b.amount).toFixed(2)}</td><td><span class="${b.paid==='Paid'?'paid-badge':'unpaid-badge'}">${b.paid}</span></td><td>${esc(b.notes||'—')}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (!exps.length&&!bils.length) html+=`<div class="empty-state"><div class="empty-icon">📅</div>No records for ${formatMonth(month)}</div>`;
  document.getElementById('monthly-log-content').innerHTML=html;
}

function populateMonthFilters() {
  const months=new Set(); allExpenses.forEach(e=>{if(e.date)months.add(e.date.slice(0,7));});
  document.getElementById('exp-month-filter').innerHTML='<option value="">All Months</option>'+[...months].sort().reverse().map(m=>`<option value="${m}">${formatMonth(m)}</option>`).join('');
}

// =============================================
//  UTILS
// =============================================
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function esc(s) { return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'):''; }
function formatDate(d) { if(!d)return'—'; try{return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}catch{return d;} }
function formatMonth(m) { if(!m)return''; const[y,mo]=m.split('-'); return['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1]+' '+y; }
function ordinal(n) { const s=['th','st','nd','rd'],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
let toastTimer;
function showToast(msg,type='success') {
  const el=document.getElementById('toast');
  el.textContent=(type==='success'?'✅ ':type==='error'?'❌ ':'ℹ️ ')+msg;
  el.className=`toast ${type}`; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.add('hidden'),3000);
}
