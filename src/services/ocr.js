const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GOOGLE_AI_API_KEY } = require('../config');

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

const PROMPT = `You are a Thai receipt OCR assistant. Extract the following fields from this receipt image and return valid JSON only:

{
  "date_on_receipt": "YYYY-MM-DD or null",
  "store_name": "string or null",
  "category_suggestion": "one of: อาหาร/เครื่องดื่ม | ค่าเดินทาง | สำนักงาน/อุปกรณ์ | ค่าสาธารณูปโภค | ใบแจ้งหนี้/บิล | อื่นๆ",
  "items": [{ "name": "string", "amount": number }],
  "total_amount": number or null
}

For date_on_receipt: Thai receipts use Buddhist Era (BE). Always convert to CE by subtracting 543.
- 2-digit year XX always means BE 20XX. Example: "67" = BE 2567 = CE 2024-xx-xx, "69" = BE 2569 = CE 2026-xx-xx
- Full 4-digit BE year. Example: "2568" = CE 2025, "2569" = CE 2026
- If the CE year is outside 2000–2100, return null for date_on_receipt
Return ONLY the JSON object. No explanation.`;

function sanitizeOcrData(data) {
  if (data.date_on_receipt) {
    const year = parseInt(String(data.date_on_receipt).split('-')[0], 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      data.date_on_receipt = null;
    }
  }
  return data;
}

function parseOcrResponse(text) {
  if (!text) {
    const err = new Error('OcrParseError: model returned empty content');
    err.name = 'OcrParseError';
    throw err;
  }

  try {
    return sanitizeOcrData(JSON.parse(text.trim()));
  } catch (_) {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return sanitizeOcrData(JSON.parse(match[1].trim()));
    } catch (_) {}
  }

  const err = new Error('OcrParseError: could not parse Gemini response as JSON');
  err.name = 'OcrParseError';
  throw err;
}

async function extractReceiptData(imageBuffer) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const base64 = imageBuffer.toString('base64');

  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType: 'image/jpeg', data: base64 } }
  ]);

  const text = result.response.text();
  return parseOcrResponse(text);
}

module.exports = { extractReceiptData };
