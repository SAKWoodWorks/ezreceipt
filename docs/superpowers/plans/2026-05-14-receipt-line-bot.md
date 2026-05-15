# Receipt LINE Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LINE Bot รับรูปใบเสร็จ → GPT-4o Vision อ่านข้อมูล → user confirm หมวดหมู่ → บันทึก Supabase + Google Sheet

**Architecture:** Express.js webhook รับ event จาก LINE, ประมวลผลแบบ async (reply 200 ก่อน แล้ว push result), เก็บ pending state ใน Supabase ระหว่างรอ user confirm

**Tech Stack:** Node.js 20, Express 4, @line/bot-sdk 7, openai 4, @supabase/supabase-js 2, googleapis 140, Jest 29

---

## File Structure

```
D:/Works/Web/accounting/
├── index.js                      # Express app entry, start server
├── package.json
├── jest.config.js
├── .env.example
├── .gitignore
├── src/
│   ├── config.js                 # validate + export env vars
│   ├── webhook.js                # LINE webhook router
│   ├── handlers/
│   │   ├── image.js              # imageMessage event → OCR flow
│   │   └── postback.js           # postback event → confirm + save flow
│   └── services/
│       ├── supabase.js           # Supabase client + receipts CRUD
│       ├── line.js               # LINE client, message builders, image download
│       ├── ocr.js                # GPT-4o Vision + JSON parse
│       └── sheets.js             # Google Sheets API append row
└── tests/
    ├── services/
    │   ├── supabase.test.js
    │   ├── line.test.js
    │   ├── ocr.test.js
    │   └── sheets.test.js
    └── handlers/
        ├── image.test.js
        └── postback.test.js
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `index.js`

- [ ] **Step 1: Init package.json**

```bash
cd D:/Works/Web/accounting
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install express @line/bot-sdk openai @supabase/supabase-js googleapis dotenv
npm install --save-dev jest
```

- [ ] **Step 3: Write jest.config.js**

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true
};
```

- [ ] **Step 4: Add test script to package.json**

Edit `package.json` scripts:
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

- [ ] **Step 5: Write .env.example**

```env
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
PORT=3000
```

- [ ] **Step 6: Write .gitignore**

```
node_modules/
.env
*.log
```

- [ ] **Step 7: Write index.js**

```javascript
// index.js
require('dotenv').config();
const express = require('express');
const webhookRouter = require('./src/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/webhook', webhookRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
```

- [ ] **Step 8: Verify server starts**

```bash
cp .env.example .env
# fill in real values in .env, then:
node index.js
```

Expected: `Server running on port 3000`

- [ ] **Step 9: Commit**

```bash
git init
git add package.json jest.config.js .env.example .gitignore index.js
git commit -m "feat: project setup with Express and dependencies"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/config.js`
- Create: `tests/services/config.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// tests/services/config.test.js
describe('config', () => {
  const REQUIRED = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_JSON'
  ];

  it('exports all required env vars', () => {
    REQUIRED.forEach(key => {
      process.env[key] = `test_${key}`;
    });
    jest.resetModules();
    const config = require('../../src/config');
    expect(config.LINE_CHANNEL_ACCESS_TOKEN).toBe('test_LINE_CHANNEL_ACCESS_TOKEN');
    expect(config.SUPABASE_URL).toBe('test_SUPABASE_URL');
  });

  it('throws if required env var is missing', () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    jest.resetModules();
    expect(() => require('../../src/config')).toThrow('Missing env var: LINE_CHANNEL_ACCESS_TOKEN');
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/services/config.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/config'"

- [ ] **Step 3: Write src/config.js**

```javascript
// src/config.js
const REQUIRED = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON'
];

for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

module.exports = {
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  PORT: process.env.PORT || 3000
};
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/services/config.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/services/config.test.js
git commit -m "feat: config module with env var validation"
```

---

## Task 3: Supabase Service

**Files:**
- Create: `src/services/supabase.js`
- Create: `tests/services/supabase.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/services/supabase.test.js
jest.mock('@supabase/supabase-js');
jest.mock('../../src/config', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-key'
}));

const { createClient } = require('@supabase/supabase-js');

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSingle = jest.fn();

createClient.mockReturnValue({
  from: mockFrom
});

mockFrom.mockReturnValue({
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate
});
mockInsert.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, single: mockSingle });
mockEq.mockReturnValue({ order: mockOrder, single: mockSingle });
mockOrder.mockReturnValue({ limit: mockLimit });
mockLimit.mockReturnValue({ single: mockSingle });
mockUpdate.mockReturnValue({ eq: mockEq });

describe('supabase service', () => {
  let supabaseService;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('@supabase/supabase-js');
    jest.mock('../../src/config', () => ({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-key'
    }));
    supabaseService = require('../../src/services/supabase');
  });

  it('insertReceipt returns inserted id', async () => {
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'uuid-123' }, error: null })
          })
        })
      })
    });
    jest.resetModules();
    jest.mock('../../src/config', () => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_KEY: 'y' }));
    const svc = require('../../src/services/supabase');
    const id = await svc.insertReceipt({ line_user_id: 'U123', total_amount: 100 });
    expect(id).toBe('uuid-123');
  });

  it('updateReceipt calls update with id and data', async () => {
    const mockEqInner = jest.fn().mockResolvedValue({ error: null });
    const mockUpdateInner = jest.fn().mockReturnValue({ eq: mockEqInner });
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue({
      from: () => ({ update: mockUpdateInner })
    });
    jest.resetModules();
    jest.mock('../../src/config', () => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_KEY: 'y' }));
    const svc = require('../../src/services/supabase');
    await svc.updateReceipt('uuid-123', { status: 'confirmed', category: 'อาหาร/เครื่องดื่ม' });
    expect(mockUpdateInner).toHaveBeenCalledWith({ status: 'confirmed', category: 'อาหาร/เครื่องดื่ม' });
    expect(mockEqInner).toHaveBeenCalledWith('id', 'uuid-123');
  });

  it('getReceiptById returns receipt data', async () => {
    const receipt = { id: 'uuid-123', store_name: 'Test Store', total_amount: 500 };
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: receipt, error: null })
          })
        })
      })
    });
    jest.resetModules();
    jest.mock('../../src/config', () => ({ SUPABASE_URL: 'x', SUPABASE_SERVICE_KEY: 'y' }));
    const svc = require('../../src/services/supabase');
    const result = await svc.getReceiptById('uuid-123');
    expect(result).toEqual(receipt);
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/services/supabase.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/services/supabase'"

- [ ] **Step 3: Write src/services/supabase.js**

```javascript
// src/services/supabase.js
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('../config');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function insertReceipt(data) {
  const { data: row, error } = await supabase
    .from('receipts')
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return row.id;
}

async function updateReceipt(id, data) {
  const { error } = await supabase
    .from('receipts')
    .update(data)
    .eq('id', id);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function getReceiptById(id) {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return data;
}

module.exports = { insertReceipt, updateReceipt, getReceiptById };
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/services/supabase.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/supabase.js tests/services/supabase.test.js
git commit -m "feat: supabase service with insertReceipt, updateReceipt, getReceiptById"
```

---

## Task 4: LINE Service

**Files:**
- Create: `src/services/line.js`
- Create: `tests/services/line.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
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
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/services/line.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/services/line'"

- [ ] **Step 3: Write src/services/line.js**

```javascript
// src/services/line.js
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET } = require('../config');

const client = new line.Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
});

const CATEGORIES = [
  'อาหาร/เครื่องดื่ม',
  'ค่าเดินทาง',
  'สำนักงาน/อุปกรณ์',
  'ค่าสาธารณูปโภค',
  'ใบแจ้งหนี้/บิล',
  'อื่นๆ'
];

function buildRow(label, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: label, color: '#888888', size: 'sm', flex: 3 },
      { type: 'text', text: String(value || '-'), flex: 5, wrap: true }
    ]
  };
}

function buildOcrResultMessage(receiptId, ocrData) {
  const total = ocrData.total_amount
    ? `฿${Number(ocrData.total_amount).toLocaleString('th-TH')}`
    : 'ไม่พบข้อมูล';

  return {
    type: 'flex',
    altText: `อ่านใบเสร็จสำเร็จ - กรุณาเลือกหมวดหมู่`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E3A5F',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '📄 อ่านใบเสร็จสำเร็จ', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'กดเลือกหมวดหมู่เพื่อบันทึก', color: '#aaccff', size: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        contents: [
          buildRow('ร้านค้า', ocrData.store_name || 'ไม่พบข้อมูล'),
          buildRow('วันที่', ocrData.date_on_receipt || 'ไม่พบข้อมูล'),
          buildRow('ยอดรวม', total),
          buildRow('AI แนะนำ', ocrData.category_suggestion || 'อื่นๆ')
        ]
      }
    },
    quickReply: {
      items: CATEGORIES.map(cat => ({
        type: 'action',
        action: {
          type: 'postback',
          label: cat,
          data: `action=confirm&id=${receiptId}&category=${encodeURIComponent(cat)}`,
          displayText: cat
        }
      }))
    }
  };
}

function buildSuccessMessage(receipt) {
  const total = receipt.total_amount
    ? `฿${Number(receipt.total_amount).toLocaleString('th-TH')}`
    : '-';

  return {
    type: 'flex',
    altText: `จดสำเร็จ ✅ ${receipt.store_name || ''} ${total}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#27AE60',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '✅ จดสำเร็จ', color: '#ffffff', weight: 'bold', size: 'xl' },
          { type: 'text', text: 'บันทึกใน Google Sheet แล้ว', color: '#ccffcc', size: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        contents: [
          buildRow('ร้านค้า', receipt.store_name),
          buildRow('วันที่', receipt.date_on_receipt),
          buildRow('หมวดหมู่', receipt.category),
          buildRow('ยอดรวม', total),
          buildRow('บันทึกโดย', receipt.line_display_name)
        ]
      }
    }
  };
}

async function downloadImageBuffer(messageId) {
  const stream = await client.getMessageContent(messageId);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function replyMessage(replyToken, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  return client.replyMessage(replyToken, msgs);
}

async function pushMessage(userId, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  return client.pushMessage(userId, msgs);
}

module.exports = {
  buildOcrResultMessage,
  buildSuccessMessage,
  downloadImageBuffer,
  replyMessage,
  pushMessage,
  CATEGORIES
};
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/services/line.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/line.js tests/services/line.test.js
git commit -m "feat: line service with message builders and image download"
```

---

## Task 5: OCR Service

**Files:**
- Create: `src/services/ocr.js`
- Create: `tests/services/ocr.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/services/ocr.test.js
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
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/services/ocr.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/services/ocr'"

- [ ] **Step 3: Write src/services/ocr.js**

```javascript
// src/services/ocr.js
const OpenAI = require('openai');
const { OPENAI_API_KEY } = require('../config');

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
    model: 'gpt-4o',
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
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/services/ocr.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ocr.js tests/services/ocr.test.js
git commit -m "feat: OCR service with GPT-4o Vision and JSON parse"
```

---

## Task 6: Google Sheets Service

**Files:**
- Create: `src/services/sheets.js`
- Create: `tests/services/sheets.test.js`

- [ ] **Step 1: Write failing test**

```javascript
// tests/services/sheets.test.js
jest.mock('googleapis');
jest.mock('../../src/config', () => ({
  GOOGLE_SHEET_ID: 'sheet-id-123',
  GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: 'service_account',
    project_id: 'test',
    private_key: 'fake-key',
    client_email: 'test@test.iam.gserviceaccount.com'
  })
}));

const { google } = require('googleapis');
const mockAppend = jest.fn().mockResolvedValue({
  data: { updates: { updatedRange: 'Sheet1!A2:H2' } }
});

google.auth = {
  GoogleAuth: jest.fn().mockImplementation(() => ({ getClient: jest.fn() }))
};
google.sheets = jest.fn().mockReturnValue({
  spreadsheets: { values: { append: mockAppend } }
});

describe('appendReceiptRow', () => {
  let sheets;
  beforeEach(() => {
    jest.resetModules();
    jest.mock('googleapis');
    jest.mock('../../src/config', () => ({
      GOOGLE_SHEET_ID: 'sheet-id-123',
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account', client_email: 'x@y.com', private_key: 'k' })
    }));
    const { google: g } = require('googleapis');
    g.auth = { GoogleAuth: jest.fn().mockImplementation(() => ({})) };
    g.sheets = jest.fn().mockReturnValue({
      spreadsheets: { values: { append: mockAppend } }
    });
    sheets = require('../../src/services/sheets');
  });

  it('calls sheets.append with correct row data', async () => {
    const receipt = {
      store_name: 'ร้านกาแฟ',
      date_on_receipt: '2026-05-14',
      category: 'อาหาร/เครื่องดื่ม',
      items: [{ name: 'กาแฟ', amount: 65 }],
      total_amount: 65,
      line_display_name: 'Pupa',
      line_user_id: 'U123'
    };

    await sheets.appendReceiptRow(receipt);

    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'sheet-id-123',
        range: 'Sheet1!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: expect.objectContaining({
          values: expect.arrayContaining([
            expect.arrayContaining(['ร้านกาแฟ', 'อาหาร/เครื่องดื่ม', 65, 'Pupa', 'U123'])
          ])
        })
      })
    );
  });
});
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/services/sheets.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/services/sheets'"

- [ ] **Step 3: Write src/services/sheets.js**

```javascript
// src/services/sheets.js
const { google } = require('googleapis');
const { GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON } = require('../config');

function getSheetClient() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

async function appendReceiptRow(receipt) {
  const sheets = getSheetClient();
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  const row = [
    now,                                         // A: วันที่บันทึก
    receipt.date_on_receipt || '',               // B: วันที่ในใบเสร็จ
    receipt.store_name || '',                    // C: ร้านค้า
    receipt.category || '',                      // D: หมวดหมู่
    JSON.stringify(receipt.items || []),         // E: รายการ
    receipt.total_amount || '',                  // F: ยอดรวม
    receipt.line_display_name || '',             // G: ผู้ส่ง
    receipt.line_user_id                         // H: LINE User ID
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });

  return response.data.updates?.updatedRange || null;
}

module.exports = { appendReceiptRow };
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/services/sheets.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/sheets.js tests/services/sheets.test.js
git commit -m "feat: Google Sheets service with appendReceiptRow"
```

---

## Task 7: Image Handler

**Files:**
- Create: `src/handlers/image.js`
- Create: `tests/handlers/image.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/handlers/image.test.js
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
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/handlers/image.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/handlers/image'"

- [ ] **Step 3: Write src/handlers/image.js**

```javascript
// src/handlers/image.js
const { downloadImageBuffer, replyMessage, pushMessage, buildOcrResultMessage } = require('../services/line');
const { extractReceiptData } = require('../services/ocr');
const { insertReceipt } = require('../services/supabase');

async function handleImageMessage(event) {
  const { replyToken, source, message } = event;
  const userId = source.userId;
  const groupId = source.groupId || null;

  // Reply immediately so LINE token doesn't expire during OCR
  await replyMessage(replyToken, {
    type: 'text',
    text: '📄 กำลังอ่านใบเสร็จ... กรุณารอสักครู่'
  });

  try {
    const imageBuffer = await downloadImageBuffer(message.id);
    const ocrData = await extractReceiptData(imageBuffer);

    const receiptId = await insertReceipt({
      line_user_id: userId,
      group_id: groupId,
      date_on_receipt: ocrData.date_on_receipt,
      store_name: ocrData.store_name,
      items: ocrData.items,
      total_amount: ocrData.total_amount,
      status: 'pending'
    });

    const resultMessage = buildOcrResultMessage(receiptId, ocrData);
    await pushMessage(userId, resultMessage);
  } catch (err) {
    console.error('handleImageMessage error:', err);
    await pushMessage(userId, {
      type: 'text',
      text: '❌ อ่านใบเสร็จไม่สำเร็จ กรุณาลองใหม่หรือส่งรูปที่ชัดขึ้น'
    });
  }
}

module.exports = { handleImageMessage };
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/handlers/image.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/image.js tests/handlers/image.test.js
git commit -m "feat: image handler with OCR flow and error handling"
```

---

## Task 8: Postback Handler

**Files:**
- Create: `src/handlers/postback.js`
- Create: `tests/handlers/postback.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// tests/handlers/postback.test.js
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
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx jest tests/handlers/postback.test.js --no-coverage
```

Expected: FAIL "Cannot find module '../../src/handlers/postback'"

- [ ] **Step 3: Write src/handlers/postback.js**

```javascript
// src/handlers/postback.js
const { replyMessage, buildSuccessMessage } = require('../services/line');
const { updateReceipt, getReceiptById } = require('../services/supabase');
const { appendReceiptRow } = require('../services/sheets');

async function handlePostback(event) {
  const { replyToken, postback } = event;
  const params = new URLSearchParams(postback.data);
  const action = params.get('action');

  if (action !== 'confirm') return;

  const receiptId = params.get('id');
  const category = params.get('category');

  try {
    await updateReceipt(receiptId, { category, status: 'confirmed' });

    const receipt = await getReceiptById(receiptId);
    await appendReceiptRow(receipt);

    const successMessage = buildSuccessMessage(receipt);
    await replyMessage(replyToken, successMessage);
  } catch (err) {
    console.error('handlePostback error:', err);
    await replyMessage(replyToken, {
      type: 'text',
      text: '❌ บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    });
  }
}

module.exports = { handlePostback };
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx jest tests/handlers/postback.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/handlers/postback.js tests/handlers/postback.test.js
git commit -m "feat: postback handler for category confirm flow"
```

---

## Task 9: Webhook Route

**Files:**
- Create: `src/webhook.js`

- [ ] **Step 1: Write src/webhook.js**

```javascript
// src/webhook.js
const express = require('express');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET } = require('./config');
const { handleImageMessage } = require('./handlers/image');
const { handlePostback } = require('./handlers/postback');

const router = express.Router();

const lineMiddlewareConfig = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

router.post('/', line.middleware(lineMiddlewareConfig), (req, res) => {
  res.status(200).end();
  const events = req.body.events || [];
  events.forEach(event => {
    handleEvent(event).catch(err =>
      console.error('Unhandled event error:', err)
    );
  });
});

async function handleEvent(event) {
  if (event.type === 'message' && event.message?.type === 'image') {
    return handleImageMessage(event);
  }
  if (event.type === 'postback') {
    return handlePostback(event);
  }
}

module.exports = router;
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 3: Start server and test health endpoint**

```bash
node index.js &
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add src/webhook.js
git commit -m "feat: LINE webhook route with signature verification"
```

---

## Task 10: Supabase Migration

- [ ] **Step 1: Open Supabase Dashboard → SQL Editor**

Run this SQL:

```sql
create table receipts (
  id uuid default gen_random_uuid() primary key,
  line_user_id text not null,
  line_display_name text,
  group_id text,
  date_on_receipt date,
  store_name text,
  category text,
  items jsonb default '[]',
  total_amount numeric,
  status text default 'pending',
  sheet_row_id text,
  image_url text,
  created_at timestamptz default now()
);

alter table receipts enable row level security;

-- index for fetching by user
create index receipts_line_user_id_idx on receipts(line_user_id);
create index receipts_status_idx on receipts(status);
```

- [ ] **Step 2: Verify table created**

In Supabase Dashboard → Table Editor → receipts table visible with all columns

- [ ] **Step 3: Commit migration SQL as reference**

```bash
mkdir -p migrations
cat > migrations/001_create_receipts.sql << 'EOF'
create table receipts (
  id uuid default gen_random_uuid() primary key,
  line_user_id text not null,
  line_display_name text,
  group_id text,
  date_on_receipt date,
  store_name text,
  category text,
  items jsonb default '[]',
  total_amount numeric,
  status text default 'pending',
  sheet_row_id text,
  image_url text,
  created_at timestamptz default now()
);
alter table receipts enable row level security;
create index receipts_line_user_id_idx on receipts(line_user_id);
create index receipts_status_idx on receipts(status);
EOF
git add migrations/
git commit -m "feat: supabase receipts table migration"
```

---

## Task 11: Google Sheet Setup

- [ ] **Step 1: Create new Google Sheet**

Go to sheets.google.com → Create new spreadsheet → Name it "Receipt Bot"

- [ ] **Step 2: Add header row**

In row 1, add these values in columns A–H:
```
A1: วันที่บันทึก
B1: วันที่ในใบเสร็จ
C1: ร้านค้า
D1: หมวดหมู่
E1: รายการ
F1: ยอดรวม
G1: ผู้ส่ง
H1: LINE User ID
```

- [ ] **Step 3: Share with service account**

- Copy the sheet URL — extract the Sheet ID from URL (the long string between `/d/` and `/edit`)
- Click Share → Add the service account email (from GOOGLE_SERVICE_ACCOUNT_JSON `client_email`) with **Editor** role

- [ ] **Step 4: Update .env**

```env
GOOGLE_SHEET_ID=<paste sheet id here>
```

---

## Task 12: Deploy to Digital Ocean (Docker)

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
```

- [ ] **Step 2: Write docker-compose.yml**

```yaml
version: '3.9'

services:
  receipt-bot:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

- [ ] **Step 3: Write .dockerignore**

```
node_modules
.env
*.log
.git
tests/
docs/
```

- [ ] **Step 4: Commit Docker files**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: Docker setup for Digital Ocean deploy"
```

- [ ] **Step 5: SSH to Digital Ocean VPS and install Docker**

```bash
ssh root@YOUR_VPS_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

- [ ] **Step 6: Install nginx on VPS**

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

- [ ] **Step 7: Copy project to VPS**

```bash
# From local machine
scp -r D:/Works/Web/accounting root@YOUR_VPS_IP:/var/www/receipt-bot

# Or on VPS via git
git clone <your-repo-url> /var/www/receipt-bot
```

- [ ] **Step 8: Create .env on VPS**

```bash
cd /var/www/receipt-bot
cp .env.example .env
nano .env  # fill in all values
```

- [ ] **Step 9: Build and start Docker container**

```bash
cd /var/www/receipt-bot
docker compose up -d --build
docker compose ps
```

Expected: `receipt-bot` container status = `running`

- [ ] **Step 10: Configure nginx reverse proxy**

```bash
nano /etc/nginx/sites-available/receipt-bot
```

Paste:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location /webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/receipt-bot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

- [ ] **Step 11: Set up SSL (LINE requires HTTPS)**

```bash
certbot --nginx -d YOUR_DOMAIN
```

- [ ] **Step 12: Configure LINE Webhook URL**

1. LINE Developers Console → Channel → Messaging API tab
2. Webhook URL: `https://YOUR_DOMAIN/webhook`
3. Click Verify → should return 200 OK
4. Enable "Use webhook"

- [ ] **Step 13: Smoke test end-to-end**

1. Add LINE bot to group or 1-on-1 chat
2. Send receipt photo
3. Expected: bot replies "กำลังอ่านใบเสร็จ..." then pushes Flex Message with Quick Reply
4. Tap category
5. Expected: bot replies "จดสำเร็จ ✅" and new row appears in Google Sheet

```bash
# Check logs if anything fails
docker compose logs -f receipt-bot
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Task |
|---|---|
| LINE Webhook + signature verify | Task 9 |
| Download image from LINE CDN | Task 4 (downloadImageBuffer) |
| GPT-4o Vision OCR | Task 5 |
| Supabase pending state | Task 3 + Task 10 |
| Quick Reply category confirm | Task 4 (buildOcrResultMessage) |
| Postback → update + write sheet | Task 8 |
| Google Sheet append | Task 6 |
| Success Flex Message | Task 4 (buildSuccessMessage) |
| Error handling OCR fail | Task 7 (catch block) |
| Error handling Sheet fail | Task 8 (catch block) |
| Express + Digital Ocean deploy | Task 12 |
| .env validation | Task 2 |

All spec requirements covered. ✅
