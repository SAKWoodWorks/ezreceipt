jest.mock('openai');
jest.mock('../../src/config', () => ({ OPENAI_API_KEY: 'test-key' }));

const OpenAI = require('openai');
const mockCreate = jest.fn();
OpenAI.mockImplementation(() => ({
  chat: { completions: { create: mockCreate } }
}));

describe('extractReceiptData', () => {
  let ocr;
  beforeEach(() => {
    jest.resetModules();
    jest.mock('openai');
    jest.mock('../../src/config', () => ({ OPENAI_API_KEY: 'test-key' }));
    const OpenAIInner = require('openai');
    OpenAIInner.mockImplementation(() => ({
      chat: { completions: { create: mockCreate } }
    }));
    ocr = require('../../src/services/ocr');
  });

  it('returns parsed receipt data from GPT-4o response', async () => {
    const expected = {
      date_on_receipt: '2026-05-03',
      store_name: 'การไฟฟ้าส่วนภูมิภาค',
      category_suggestion: 'ค่าสาธารณูปโภค',
      items: [{ name: 'ค่าไฟฟ้า', amount: 572.59 }],
      total_amount: 572.59
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(expected) } }]
    });
    const result = await ocr.extractReceiptData(Buffer.from('fake-image'));
    expect(result).toEqual(expected);
  });

  it('parses JSON wrapped in code block', async () => {
    const data = { date_on_receipt: '2026-05-14', store_name: 'Test', category_suggestion: 'อื่นๆ', items: [], total_amount: 100 };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '```json\n' + JSON.stringify(data) + '\n```' } }]
    });
    const result = await ocr.extractReceiptData(Buffer.from('img'));
    expect(result.store_name).toBe('Test');
  });

  it('throws OcrParseError when GPT returns non-JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'ขอโทษ ไม่สามารถอ่านได้' } }]
    });
    await expect(ocr.extractReceiptData(Buffer.from('img'))).rejects.toThrow('OcrParseError');
  });
});
