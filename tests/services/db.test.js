jest.mock('../../src/config', () => ({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  ADMIN_PASSWORD: 'test-pass',
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx'
}));

const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery }))
}));

const db = require('../../src/services/db');

beforeEach(() => mockQuery.mockReset());

describe('insertReceipt', () => {
  it('returns inserted id', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'uuid-123' }] });
    const id = await db.insertReceipt({ line_user_id: 'U123', total_amount: 100 });
    expect(id).toBe('uuid-123');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO receipts'),
      expect.arrayContaining(['U123'])
    );
  });
});

describe('updateReceipt', () => {
  it('builds correct SET clause', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await db.updateReceipt('uuid-123', { status: 'confirmed', category: 'อาหาร/เครื่องดื่ม' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE receipts SET');
    expect(params).toContain('uuid-123');
    expect(params).toContain('confirmed');
  });
});

describe('getReceiptById', () => {
  it('returns receipt row', async () => {
    const receipt = { id: 'uuid-123', store_name: 'Test Store' };
    mockQuery.mockResolvedValue({ rows: [receipt] });
    const result = await db.getReceiptById('uuid-123');
    expect(result).toEqual(receipt);
  });

  it('throws when not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(db.getReceiptById('missing-id')).rejects.toThrow('Receipt not found');
  });
});

describe('getReceipts', () => {
  it('returns receipts filtered by userId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: '1', store_name: 'Test' }] });
    const result = await db.getReceipts({ userId: 'U123', month: null, category: null });
    expect(result).toEqual([{ id: '1', store_name: 'Test' }]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.arrayContaining(['U123'])
    );
  });

  it('passes null filters correctly', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await db.getReceipts({ userId: null, month: '2026-05', category: 'อาหาร/เครื่องดื่ม' });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      [null, '2026-05', 'อาหาร/เครื่องดื่ม', null, null, null]
    );
  });
});

describe('deleteReceipt', () => {
  it('deletes receipt by id', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 });
    await expect(db.deleteReceipt('uuid-123')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      ['uuid-123']
    );
  });

  it('throws if receipt not found', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0 });
    await expect(db.deleteReceipt('bad-id')).rejects.toThrow('Receipt not found');
  });
});

describe('getStats', () => {
  it('returns monthly and category stats', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ month: '2026-05', total: 1000, count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ category: 'อาหาร/เครื่องดื่ม', total: 500, count: 3 }] });
    const result = await db.getStats(6);
    expect(result.monthly).toHaveLength(1);
    expect(result.categories).toHaveLength(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe('getUsers', () => {
  it('returns distinct users', async () => {
    mockQuery.mockResolvedValue({ rows: [{ line_user_id: 'U1', line_display_name: 'Alice' }] });
    const result = await db.getUsers();
    expect(result).toEqual([{ line_user_id: 'U1', line_display_name: 'Alice' }]);
  });
});

describe('getUserMonthlyStats', () => {
  it('returns categories array and summed total', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { category: 'อาหาร/เครื่องดื่ม', total: 300, count: 3 },
        { category: 'ค่าเดินทาง', total: 100, count: 1 }
      ]
    });
    const result = await db.getUserMonthlyStats('U123', '2026-05');
    expect(result.categories).toHaveLength(2);
    expect(result.total).toBe(400);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE line_user_id = $1'),
      ['U123', '2026-05']
    );
  });

  it('returns empty result when no confirmed receipts', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await db.getUserMonthlyStats('U123', '2026-01');
    expect(result).toEqual({ categories: [], total: 0 });
  });
});
