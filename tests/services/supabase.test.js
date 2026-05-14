jest.mock('@supabase/supabase-js');
jest.mock('../../src/config', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-key'
}));

describe('supabase service', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('insertReceipt returns inserted id', async () => {
    const { createClient } = require('@supabase/supabase-js');

    const mockSingle = jest.fn().mockResolvedValue({ data: { id: 'uuid-123' }, error: null });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

    createClient.mockReturnValue({
      from: mockFrom
    });

    const supabaseService = require('../../src/services/supabase');
    const id = await supabaseService.insertReceipt({ line_user_id: 'U123', total_amount: 100 });
    expect(id).toBe('uuid-123');
    expect(mockFrom).toHaveBeenCalledWith('receipts');
    expect(mockInsert).toHaveBeenCalledWith({ line_user_id: 'U123', total_amount: 100 });
  });

  it('updateReceipt calls update with id and data', async () => {
    const { createClient } = require('@supabase/supabase-js');

    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });

    createClient.mockReturnValue({
      from: mockFrom
    });

    const supabaseService = require('../../src/services/supabase');
    await supabaseService.updateReceipt('uuid-123', { status: 'confirmed', category: 'อาหาร/เครื่องดื่ม' });

    expect(mockFrom).toHaveBeenCalledWith('receipts');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'confirmed', category: 'อาหาร/เครื่องดื่ม' });
    expect(mockEq).toHaveBeenCalledWith('id', 'uuid-123');
  });

  it('getReceiptById returns receipt data', async () => {
    const { createClient } = require('@supabase/supabase-js');

    const receipt = { id: 'uuid-123', store_name: 'Test Store', total_amount: 500 };
    const mockSingle = jest.fn().mockResolvedValue({ data: receipt, error: null });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

    createClient.mockReturnValue({
      from: mockFrom
    });

    const supabaseService = require('../../src/services/supabase');
    const result = await supabaseService.getReceiptById('uuid-123');

    expect(result).toEqual(receipt);
    expect(mockFrom).toHaveBeenCalledWith('receipts');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('id', 'uuid-123');
  });
});
