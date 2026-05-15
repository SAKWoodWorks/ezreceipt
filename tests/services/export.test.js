const { generateCsv } = require('../../src/services/export');

describe('generateCsv', () => {
  it('returns CSV string with header row', () => {
    const csv = generateCsv([]);
    expect(csv).toContain('วันที่');
    expect(csv).toContain('ร้านค้า');
    expect(csv).toContain('ยอดรวม');
  });

  it('includes receipt data rows', () => {
    const receipts = [{
      date_on_receipt: '2026-05-07',
      store_name: '7-Eleven',
      category: 'อาหาร/เครื่องดื่ม',
      total_amount: 64,
      line_display_name: 'Alice',
      line_user_id: 'U123',
      created_at: '2026-05-07T10:00:00.000Z'
    }];
    const csv = generateCsv(receipts);
    expect(csv).toContain('7-Eleven');
    expect(csv).toContain('64');
    expect(csv).toContain('Alice');
  });

  it('handles null fields without throwing', () => {
    const csv = generateCsv([{ date_on_receipt: null, store_name: null, category: null, total_amount: null, line_display_name: null, line_user_id: 'U1', created_at: null }]);
    expect(typeof csv).toBe('string');
  });
});
