// tests/services/db.test.js
jest.mock('pg');
jest.mock('../../src/config', () => ({ DATABASE_URL: 'postgresql://test:test@localhost:5432/test' }));

const { Pool } = require('pg');
const mockQuery = jest.fn();
Pool.mockImplementation(() => ({ query: mockQuery }));

describe('db service', () => {
  let db;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('pg');
    jest.mock('../../src/config', () => ({ DATABASE_URL: 'postgresql://test:test@localhost:5432/test' }));
    const { Pool: P } = require('pg');
    P.mockImplementation(() => ({ query: mockQuery }));
    db = require('../../src/services/db');
  });

  it('insertReceipt returns inserted id', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'uuid-123' }] });
    const id = await db.insertReceipt({ line_user_id: 'U123', total_amount: 100 });
    expect(id).toBe('uuid-123');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO receipts'),
      expect.arrayContaining(['U123'])
    );
  });

  it('updateReceipt builds correct SET clause', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await db.updateReceipt('uuid-123', { status: 'confirmed', category: 'อาหาร/เครื่องดื่ม' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE receipts SET');
    expect(params).toContain('uuid-123');
    expect(params).toContain('confirmed');
  });

  it('getReceiptById returns receipt row', async () => {
    const receipt = { id: 'uuid-123', store_name: 'Test Store' };
    mockQuery.mockResolvedValue({ rows: [receipt] });
    const result = await db.getReceiptById('uuid-123');
    expect(result).toEqual(receipt);
  });

  it('getReceiptById throws when not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(db.getReceiptById('missing-id')).rejects.toThrow('Receipt not found');
  });
});
