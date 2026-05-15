jest.mock('../../src/config', () => ({
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  GOOGLE_AI_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
  ADMIN_PASSWORD: 'test-admin-pass',
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
  LIFF_ID: 'test-liff-id'
}));
jest.mock('../../src/services/line');
jest.mock('../../src/services/db');

const lineService = require('../../src/services/line');
const db = require('../../src/services/db');

lineService.replyMessage = jest.fn().mockResolvedValue({});
lineService.buildMonthlySummaryMessage = jest.fn().mockReturnValue({ type: 'flex', altText: 'สรุป', contents: {} });
db.getUserMonthlyStats = jest.fn().mockResolvedValue({
  categories: [{ category: 'อาหาร/เครื่องดื่ม', total: 200, count: 2 }],
  total: 200
});

describe('handleTextMessage', () => {
  const { handleTextMessage } = require('../../src/handlers/text');

  const makeEvent = (text) => ({
    replyToken: 'reply-token-xyz',
    source: { userId: 'U123' },
    message: { type: 'text', text }
  });

  beforeEach(() => jest.clearAllMocks());

  it('replies with monthly summary flex when text is เดือนนี้', async () => {
    await handleTextMessage(makeEvent('เดือนนี้'));
    expect(db.getUserMonthlyStats).toHaveBeenCalledWith('U123', expect.stringMatching(/^\d{4}-\d{2}$/));
    expect(lineService.buildMonthlySummaryMessage).toHaveBeenCalled();
    expect(lineService.replyMessage).toHaveBeenCalledWith('reply-token-xyz', expect.anything());
  });

  it('replies with help text when text is ส่งใบเสร็จ', async () => {
    await handleTextMessage(makeEvent('ส่งใบเสร็จ'));
    expect(lineService.replyMessage).toHaveBeenCalledWith(
      'reply-token-xyz',
      expect.objectContaining({ type: 'text', text: expect.stringContaining('ส่งรูปใบเสร็จ') })
    );
    expect(db.getUserMonthlyStats).not.toHaveBeenCalled();
  });

  it('does nothing for unknown text', async () => {
    await handleTextMessage(makeEvent('hello'));
    expect(lineService.replyMessage).not.toHaveBeenCalled();
    expect(db.getUserMonthlyStats).not.toHaveBeenCalled();
  });
});
