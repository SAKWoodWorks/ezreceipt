// tests/services/line.test.js
jest.mock('@line/bot-sdk');
jest.mock('../../src/config', () => ({
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret'
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
