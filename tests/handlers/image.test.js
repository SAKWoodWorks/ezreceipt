jest.mock('../../src/services/line');
jest.mock('../../src/services/ocr');
jest.mock('../../src/services/supabase');

const lineService = require('../../src/services/line');
const ocr = require('../../src/services/ocr');
const supabase = require('../../src/services/supabase');

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

supabase.insertReceipt = jest.fn().mockResolvedValue('receipt-uuid-123');

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
    supabase.insertReceipt.mockResolvedValue('receipt-uuid-123');
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

  it('inserts receipt to Supabase with pending status', async () => {
    await handleImageMessage(event);
    expect(supabase.insertReceipt).toHaveBeenCalledWith(
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
});
