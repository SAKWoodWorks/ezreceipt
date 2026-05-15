let userId = null;
let sessionToken = null;
let allReceipts = [];
let editReceiptId = null;

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

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'edit' && params.get('receipt_id')) {
    await initEditMode(params.get('receipt_id'));
  } else {
    populateMonthFilter();
    await loadReceipts();
  }
}

async function initEditMode(receiptId) {
  editReceiptId = receiptId;
  document.querySelector('.filter-bar').style.display = 'none';
  document.getElementById('receipt-list').style.display = 'none';
  document.querySelector('.footer-bar').style.display = 'none';
  document.getElementById('edit-view').style.display = 'block';

  const msg = document.getElementById('edit-message');

  try {
    const res = await fetch(`/api/receipts/${receiptId}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });

    if (res.status === 403) {
      msg.textContent = '❌ ไม่มีสิทธิ์แก้ไขใบเสร็จนี้';
      document.getElementById('edit-submit-btn').disabled = true;
      return;
    }
    if (res.status === 404) {
      msg.textContent = '❌ ไม่พบใบเสร็จ';
      document.getElementById('edit-submit-btn').disabled = true;
      return;
    }

    const receipt = await res.json();

    if (receipt.status !== 'pending') {
      msg.textContent = '✅ บันทึกแล้ว ไม่สามารถแก้ไขได้';
      document.getElementById('edit-submit-btn').disabled = true;
      return;
    }

    document.getElementById('edit-store').value = receipt.store_name || '';
    document.getElementById('edit-date').value = receipt.date_on_receipt
      ? String(receipt.date_on_receipt).slice(0, 10) : '';
    document.getElementById('edit-total').value = receipt.total_amount || '';
    const catSel = document.getElementById('edit-category');
    if (receipt.category) {
      for (const opt of catSel.options) {
        if (opt.value === receipt.category) { opt.selected = true; break; }
      }
    }
  } catch (err) {
    msg.textContent = '❌ โหลดข้อมูลไม่สำเร็จ';
  }
}

async function submitEdit() {
  const msg = document.getElementById('edit-message');
  msg.textContent = 'กำลังบันทึก...';

  const body = {
    store_name: document.getElementById('edit-store').value || null,
    date_on_receipt: document.getElementById('edit-date').value || null,
    total_amount: parseFloat(document.getElementById('edit-total').value) || null,
    category: document.getElementById('edit-category').value,
    status: 'confirmed'
  };

  try {
    const res = await fetch(`/api/receipts/${editReceiptId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const data = await res.json();
      msg.textContent = `❌ ${data.error || 'บันทึกไม่สำเร็จ'}`;
      return;
    }

    msg.textContent = '✅ บันทึกสำเร็จ';
    setTimeout(() => liff.closeWindow(), 2000);
  } catch (err) {
    msg.textContent = '❌ เกิดข้อผิดพลาด กรุณาลองใหม่';
  }
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
