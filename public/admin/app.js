const CATEGORIES = ['อาหาร/เครื่องดื่ม','ค่าเดินทาง','สำนักงาน/อุปกรณ์','ค่าสาธารณูปโภค','ใบแจ้งหนี้/บิล','อื่นๆ'];

let barChart, pieChart;
let editingId = null;
let currentReceipts = [];

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Unauthorized'); }
  return res;
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  if (name === 'dashboard') loadDashboard();
  if (name === 'receipts') loadReceipts();
  if (name === 'export') loadUsersDropdown('export-user');
}

async function loadDashboard() {
  const stats = await (await api('/stats')).json();
  const now = new Date();
  const thisMonth = stats.monthly.find(m => m.month === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  document.getElementById('stat-total').textContent = '฿' + Number(thisMonth?.total || 0).toLocaleString('th-TH');
  document.getElementById('stat-count').textContent = thisMonth?.count || 0;

  const users = await (await api('/users')).json();
  document.getElementById('stat-users').textContent = users.length;

  // Bar chart
  if (barChart) barChart.destroy();
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: stats.monthly.map(m => m.month),
      datasets: [{ label: 'ยอดรวม (฿)', data: stats.monthly.map(m => m.total), backgroundColor: '#1e3a5f' }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Pie chart
  if (pieChart) pieChart.destroy();
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: stats.categories.map(c => c.category),
      datasets: [{ data: stats.categories.map(c => c.total), backgroundColor: ['#1e3a5f','#2980b9','#27ae60','#f39c12','#e74c3c','#9b59b6'] }]
    },
    options: { responsive: true }
  });
}

async function loadUsersDropdown(selectId) {
  const users = await (await api('/users')).json();
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">ทุกคน</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.line_user_id;
    opt.textContent = u.line_display_name || u.line_user_id;
    sel.appendChild(opt);
  });
}

async function loadReceipts() {
  await loadUsersDropdown('filter-user');
  await fetchReceipts();
}

async function fetchReceipts() {
  const month = document.getElementById('filter-month').value;
  const category = document.getElementById('filter-category').value;
  const userId = document.getElementById('filter-user').value;
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (category) params.set('category', category);
  if (userId) params.set('userId', userId);
  const receipts = await (await api('/receipts?' + params)).json();
  renderTable(receipts);
}

function renderTable(receipts) {
  currentReceipts = receipts;
  const tbody = document.getElementById('receipts-tbody');
  if (!receipts.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:24px">ไม่พบข้อมูล</td></tr>'; return; }
  tbody.innerHTML = receipts.map((r, i) => `
    <tr>
      <td>${r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-'}</td>
      <td>${r.store_name || '-'}</td>
      <td>${r.category || '-'}</td>
      <td>฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</td>
      <td>${r.line_display_name || '-'}</td>
      <td><span style="background:${r.status==='confirmed'?'#e8f5e9':'#fff3e0'};color:${r.status==='confirmed'?'#2e7d32':'#e65100'};padding:2px 8px;border-radius:4px;font-size:12px">${r.status}</span></td>
      <td>${r.image_url ? `<a href="${r.image_url}" target="_blank"><img src="${r.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:4px"></a>` : '-'}</td>
      <td>
        <button class="btn btn-warning" style="margin-right:4px;padding:5px 10px" data-idx="${i}" onclick="openEditByIdx(this.dataset.idx)">แก้ไข</button>
        <button class="btn btn-danger" style="padding:5px 10px" onclick="deleteReceipt('${r.id}')">ลบ</button>
      </td>
    </tr>
  `).join('');
}

function openEditByIdx(idx) {
  const r = currentReceipts[parseInt(idx)];
  editingId = r.id;
  document.getElementById('edit-store').value = r.store_name || '';
  document.getElementById('edit-date').value = r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '';
  document.getElementById('edit-total').value = r.total_amount || '';
  const catSel = document.getElementById('edit-category');
  catSel.innerHTML = CATEGORIES.map(c => `<option value="${c}" ${c===r.category?'selected':''}>${c}</option>`).join('');
  document.getElementById('edit-modal').classList.add('open');
}

async function saveEdit() {
  await api(`/receipts/${editingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_name: document.getElementById('edit-store').value,
      date_on_receipt: document.getElementById('edit-date').value || null,
      category: document.getElementById('edit-category').value,
      total_amount: parseFloat(document.getElementById('edit-total').value) || null
    })
  });
  document.getElementById('edit-modal').classList.remove('open');
  fetchReceipts();
}

async function deleteReceipt(id) {
  if (!confirm('ลบใบเสร็จนี้?')) return;
  await api(`/receipts/${id}`, { method: 'DELETE' });
  fetchReceipts();
}

async function downloadCsv() {
  const from = document.getElementById('export-from').value;
  const to = document.getElementById('export-to').value;
  const userId = document.getElementById('export-user').value;
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (userId) params.set('userId', userId);
  const res = await api('/export/csv?' + params);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'receipts.csv'; a.click();
}

async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login';
}
