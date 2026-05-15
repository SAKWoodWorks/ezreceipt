const { stringify } = require('csv-stringify/sync');

function generateCsv(receipts) {
  const header = ['วันที่', 'ร้านค้า', 'หมวดหมู่', 'ยอดรวม', 'ผู้ส่ง', 'LINE User ID', 'บันทึกเมื่อ'];
  const rows = receipts.map(r => [
    r.date_on_receipt ? String(r.date_on_receipt).slice(0, 10) : '',
    r.store_name || '',
    r.category || '',
    r.total_amount ?? '',
    r.line_display_name || '',
    r.line_user_id || '',
    r.created_at ? String(r.created_at).slice(0, 19) : ''
  ]);
  return stringify([header, ...rows]);
}

module.exports = { generateCsv };
