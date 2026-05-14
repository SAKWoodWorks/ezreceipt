jest.mock('../../src/config', () => ({
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  OPENAI_API_KEY: 'test-key',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-key',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
  PORT: 3000
}));
jest.mock('../../src/services/line');
jest.mock('../../src/services/supabase');
jest.mock('../../src/services/sheets');

const lineService = require('../../src/services/line');
const supabase = require('../../src/services/supabase');
const sheets = require('../../src/services/sheets');

lineService.replyMessage = jest.fn().mockResolvedValue({});
lineService.buildSuccessMessage = jest.fn().mockReturnValue({ type: 'flex', altText: 'จดสำเร็จ', contents: {} });
supabase.updateReceipt = jest.fn().mockResolvedValue();
supabase.getReceiptById = jest.fn().mockResolvedValue({
  id: 'uuid-123',
  store_name: 'ร้านกาแฟ',
  date_on_receipt: '2026-05-14',
  total_amount: 65,
  category: 'อาหาร/เครื่องดื่ม',
  line_user_id: 'U123',
  line_display_name: 'Pupa'
});
sheets.appendReceiptRow = jest.fn().mockResolvedValue('Sheet1!A2:H2');

describe('handlePostback', () => {
  const { handlePostback } = require('../../src/handlers/postback');

  const confirmEvent = {
    replyToken: 'reply-token-xyz',
    source: { userId: 'U123' },
    postback: {
      data: 'action=confirm&id=uuid-123&category=%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%2F%E0%B9%80%E0%B8%84%E0%B8%A3%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87%E0%B8%94%E0%B8%B7%E0%B9%88%E0%B8%A1'
    }
  };

  beforeEach(() => jest.clearAllMocks());

  it('updates receipt category and status in Supabase', async () => {
    await handlePostback(confirmEvent);
    expect(supabase.updateReceipt).toHaveBeenCalledWith('uuid-123', {
      category: 'อาหาร/เครื่องดื่ม',
      status: 'confirmed'
    });
  });

  it('appends row to Google Sheet', async () => {
    await handlePostback(confirmEvent);
    expect(sheets.appendReceiptRow).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'อาหาร/เครื่องดื่ม' })
    );
  });

  it('replies with success flex message', async () => {
    await handlePostback(confirmEvent);
    expect(lineService.replyMessage).toHaveBeenCalledWith(
      'reply-token-xyz',
      expect.anything()
    );
  });

  it('ignores postback with unknown action', async () => {
    const unknownEvent = {
      ...confirmEvent,
      postback: { data: 'action=unknown' }
    };
    await handlePostback(unknownEvent);
    expect(supabase.updateReceipt).not.toHaveBeenCalled();
  });
});
