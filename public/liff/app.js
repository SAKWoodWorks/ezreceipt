let userId = null;
let sessionToken = null;
let allReceipts = [];

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function init() {
  await liff.init({ liffId: window.LIFF_ID });
  if (!liff.isLoggedIn()) { liff.login(); return; }

  const accessToken = liff.getAccessToken();
  const res = await fetch('/api/liff/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken })
  });
  const data = await res.json();
  userId = data.userId;
  sessionToken = data.sessionToken;

  document.getElementById('user-name').textContent = data.displayName || '';
  populateMonthFilter();
  await loadReceipts();
}

function populateMonthFilter() {
  const sel = document.getElementById('filter-month');
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleString('th-TH', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

async function loadReceipts() {
  document.getElementById('receipt-list').innerHTML = '<div class="loading">กำลังโหลด...</div>';
  const month = document.getElementById('filter-month').value;
  const category = document.getElementById('filter-category').value;
  const params = new URLSearchParams({ userId });
  if (month) params.set('month', month);
  if (category) params.set('category', category);

  const res = await fetch('/api/receipts?' + params, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  allReceipts = await res.json();
  renderReceipts();
}

function renderReceipts() {
  const list = document.getElementById('receipt-list');
  const total = allReceipts.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  document.getElementById('footer-total').textContent = '฿' + total.toLocaleString('th-TH');

  if (!allReceipts.length) {
    list.innerHTML = '<div class="empty">ไม่พบใบเสร็จในช่วงนี้</div>';
    return;
  }

  list.innerHTML = allReceipts.map(r => `
    <div class="receipt-card">
      <div class="row">
        <span class="store">${esc(r.store_name || 'ไม่ระบุร้าน')}</span>
        <span class="amount">฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</span>
      </div>
      <div class="meta">
        ${esc(r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-')}
        &nbsp;·&nbsp;
        <span class="category-badge">${esc(r.category || 'ไม่ระบุ')}</span>
      </div>
    </div>
  `).join('');
}

window.addEventListener('DOMContentLoaded', init);
