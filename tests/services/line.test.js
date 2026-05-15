// tests/services/line.test.js
jest.mock('@line/bot-sdk');
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

const line = require('@line/bot-sdk');
const mockReplyMessage = jest.fn().mockResolvedValue({});
const mockPushMessage = jest.fn().mockResolvedValue({});
const mockGetMessageContent = jest.fn();

line.Client.mockImplementation(() => ({
  replyMessage: mockReplyMessage,
  pushMessage: mockPushMessage,
  getMessageContent: mockGetMessageContent
}));

const lineService = require('../../src/services/line');

describe('buildOcrResultMessage', () => {
  it('returns flex message with quickReply items', () => {
    const msg = lineService.buildOcrResultMessage('uuid-123', {
      store_name: 'ร้านกาแฟ',
      date_on_receipt: '2026-05-14',
      total_amount: 150,
      category_suggestion: 'อาหาร/เครื่องดื่ม'
    });
    expect(msg.type).toBe('flex');
    expect(msg.quickReply.items).toHaveLength(6);
    expect(msg.quickReply.items[0].action.data).toContain('uuid-123');
  });

  it('handles null fields gracefully', () => {
    const msg = lineService.buildOcrResultMessage('uuid-456', {
      store_name: null,
      date_on_receipt: null,
      total_amount: null,
      category_suggestion: null
    });
    expect(msg.type).toBe('flex');
    expect(msg.contents.body).toBeDefined();
  });
});

describe('buildSuccessMessage', () => {
  it('returns flex message with receipt data', () => {
    const msg = lineService.buildSuccessMessage({
      store_name: 'ร้านกาแฟ',
      date_on_receipt: '2026-05-14',
      total_amount: 150,
      category: 'อาหาร/เครื่องดื่ม',
      line_display_name: 'Pupa'
    });
    expect(msg.type).toBe('flex');
    expect(msg.altText).toContain('จดสำเร็จ');
  });
});

describe('downloadImageBuffer', () => {
  it('returns Buffer from message content stream', async () => {
    const { Readable } = require('stream');
    const readable = Readable.from([Buffer.from('fake-image-data')]);
    mockGetMessageContent.mockResolvedValue(readable);

    const buffer = await lineService.downloadImageBuffer('msg-id-123');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('fake-image-data');
  });
});

describe('buildMonthlySummaryMessage', () => {
  it('returns flex message with categories and total', () => {
    const stats = {
      categories: [
        { category: 'อาหาร/เครื่องดื่ม', total: 300, count: 3 },
        { category: 'ค่าเดินทาง', total: 100, count: 1 }
      ],
      total: 400
    };
    const msg = lineService.buildMonthlySummaryMessage(stats, '2026-05');
    expect(msg.type).toBe('flex');
    expect(msg.altText).toContain('พ.ค.');
    expect(msg.altText).toContain('2569');
    expect(msg.contents.header.contents[0].text).toContain('พ.ค. 2569');
    expect(msg.contents.footer).toBeDefined();
    expect(msg.contents.footer.contents[0].action.type).toBe('uri');
  });

  it('shows empty state message when no categories', () => {
    const stats = { categories: [], total: 0 };
    const msg = lineService.buildMonthlySummaryMessage(stats, '2026-01');
    expect(msg.type).toBe('flex');
    const bodyText = JSON.stringify(msg.contents.body);
    expect(bodyText).toContain('ยังไม่มีค่าใช้จ่ายเดือนนี้');
  });

  it('formats Buddhist Era year correctly', () => {
    const stats = { categories: [], total: 0 };
    const msg = lineService.buildMonthlySummaryMessage(stats, '2025-12');
    expect(msg.altText).toContain('ธ.ค. 2568');
  });
});
