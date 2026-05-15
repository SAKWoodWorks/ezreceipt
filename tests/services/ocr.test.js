const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent
    })
  }))
}));
jest.mock('../../src/config', () => ({ GOOGLE_AI_API_KEY: 'test-key' }));

const ocr = require('../../src/services/ocr');

describe('extractReceiptData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns parsed receipt data from Gemini response', async () => {
    const expected = {
      date_on_receipt: '2026-05-03',
      store_name: 'การไฟฟ้าส่วนภูมิภาค',
      category_suggestion: 'ค่าสาธารณูปโภค',
      items: [{ name: 'ค่าไฟฟ้า', amount: 572.59 }],
      total_amount: 572.59
    };
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(expected) }
    });
    const result = await ocr.extractReceiptData(Buffer.from('fake-image'));
    expect(result).toEqual(expected);
  });

  it('parses JSON wrapped in code block', async () => {
    const data = { date_on_receipt: '2026-05-14', store_name: 'Test', category_suggestion: 'อื่นๆ', items: [], total_amount: 100 };
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '```json\n' + JSON.stringify(data) + '\n```' }
    });
    const result = await ocr.extractReceiptData(Buffer.from('img'));
    expect(result.store_name).toBe('Test');
  });

  it('throws OcrParseError when Gemini returns non-JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'ขอโทษ ไม่สามารถอ่านได้' }
    });
    await expect(ocr.extractReceiptData(Buffer.from('img'))).rejects.toThrow('OcrParseError');
  });
});
