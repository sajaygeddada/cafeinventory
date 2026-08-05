// =============================================
//  Sajay's Café — Inventory Manager
//  script.js — Row D&D + Column D&D + Sorting + Sales Tracker
// =============================================

const SUPABASE_URL  = 'https://cebhmyeelkndpyoysswg.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYmhteWVlbGtuZHB5b3lzc3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzYyOTYsImV4cCI6MjA5MTc1MjI5Nn0._46DfnsLqxgngXhV6xjevYkBZtBjlQCKSNIPtck9Vac';

let sbClient;
try { sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
catch(e) { console.warn('Supabase offline mode', e); }

// =============================================
//  THEME ENGINE
// =============================================
// ── color math ──
function hexToRgb(hex) {
  hex = hex.replace('#','');
  if (hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const n = parseInt(hex,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function rgbToHex(r,g,b) {
  const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#'+c(r)+c(g)+c(b);
}
function mixHex(hex1,hex2,t) {
  const a=hexToRgb(hex1), b=hexToRgb(hex2);
  return rgbToHex(a.r+(b.r-a.r)*t, a.g+(b.g-a.g)*t, a.b+(b.b-a.b)*t);
}
function relLuminance(hex) {
  const {r,g,b}=hexToRgb(hex);
  const [R,G,B]=[r,g,b].map(v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*R+0.7152*G+0.0722*B;
}
function hexToHsl(hex) {
  let {r,g,b}=hexToRgb(hex); r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if (max===min) { h=s=0; }
  else {
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){ case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; default: h=(r-g)/d+4; }
    h/=6;
  }
  return {h:h*360, s:s*100, l:l*100};
}
function hslToHex(h,s,l) {
  h=((h%360)+360)%360; h/=360; s/=100; l/=100;
  let r,g,b;
  if (s===0) { r=g=b=l; }
  else {
    const hue2rgb=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return rgbToHex(r*255,g*255,b*255);
}

// ── full theme derivation from a small base ──
// base: {bg,surface,primary,accent,text, muted?,success?,warning?,danger?,info?}
function deriveFullTheme(base) {
  const isDark = relLuminance(base.bg) < 0.5;
  const edge = isDark ? '#ffffff' : '#000000';
  return {
    bg: base.bg, surface: base.surface,
    surface2: mixHex(base.surface, edge, isDark?0.07:0.05),
    surface3: mixHex(base.surface, edge, isDark?0.14:0.09),
    border:   mixHex(base.surface, base.text, 0.16),
    accent:   base.primary, accent2: base.accent,
    accent3:  mixHex(base.accent, '#ffffff', 0.35),
    text:     base.text,
    muted:    base.muted || mixHex(base.text, base.surface, 0.45),
    success:  base.success || '#22c55e',
    warning:  base.warning || '#eab308',
    danger:   base.danger  || '#ef4444',
    info:     base.info    || '#0ea5e9',
  };
}

// ── 13 themes: your original look + the 12-theme set ──
const THEME_PRESETS = {
  'dakhni-amber': { label:'☕ Dakhni Amber (Original)', isRaw:true, vars:{
    bg:'#0f0b08',surface:'#1a1410',surface2:'#231c16',surface3:'#2e251d',border:'#3a2e24',
    accent:'#c97d2e',accent2:'#e6a455',accent3:'#f2c47a',danger:'#c94040',success:'#4caf82',
    warning:'#e8a030',info:'#5a9bd6',text:'#f0e8df',muted:'#8a7060' } },
  'coffee-house': { label:'☕ Coffee House', base:{bg:'#F8F5F2',surface:'#FFFFFF',primary:'#6F4E37',accent:'#C49A6C',text:'#2B2B2B'} },
  'matcha':       { label:'🌿 Matcha',       base:{bg:'#F4F9F3',surface:'#FFFFFF',primary:'#4CAF50',accent:'#A5D6A7',text:'#1F2937'} },
  'ocean':        { label:'🌊 Ocean',        base:{bg:'#F2F8FC',surface:'#FFFFFF',primary:'#0288D1',accent:'#4FC3F7',text:'#263238'} },
  'lavender':     { label:'💜 Lavender',     base:{bg:'#F7F4FB',surface:'#FFFFFF',primary:'#7E57C2',accent:'#B39DDB',text:'#2D2D2D'} },
  'sunset':       { label:'🌅 Sunset',       base:{bg:'#FFF3E0',surface:'#FFFFFF',primary:'#F4511E',accent:'#FFB74D',text:'#333333'} },
  'sapphire':     { label:'💎 Sapphire',     base:{bg:'#F4F8FF',surface:'#FFFFFF',primary:'#1565C0',accent:'#64B5F6',text:'#263238'} },
  'midnight':     { label:'🌑 Midnight',     base:{bg:'#121212',surface:'#1E1E1E',primary:'#3B82F6',accent:'#60A5FA',text:'#F8FAFC'} },
  'espresso':     { label:'☕ Espresso',     base:{bg:'#1B1612',surface:'#2A221D',primary:'#8D6E63',accent:'#D7CCC8',text:'#F5F5F5'} },
  'galaxy':       { label:'🌌 Galaxy',       base:{bg:'#0D1117',surface:'#161B22',primary:'#58A6FF',accent:'#A371F7',text:'#F0F6FC'} },
  'forest-night': { label:'🌲 Forest Night', base:{bg:'#101914',surface:'#1A2A21',primary:'#43A047',accent:'#81C784',text:'#F5F5F5'} },
  'luxury-black': { label:'🖤 Luxury Black', base:{bg:'#0A0A0A',surface:'#171717',primary:'#D4AF37',accent:'#F5F5F5',text:'#F0F0F0'} },
  'cyberpunk':    { label:'⚡ Cyberpunk',    base:{bg:'#0A0F1F',surface:'#141B2D',primary:'#00E5FF',accent:'#FF00FF',text:'#F0F6FC'} },
};

const currentTheme = { key:'dakhni-amber', customBase:null };
const CHART_FIELDS = ['total','general','cigarettes','milk','cash','online'];
let chartColors = {};

function getThemeVars(key, customBase) {
  if (key==='custom' && customBase) return deriveFullTheme(customBase);
  const preset = THEME_PRESETS[key];
  if (!preset) return THEME_PRESETS['dakhni-amber'].vars;
  return preset.isRaw ? preset.vars : deriveFullTheme(preset.base);
}

function generateChartPalette(primaryHex, count) {
  const {h,s} = hexToHsl(primaryHex);
  const useS = Math.max(45, Math.min(s,70));
  return Array.from({length:count}, (_,i)=> hslToHex(h+i*(360/count), useS, 58));
}

function initChartColors() {
  let saved=null;
  try { saved = JSON.parse(localStorage.getItem('sc_chart_colors')); } catch(e){}
  const vars = getThemeVars(currentTheme.key, currentTheme.customBase);
  const palette = generateChartPalette(vars.accent, CHART_FIELDS.length);
  CHART_FIELDS.forEach((f,i)=>{ chartColors[f] = (saved&&saved[f]) ? saved[f] : palette[i]; });
}

function setChartColor(field, hex) {
  chartColors[field]=hex;
  const saved = (()=>{ try{return JSON.parse(localStorage.getItem('sc_chart_colors'))||{};}catch(e){return {};} })();
  saved[field]=hex;
  localStorage.setItem('sc_chart_colors', JSON.stringify(saved));
  if (typeof renderSalesChart==='function') renderSalesChart();
}

function resetChartColors() {
  localStorage.removeItem('sc_chart_colors');
  initChartColors();
  renderChartColorPickers();
  if (typeof renderSalesChart==='function') renderSalesChart();
}

function applyThemeVars(vars) {
  const root = document.documentElement.style;
  Object.entries(vars).forEach(([k,v])=> root.setProperty('--'+k, v));
}

function applyTheme(key, customBase) {
  applyThemeVars(getThemeVars(key, customBase));
  currentTheme.key = key;
  currentTheme.customBase = key==='custom' ? customBase : null;
  localStorage.setItem('sc_theme', JSON.stringify({key, customBase: currentTheme.customBase}));
  initChartColors();
  if (typeof renderThemeGrid==='function') renderThemeGrid();
  if (typeof renderChartColorPickers==='function') renderChartColorPickers();
  if (typeof renderSalesChart==='function' && document.getElementById('sales-chart-canvas')) renderSalesChart();
}

function initTheme() {
  let saved=null;
  try { saved = JSON.parse(localStorage.getItem('sc_theme')); } catch(e){}
  if (saved && saved.key) applyTheme(saved.key, saved.customBase);
  else applyTheme('dakhni-amber');
}
try { initTheme(); } catch(e) { console.warn('Theme init failed, falling back to defaults', e); } // apply immediately so even the login screen is themed

// ── theme UI ──
function renderThemeGrid() {
  const grid = document.getElementById('theme-preset-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(THEME_PRESETS).map(([key,t])=>{
    const v = t.isRaw ? t.vars : deriveFullTheme(t.base);
    const active = currentTheme.key===key;
    return `<button class="theme-swatch${active?' active':''}" onclick="applyTheme('${key}')" title="${t.label}">
      <span class="theme-swatch-preview" style="background:${v.bg}">
        <span style="background:${v.accent}"></span><span style="background:${v.accent2}"></span><span style="background:${v.surface}"></span>
      </span>
      <span class="theme-swatch-label">${t.label}</span>
    </button>`;
  }).join('');
}

function openThemeModal() {
  const v = getThemeVars(currentTheme.key, currentTheme.customBase);
  document.getElementById('custom-bg').value      = v.bg;
  document.getElementById('custom-surface').value = v.surface;
  document.getElementById('custom-primary').value = v.accent;
  document.getElementById('custom-accent').value  = v.accent2;
  document.getElementById('custom-text').value    = v.text;
  document.getElementById('custom-muted').value   = v.muted;
  document.getElementById('custom-success').value = v.success;
  document.getElementById('custom-warning').value = v.warning;
  document.getElementById('custom-danger').value  = v.danger;
  document.getElementById('custom-info').value    = v.info;
  renderThemeGrid();
  renderChartColorPickers();
  openModal('theme-modal');
}

function applyCustomTheme() {
  const g = id => document.getElementById(id).value;
  applyTheme('custom', {
    bg: g('custom-bg'), surface: g('custom-surface'),
    primary: g('custom-primary'), accent: g('custom-accent'),
    text: g('custom-text'), muted: g('custom-muted'),
    success: g('custom-success'), warning: g('custom-warning'),
    danger: g('custom-danger'), info: g('custom-info'),
  });
}

function renderChartColorPickers() {
  const wrap = document.getElementById('chart-color-pickers');
  if (!wrap) return;
  const labels = {total:'Total',general:'General',cigarettes:'Cigarettes',milk:'Milk (packets)',cash:'Cash',online:'Online'};
  wrap.innerHTML = CHART_FIELDS.map(f=>`
    <div class="color-pick-row">
      <label>${labels[f]}</label>
      <input type="color" value="${chartColors[f]||'#c97d2e'}" oninput="setChartColor('${f}', this.value)" />
    </div>`).join('');
}

// ─── DATA STATE ───────────────────────────────
let allInventory = [], allExpenses = [], allBills = [], allDailySales = [], rentConfig = null, billModalPreset = {};

// ─── SALES TAB STATE ───────────────────────────
const salesCal   = { year: new Date().getFullYear(), month: new Date().getMonth() }; // month: 0-11
const salesChart = { metric: 'all', period: 'monthly', type: 'line', weekday: 'all', monthFilter: new Date().toISOString().slice(0,7), chartInstance: null };

function getMismatchFlags(rec) {
  const total=parseFloat(rec.total)||0, cash=parseFloat(rec.cash)||0, online=parseFloat(rec.online)||0;
  const general=parseFloat(rec.general)||0, cig=parseFloat(rec.cigarettes)||0;
  const EPS=0.5;
  const cashOnlineMismatch = !!((total||cash||online) && Math.abs(total-(cash+online))>EPS);
  const genCigMismatch     = !!((total||general||cig) && Math.abs(total-(general+cig))>EPS);
  return { cashOnlineMismatch, genCigMismatch, any: cashOnlineMismatch||genCigMismatch };
}

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
    type:      { label:'Type',       sortKey:'type',       render: b=>{
      const icons = { Rent:'🏠', Electricity:'⚡', Water:'💧', Internet:'🌐', Gas:'🔥', Other:'📋' };
      return `${icons[b.type]||'📋'} ${esc(b.type)}`;
    }},
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

// ─── AUTH (Supabase Auth) ──────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise).then(v=>({timedOut:false, value:v})),
    new Promise(resolve=>setTimeout(()=>resolve({timedOut:true}), ms)),
  ]);
}

async function checkSession() {
  if (!sbClient) return;
  const r = await withTimeout(sbClient.auth.getSession(), 8000);
  if (r.timedOut) { console.warn('Session check timed out — Supabase unreachable'); return; }
  const { data:{ session } } = r.value;
  if (session) showApp();
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showLoginError();
  const btn = document.getElementById('login-btn');
  if (btn) { btn.disabled=true; btn.textContent='Signing in…'; }
  const r = await withTimeout(sbClient.auth.signInWithPassword({ email, password: pass }), 10000);
  if (btn) { btn.disabled=false; btn.textContent='Sign In'; }
  if (r.timedOut) return showLoginError('Connection timed out. Check your internet and try again.');
  const { error } = r.value;
  if (error) return showLoginError();
  document.getElementById('login-error').classList.add('hidden');
  showApp();
}
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg || 'Incorrect credentials. Try again.';
  el.classList.remove('hidden');
  document.getElementById('login-pass').value='';
}
async function handleLogout() { await sbClient.auth.signOut(); location.reload(); }
function showApp() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); loadAll(); }
document.addEventListener('keydown', e => { if (e.key==='Enter' && !document.getElementById('login-screen').classList.contains('hidden')) handleLogin(); });

async function updateDBStatus() {
  const el = document.getElementById('db-status');
  if (!sbClient || SUPABASE_URL==='YOUR_SUPABASE_URL') { el.textContent='● DB not configured'; el.className='db-status error'; return; }
  const r = await withTimeout(sbClient.from('inventory').select('id').limit(1), 8000);
  if (r.timedOut) { el.textContent='● Connection timed out — check Supabase project status'; el.className='db-status error'; return; }
  const { error } = r.value;
  if (error) { el.textContent='● DB error'; el.className='db-status error'; return; }
  el.textContent='● Supabase Connected'; el.className='db-status connected';
}

async function loadAll() {
  await Promise.all([loadInventory(),loadExpenses(),loadBills(),loadRent(),loadDailySales()]);
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
  // Mini card lists — Rent bills, Electricity, Water, Other (Internet/Gas/Other)
  const cardConfig = [
    { type: 'Rent',        id: 'rent-bills-list',  match: b => b.type === 'Rent' },
    { type: 'Electricity', id: 'elec-list',         match: b => b.type === 'Electricity' },
    { type: 'Water',       id: 'water-list',        match: b => b.type === 'Water' },
    { type: 'Other',       id: 'other-list',        match: b => !['Rent','Electricity','Water'].includes(b.type) },
  ];

  cardConfig.forEach(({ id, match }) => {
    const subset = allBills.filter(match);
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = !subset.length
      ? '<div class="empty-state" style="padding:0.75rem;font-size:0.8rem">No records yet</div>'
      : subset.slice(0,4).map(b => `
          <div class="bill-mini-row">
            <span>${b.month_year}</span>
            <span>₹${parseFloat(b.amount).toFixed(0)}</span>
            <span class="${b.paid==='Paid'?'paid-badge':'unpaid-badge'}">${b.paid}</span>
          </div>`).join('');
  });

  renderBillsTableFull();
}

// =============================================
//  RENT CONFIG
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
//  DAILY SALES  (Expenses → Sales sub-tab)
// =============================================
async function loadDailySales() {
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    const {data,error}=await sbClient.from('daily_sales').select('*').order('sale_date');
    if (!error) allDailySales=data||[];
  } else { allDailySales=JSON.parse(localStorage.getItem('sc_sales')||'[]'); }
}

function findSalesByDate(dateStr) { return allDailySales.find(s=>s.sale_date===dateStr); }

function switchExpSubTab(name, btn) {
  document.getElementById('exp-sub-log').classList.toggle('hidden', name!=='log');
  document.getElementById('exp-sub-sales').classList.toggle('hidden', name!=='sales');
  document.querySelectorAll('.exp-subnav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (name==='sales') {
    document.getElementById('sales-month-filter').value = salesChart.monthFilter;
    renderSalesCalendar(); renderSalesSummary(); renderSalesChart(); renderChartColorPickers();
  }
}

// ── CALENDAR ──
function shiftSalesMonth(delta) {
  salesCal.month += delta;
  if (salesCal.month<0)  { salesCal.month=11; salesCal.year--; }
  if (salesCal.month>11) { salesCal.month=0;  salesCal.year++; }
  renderSalesCalendar();
}

function renderSalesCalendar() {
  const y=salesCal.year, m=salesCal.month;
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('sales-cal-label').textContent = `${monthNames[m]} ${y}`;

  const firstDow     = new Date(y,m,1).getDay();
  const daysInMonth  = new Date(y,m+1,0).getDate();
  const todayStr     = new Date().toISOString().split('T')[0];

  let cells='';
  for (let i=0;i<firstDow;i++) cells+=`<div class="cal-cell cal-empty"></div>`;
  for (let d=1; d<=daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rec     = findSalesByDate(dateStr);
    const isToday = dateStr===todayStr;
    const mism    = rec ? getMismatchFlags(rec) : null;
    const flagCls = mism&&mism.any ? ' cal-mismatch' : '';
    cells += `<div class="cal-cell${rec?' has-data':''}${isToday?' cal-today':''}${flagCls}" onclick="openSalesEntry('${dateStr}')" title="${rec?(mism.any?'⚠ Mismatch — click to review and correct':'Click to edit this day'):'Click to add sales for this day'}">
      <span class="cal-daynum">${d}</span>
      ${rec ? `<span class="cal-total">₹${Math.round(rec.total||0).toLocaleString('en-IN')}</span>
        <span class="cal-line">Gen ₹${Math.round(rec.general||0).toLocaleString('en-IN')}</span>
        <span class="cal-line">🚬 ₹${Math.round(rec.cigarettes||0).toLocaleString('en-IN')}</span>
        <span class="cal-line">🥛 ${Math.round(rec.milk||0)} pkt</span>` : ''}
    </div>`;
  }
  document.getElementById('sales-cal-grid').innerHTML = cells;
}

// ── SUMMARY CARDS ──
function renderSalesSummary() {
  const todayStr  = new Date().toISOString().split('T')[0];
  const thisMonth = todayStr.slice(0,7);
  const todayRec  = findSalesByDate(todayStr);
  const monthRecs = allDailySales.filter(s=>s.sale_date.startsWith(thisMonth));
  const monthTotal  = monthRecs.reduce((s,r)=>s+(parseFloat(r.total)||0),0);
  const monthCash   = monthRecs.reduce((s,r)=>s+(parseFloat(r.cash)||0),0);
  const monthOnline = monthRecs.reduce((s,r)=>s+(parseFloat(r.online)||0),0);
  const avgDaily    = monthRecs.length ? monthTotal/monthRecs.length : 0;

  document.getElementById('sales-summary').innerHTML = `
    <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-info"><div class="stat-label">Today's Sales</div><div class="stat-value">${todayRec?'₹'+Math.round(todayRec.total).toLocaleString('en-IN'):'—'}</div></div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-info"><div class="stat-label">This Month</div><div class="stat-value">₹${monthTotal.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-info"><div class="stat-label">Daily Average</div><div class="stat-value">₹${Math.round(avgDaily).toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">💳</div><div class="stat-info"><div class="stat-label">Cash / Online (Month)</div><div class="stat-value" style="font-size:1.05rem">₹${Math.round(monthCash).toLocaleString('en-IN')} / ₹${Math.round(monthOnline).toLocaleString('en-IN')}</div></div></div>
  `;
}

// ── ENTRY MODAL ──
function openSalesEntry(dateStr) {
  const rec = findSalesByDate(dateStr);
  document.getElementById('sales-modal-title').textContent = rec ? 'Edit Sales — '+formatDate(dateStr) : 'Add Sales — '+formatDate(dateStr);
  document.getElementById('sales-date').value       = dateStr;
  document.getElementById('sales-total').value      = rec?.total ?? '';
  document.getElementById('sales-general').value    = rec?.general ?? '';
  document.getElementById('sales-cigarettes').value = rec?.cigarettes ?? '';
  document.getElementById('sales-milk').value       = rec?.milk ?? '';
  document.getElementById('sales-cash').value       = rec?.cash ?? '';
  document.getElementById('sales-online').value     = rec?.online ?? '';
  document.getElementById('sales-notes').value      = rec?.notes ?? '';
  const delBtn = document.getElementById('sales-delete-btn');
  delBtn.classList.toggle('hidden', !rec);
  if (rec) delBtn.onclick = () => confirmDelete('sales', rec.id, 'the sales entry for '+formatDate(dateStr));
  updateSalesCheckHints();
  document.getElementById('sales-modal').classList.remove('hidden');
}

function updateSalesCheckHints() {
  const g = id => parseFloat(document.getElementById(id).value)||0;
  const total=g('sales-total'), cash=g('sales-cash'), online=g('sales-online'), general=g('sales-general'), cig=g('sales-cigarettes');

  const h1 = document.getElementById('sales-check-hint-1');
  const sum1=cash+online, diff1=total-sum1, close1=Math.abs(diff1)<0.5;
  if (!total && !sum1) { h1.textContent=''; h1.className='sales-check-hint'; }
  else { h1.textContent = `Cash + Online = ₹${sum1.toLocaleString('en-IN')}${close1?' — matches Total ✓':` (₹${Math.abs(diff1).toLocaleString('en-IN')} ${diff1>0?'short of':'over'} Total)`}`; h1.className='sales-check-hint '+(close1?'ok':'warn'); }

  const h2 = document.getElementById('sales-check-hint-2');
  const sum2=general+cig, diff2=total-sum2, close2=Math.abs(diff2)<0.5;
  if (!total && !sum2) { h2.textContent=''; h2.className='sales-check-hint'; }
  else { h2.textContent = `General + Cigarettes = ₹${sum2.toLocaleString('en-IN')}${close2?' — matches Total ✓':` (₹${Math.abs(diff2).toLocaleString('en-IN')} ${diff2>0?'short of':'over'} Total)`}`; h2.className='sales-check-hint '+(close2?'ok':'warn'); }
}

async function saveSalesEntry() {
  const sale_date = document.getElementById('sales-date').value;
  if (!sale_date) return showToast('Pick a date first','error');
  const record = {
    sale_date,
    total:      parseFloat(document.getElementById('sales-total').value)||0,
    general:    parseFloat(document.getElementById('sales-general').value)||0,
    cigarettes: parseFloat(document.getElementById('sales-cigarettes').value)||0,
    milk:       parseFloat(document.getElementById('sales-milk').value)||0,
    cash:       parseFloat(document.getElementById('sales-cash').value)||0,
    online:     parseFloat(document.getElementById('sales-online').value)||0,
    notes:      document.getElementById('sales-notes').value.trim(),
  };
  if (sbClient&&SUPABASE_URL!=='YOUR_SUPABASE_URL') {
    const {error} = await sbClient.from('daily_sales').upsert([record], {onConflict:'sale_date'});
    if (error) return showToast('Save failed: '+error.message,'error');
  } else {
    const idx=allDailySales.findIndex(s=>s.sale_date===sale_date);
    if (idx>=0) allDailySales[idx]={...allDailySales[idx],...record};
    else allDailySales.push({...record,id:uid()});
    localStorage.setItem('sc_sales',JSON.stringify(allDailySales));
  }
  closeModal('sales-modal');
  await loadDailySales();
  renderSalesCalendar(); renderSalesSummary(); renderSalesChart();
  showToast('Sales entry saved!','success');
}

// ── EXPORT ──
function exportSalesCSV() {
  if (!allDailySales.length) return showToast('No sales data to export yet','error');
  const rows = [['Date','Total','General','Cigarettes','Milk (packets)','Cash','Online','Notes']];
  [...allDailySales].sort((a,b)=>a.sale_date.localeCompare(b.sale_date)).forEach(r=>{
    rows.push([r.sale_date, r.total||0, r.general||0, r.cigarettes||0, r.milk||0, r.cash||0, r.online||0, r.notes||'']);
  });
  const csv = rows.map(row=>row.map(cell=>{
    const s=String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`sajays-cafe-sales-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Sales exported!','success');
}

// ── TREND CHART ──
function setSalesMetric(metric, btn) {
  salesChart.metric = metric;
  document.querySelectorAll('.sales-metric-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSalesChart();
}
function setSalesPeriod(period, btn) {
  salesChart.period = period;
  document.querySelectorAll('.sales-period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSalesChart();
}
function setSalesChartType(type, btn) {
  salesChart.type = type;
  document.querySelectorAll('.sales-type-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSalesChart();
}
function setSalesWeekday(day, btn) {
  salesChart.weekday = day;
  document.querySelectorAll('.sales-weekday-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('sales-month-filter').classList.toggle('hidden', day==='all');
  renderSalesChart();
}
function setSalesChartMonth(value) {
  salesChart.monthFilter = value;
  renderSalesChart();
}

function bucketKeyForPeriod(dateStr, period) {
  const d = new Date(dateStr+'T00:00:00');
  if (period==='weekly') {
    const daysSinceEpoch = Math.floor(d.getTime()/86400000);
    const weekIndex = Math.floor((daysSinceEpoch+4)/7);
    const weekStart = new Date(weekIndex*7*86400000 - 4*86400000);
    return weekStart.toISOString().slice(0,10);
  }
  if (period==='monthly')   return dateStr.slice(0,7);
  if (period==='quarterly') return `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`;
  return String(d.getFullYear()); // yearly
}

function formatBucketLabel(key, period) {
  if (period==='weekly')    return 'Wk '+formatDate(key);
  if (period==='monthly')   return formatMonth(key);
  return key; // quarterly "2026-Q3" and yearly "2026" are already readable
}

function aggregateSales() {
  if (salesChart.weekday !== 'all') {
    const monthPrefix = salesChart.monthFilter;
    const dayNum = parseInt(salesChart.weekday,10);
    const rows = allDailySales
      .filter(r=>r.sale_date.startsWith(monthPrefix) && new Date(r.sale_date+'T00:00:00').getDay()===dayNum)
      .sort((a,b)=>a.sale_date.localeCompare(b.sale_date));
    return {
      labels: rows.map(r=>r.sale_date),
      data: rows.map(r=>({total:+r.total||0,general:+r.general||0,cigarettes:+r.cigarettes||0,milk:+r.milk||0,cash:+r.cash||0,online:+r.online||0})),
      isDayMode: true,
    };
  }
  const period = salesChart.period;
  const buckets = {};
  allDailySales.forEach(r=>{
    const key = bucketKeyForPeriod(r.sale_date, period);
    if (!buckets[key]) buckets[key]={total:0,general:0,cigarettes:0,milk:0,cash:0,online:0};
    ['total','general','cigarettes','milk','cash','online'].forEach(f=>buckets[key][f]+=parseFloat(r[f])||0);
  });
  const keys = Object.keys(buckets).sort();
  const recentKeys = keys.slice(-12); // keep the chart readable — last 12 buckets
  return { labels: recentKeys, data: recentKeys.map(k=>buckets[k]), isDayMode:false };
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim() || '#8a7060'; }

function renderSalesChart() {
  const canvas = document.getElementById('sales-chart-canvas');
  if (!canvas || typeof Chart==='undefined') return;
  const {labels, data, isDayMode} = aggregateSales();
  const metric = salesChart.metric;
  const fields = metric==='all' ? CHART_FIELDS.slice() : [metric];
  const fieldLabels = {total:'Total',general:'General',cigarettes:'Cigarettes',milk:'Milk (packets)',cash:'Cash',online:'Online'};
  const isBar = (salesChart.type||'line')==='bar';
  const muted = cssVar('muted'), gridColor = cssVar('border');
  const displayLabels = isDayMode
    ? labels.map(d=>formatDate(d))
    : labels.map(k=>formatBucketLabel(k,salesChart.period));

  const datasets = fields.map(f=>{
    const color = chartColors[f] || '#c97d2e';
    return {
      label: fieldLabels[f],
      data: data.map(d=>d[f]),
      borderColor: color,
      backgroundColor: isBar ? color+'99' : color+'33',
      tension: 0.35, fill: !isBar, borderWidth: 2, pointRadius: 3, pointBackgroundColor: color,
      yAxisID: f==='milk' ? 'y1' : 'y',
    };
  });

  const scales = {
    x: { ticks:{ color: muted }, grid:{ color: gridColor } },
    y: { ticks:{ color: muted }, grid:{ color: gridColor }, beginAtZero:true, title:{display:fields.length>1,text:'₹',color:muted} },
  };
  if (fields.includes('milk')) {
    scales.y1 = { position:'right', beginAtZero:true, ticks:{color:muted}, grid:{drawOnChartArea:false}, title:{display:true,text:'packets',color:muted} };
  }

  if (salesChart.chartInstance) salesChart.chartInstance.destroy();
  salesChart.chartInstance = new Chart(canvas.getContext('2d'), {
    type: salesChart.type||'line',
    data: { labels: displayLabels, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color: muted } } },
      scales,
    }
  });
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
  document.getElementById('bill-type').value=billModalPreset?.type||'Rent';
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
    const tbl = table==='inventory'?'inventory':table==='expense'?'expenses':table==='sales'?'daily_sales':'bills';
    await sbClient.from(tbl).delete().eq('id',id);
  } else {
    if (table==='inventory'){allInventory=allInventory.filter(i=>i.id!==id);localStorage.setItem('sc_inventory',JSON.stringify(allInventory));}
    if (table==='expense')  {allExpenses=allExpenses.filter(e=>e.id!==id);localStorage.setItem('sc_expenses',JSON.stringify(allExpenses));}
    if (table==='bill')     {allBills=allBills.filter(b=>b.id!==id);localStorage.setItem('sc_bills',JSON.stringify(allBills));}
    if (table==='sales')    {allDailySales=allDailySales.filter(s=>s.id!==id);localStorage.setItem('sc_sales',JSON.stringify(allDailySales));}
  }
  if (table==='inventory'){await loadInventory();renderDashboard();}
  if (table==='expense')  {await loadExpenses();renderDashboard();}
  if (table==='bill')     {await loadBills();renderDashboard();}
  if (table==='sales')    {closeModal('sales-modal');await loadDailySales();renderSalesCalendar();renderSalesSummary();renderSalesChart();}
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

  // Break down bills by type for the summary cards
  const rentBillsAmt = bils.filter(b=>b.type==='Rent').reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
  const elecAmt      = bils.filter(b=>b.type==='Electricity').reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
  const waterAmt     = bils.filter(b=>b.type==='Water').reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
  const otherBillAmt = bt - rentBillsAmt - elecAmt - waterAmt;

  let html=`<div class="stat-grid" style="margin-bottom:1.5rem">
    <div class="stat-card"><div class="stat-icon">🛒</div><div class="stat-info"><div class="stat-label">Expenses</div><div class="stat-value">₹${et.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">🧾</div><div class="stat-info"><div class="stat-label">Bills</div><div class="stat-value">₹${bt.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">🏠</div><div class="stat-info"><div class="stat-label">Rent Config</div><div class="stat-value">₹${ra.toLocaleString('en-IN')}</div></div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-info"><div class="stat-label">Grand Total</div><div class="stat-value" style="color:var(--accent2)">₹${gt.toLocaleString('en-IN')}</div></div></div>
  </div>`;

  // Bills breakdown sub-summary if any bills exist
  if (bils.length) {
    html += `<div class="stat-grid" style="margin-bottom:1.5rem;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      ${rentBillsAmt>0?`<div class="stat-card"><div class="stat-icon">🏠</div><div class="stat-info"><div class="stat-label">Rent Bills</div><div class="stat-value" style="font-size:1.1rem">₹${rentBillsAmt.toLocaleString('en-IN')}</div></div></div>`:''}
      ${elecAmt>0?`<div class="stat-card"><div class="stat-icon">⚡</div><div class="stat-info"><div class="stat-label">Electricity</div><div class="stat-value" style="font-size:1.1rem">₹${elecAmt.toLocaleString('en-IN')}</div></div></div>`:''}
      ${waterAmt>0?`<div class="stat-card"><div class="stat-icon">💧</div><div class="stat-info"><div class="stat-label">Water</div><div class="stat-value" style="font-size:1.1rem">₹${waterAmt.toLocaleString('en-IN')}</div></div></div>`:''}
      ${otherBillAmt>0?`<div class="stat-card"><div class="stat-icon">🌐</div><div class="stat-info"><div class="stat-label">Other Bills</div><div class="stat-value" style="font-size:1.1rem">₹${otherBillAmt.toLocaleString('en-IN')}</div></div></div>`:''}
    </div>`;
  }

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
