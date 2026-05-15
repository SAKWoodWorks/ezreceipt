// src/services/ocr.js
const OpenAI = require('openai');
const { OPENROUTER_API_KEY } = require('../config');

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const PROMPT = `You are a Thai receipt OCR assistant. Extract the following fields from this receipt image and return valid JSON only:

{
  "date_on_receipt": "YYYY-MM-DD or null",
  "store_name": "string or null",
  "category_suggestion": "one of: อาหาร/เครื่องดื่ม | ค่าเดินทาง | สำนักงาน/อุปกรณ์ | ค่าสาธารณูปโภค | ใบแจ้งหนี้/บิล | อื่นๆ",
  "items": [{ "name": "string", "amount": number }],
  "total_amount": number or null
}

Return ONLY the JSON object. No explanation.`;

function parseOcrResponse(text) {
  try {
    return JSON.parse(text.trim());
  } catch (_) {}

  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch (_) {}
  }

  const err = new Error('OcrParseError: could not parse GPT response as JSON');
  err.name = 'OcrParseError';
  throw err;
}

async function extractReceiptData(imageBuffer) {
  const base64 = imageBuffer.toString('base64');
  const response = await openai.chat.completions.create({
    model: 'google/gemma-4-31b-it:free',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ]
    }],
    max_tokens: 800
  });

  const content = response.choices[0].message.content;
  return parseOcrResponse(content);
}

module.exports = { extractReceiptData };
