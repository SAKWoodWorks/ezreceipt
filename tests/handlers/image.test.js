jest.mock('../../src/config', () => ({
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  GOOGLE_AI_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
  ADMIN_PASSWORD: 'test-admin-pass',
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
  PORT: 3000
}));
jest.mock('../../src/services/line');
jest.mock('../../src/services/ocr');
jest.mock('../../src/services/db');
jest.mock('../../src/services/storage');

const lineService = require('../../src/services/line');
const ocr = require('../../src/services/ocr');
const db = require('../../src/services/db');

lineService.downloadImageBuffer = jest.fn().mockResolvedValue(Buffer.from('img'));
lineService.replyMessage = jest.fn().mockResolvedValue({});
lineService.pushMessage = jest.fn().mockResolvedValue({});
lineService.buildOcrResultMessage = jest.fn().mockReturnValue({ type: 'flex', altText: 'test', contents: {} });

ocr.extractReceiptData = jest.fn().mockResolvedValue({
  store_name: 'ร้านกาแฟ',
  date_on_receipt: '2026-05-14',
  total_amount: 65,
  category_suggestion: 'อาหาร/เครื่องดื่ม',
  items: [{ name: 'กาแฟ', amount: 65 }]
});

db.insertReceipt = jest.fn().mockResolvedValue('receipt-uuid-123');
const storage = require('../../src/services/storage');
storage.uploadImage = jest.fn().mockResolvedValue(undefined);
db.updateReceipt = jest.fn().mockResolvedValue(undefined);

describe('handleImageMessage', () => {
  const { handleImageMessage } = require('../../src/handlers/image');

  const event = {
    replyToken: 'reply-token-abc',
    source: { userId: 'U123', groupId: 'C456', type: 'group' },
    message: { id: 'msg-id-789', type: 'image' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lineService.downloadImageBuffer.mockResolvedValue(Buffer.from('img'));
    ocr.extractReceiptData.mockResolvedValue({
      store_name: 'ร้านกาแฟ',
      date_on_receipt: '2026-05-14',
      total_amount: 65,
      category_suggestion: 'อาหาร/เครื่องดื่ม',
      items: []
    });
    db.insertReceipt.mockResolvedValue('receipt-uuid-123');
    storage.uploadImage.mockResolvedValue('drive-file-id-default');
    db.updateReceipt.mockResolvedValue(undefined);
  });

  it('replies with processing message immediately', async () => {
    await handleImageMessage(event);
    expect(lineService.replyMessage).toHaveBeenCalledWith(
      'reply-token-abc',
      expect.objectContaining({ type: 'text', text: expect.stringContaining('กำลังอ่านใบเสร็จ') })
    );
  });

  it('downloads image and calls OCR', async () => {
    await handleImageMessage(event);
    expect(lineService.downloadImageBuffer).toHaveBeenCalledWith('msg-id-789');
    expect(ocr.extractReceiptData).toHaveBeenCalledWith(Buffer.from('img'));
  });

  it('inserts receipt to DB with pending status', async () => {
    await handleImageMessage(event);
    expect(db.insertReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        line_user_id: 'U123',
        group_id: 'C456',
        status: 'pending'
      })
    );
  });

  it('pushes OCR result message to user', async () => {
    await handleImageMessage(event);
    expect(lineService.pushMessage).toHaveBeenCalledWith('U123', expect.anything());
  });

  it('pushes error message when OCR fails', async () => {
    ocr.extractReceiptData.mockRejectedValue(new Error('OcrParseError'));
    await handleImageMessage(event);
    expect(lineService.pushMessage).toHaveBeenCalledWith(
      'U123',
      expect.objectContaining({ text: expect.stringContaining('อ่านใบเสร็จไม่สำเร็จ') })
    );
  });

  it('uploads image to Drive with filename {userId}_{receiptId}.jpg', async () => {
    storage.uploadImage.mockResolvedValue('drive-file-id-456');
    await handleImageMessage(event);
    await new Promise(resolve => setImmediate(resolve));
    expect(storage.uploadImage).toHaveBeenCalledWith(
      'U123_receipt-uuid-123.jpg',
      Buffer.from('img')
    );
  });

  it('stores Drive fileId in image_key when upload succeeds', async () => {
    storage.uploadImage.mockResolvedValue('drive-file-id-456');
    await handleImageMessage(event);
    await new Promise(resolve => setImmediate(resolve));
    expect(db.updateReceipt).toHaveBeenCalledWith(
      'receipt-uuid-123',
      { image_key: 'drive-file-id-456' }
    );
  });

  it('skips updateReceipt when upload returns null', async () => {
    storage.uploadImage.mockResolvedValue(null);
    await handleImageMessage(event);
    await new Promise(resolve => setImmediate(resolve));
    expect(lineService.pushMessage).toHaveBeenCalledWith('U123', expect.anything());
    expect(db.updateReceipt).not.toHaveBeenCalled();
  });
});
