# Phase 5: Receipt Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store receipt images in Cloudflare R2 after OCR, serve signed URLs in admin panel and LIFF.

**Architecture:** After OCR+insert, upload the image buffer to R2 fire-and-forget (key = `receipts/{userId}/{receiptId}.jpg`), then update the receipt row with `image_key`. GET /receipts and GET /receipts/:id generate 1-hour signed URLs and attach `image_url`. Admin shows 60×60 thumbnail; LIFF shows full-width image below the card.

**Tech Stack:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, Node.js/Express, PostgreSQL

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected output ends with `added N packages`.

- [ ] **Step 2: Verify install**

```bash
node -e "require('@aws-sdk/client-s3'); require('@aws-sdk/s3-request-presigner'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install aws-sdk packages for R2 storage"
```

---

### Task 2: Storage service

**Files:**
- Create: `src/services/storage.js`
- Create: `tests/services/storage.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/services/storage.test.js`:

```js
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('storage — R2 configured', () => {
  let uploadImage, getSignedUrl, mockSend;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      R2_ACCOUNT_ID: 'acct-123',
      R2_ACCESS_KEY_ID: 'key-id',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'test-bucket'
    }));
    const { S3Client } = require('@aws-sdk/client-s3');
    mockSend = jest.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({ send: mockSend }));
    ({ uploadImage, getSignedUrl } = require('../../src/services/storage'));
  });

  it('uploadImage calls PutObjectCommand with correct bucket, key, body', async () => {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const buf = Buffer.from('imgdata');
    await uploadImage('receipts/U1/42.jpg', buf);
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'receipts/U1/42.jpg',
      Body: buf,
      ContentType: 'image/jpeg'
    });
    expect(mockSend).toHaveBeenCalled();
  });

  it('getSignedUrl calls aws getSignedUrl with correct expiry', async () => {
    const { getSignedUrl: awsSign } = require('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    awsSign.mockResolvedValue('https://r2.example.com/key?sig=abc');
    const url = await getSignedUrl('receipts/U1/42.jpg', 3600);
    expect(url).toBe('https://r2.example.com/key?sig=abc');
    expect(awsSign).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: 3600 }
    );
  });

  it('getSignedUrl returns null on error', async () => {
    const { getSignedUrl: awsSign } = require('@aws-sdk/s3-request-presigner');
    awsSign.mockRejectedValue(new Error('network error'));
    const url = await getSignedUrl('receipts/U1/42.jpg', 3600);
    expect(url).toBeNull();
  });
});

describe('storage — R2 not configured', () => {
  let uploadImage, getSignedUrl;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET_NAME: ''
    }));
    ({ uploadImage, getSignedUrl } = require('../../src/services/storage'));
  });

  it('uploadImage is a no-op', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    await expect(uploadImage('key', Buffer.from('x'))).resolves.toBeUndefined();
    expect(S3Client).not.toHaveBeenCalled();
  });

  it('getSignedUrl returns null', async () => {
    const url = await getSignedUrl('key', 3600);
    expect(url).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/services/storage.test.js
```

Expected: FAIL — `Cannot find module '../../src/services/storage'`

- [ ] **Step 3: Implement `src/services/storage.js`**

```js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = require('../config');

const client = R2_ACCOUNT_ID ? new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
}) : null;

async function uploadImage(key, buffer) {
  if (!client) return;
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg'
  }));
}

async function getSignedUrl(key, expirySeconds = 3600) {
  if (!client) return null;
  try {
    return await awsGetSignedUrl(
      client,
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      { expiresIn: expirySeconds }
    );
  } catch (err) {
    console.error('getSignedUrl error:', err);
    return null;
  }
}

module.exports = { uploadImage, getSignedUrl };
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/services/storage.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/services/storage.js tests/services/storage.test.js
git commit -m "feat: add R2 storage service with uploadImage and getSignedUrl"
```

---

### Task 3: Config + DB migration + DB service

**Files:**
- Modify: `src/config.js`
- Create: `migrations/002_add_image_key.sql`
- Modify: `src/services/db.js`

- [ ] **Step 1: Update `src/config.js` — add R2 env vars**

In `src/config.js`, add R2 exports at the end of the `module.exports` block (these are optional — no validation required):

Current last line of module.exports (line 33):
```js
  PORT: process.env.PORT || 3000
```

Replace entire `module.exports` block (lines 20-33) with:
```js
module.exports = {
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET,
  LIFF_ID: process.env.LIFF_ID || '',
  OLLAMA_BASE_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5vl:7b',
  PORT: process.env.PORT || 3000,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || ''
};
```

- [ ] **Step 2: Verify config test still passes**

```bash
npm test -- tests/services/config.test.js
```

Expected: PASS

- [ ] **Step 3: Create `migrations/002_add_image_key.sql`**

```sql
ALTER TABLE receipts ADD COLUMN image_key TEXT;
```

- [ ] **Step 4: Update `src/services/db.js` — add `image_key` to `getReceipts` SELECT**

In `getReceipts` (lines 43-58), the SELECT list currently ends with `status, created_at`. Add `image_key`:

Find this line (line 46):
```js
    `SELECT id, line_user_id, line_display_name, date_on_receipt,
            store_name, category, items, total_amount, status, created_at
```

Replace with:
```js
    `SELECT id, line_user_id, line_display_name, date_on_receipt,
            store_name, category, items, total_amount, status, created_at, image_key
```

- [ ] **Step 5: Verify db tests still pass**

```bash
npm test -- tests/services/db.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config.js migrations/002_add_image_key.sql src/services/db.js
git commit -m "feat: add R2 config vars, image_key migration, add image_key to getReceipts"
```

---

### Task 4: Image handler — upload after insert

**Files:**
- Modify: `src/handlers/image.js`
- Modify: `tests/handlers/image.test.js`

- [ ] **Step 1: Add failing tests to `tests/handlers/image.test.js`**

At the top of the file (after the existing `jest.mock('../../src/services/db')` line), add:

```js
jest.mock('../../src/services/storage');
```

After the `db.insertReceipt = jest.fn().mockResolvedValue('receipt-uuid-123');` line, add:

```js
const storage = require('../../src/services/storage');
storage.uploadImage = jest.fn().mockResolvedValue(undefined);
```

Also add `updateReceipt` to the existing db mock setup:

```js
db.updateReceipt = jest.fn().mockResolvedValue(undefined);
```

Inside the `describe('handleImageMessage', ...)` block, in `beforeEach`, add:

```js
storage.uploadImage.mockResolvedValue(undefined);
db.updateReceipt.mockResolvedValue(undefined);
```

Then add these two new test cases at the end of the describe block:

```js
it('uploads image to R2 with key receipts/{userId}/{receiptId}.jpg', async () => {
  await handleImageMessage(event);
  await new Promise(resolve => setImmediate(resolve)); // flush async upload
  expect(storage.uploadImage).toHaveBeenCalledWith(
    'receipts/U123/receipt-uuid-123.jpg',
    Buffer.from('img')
  );
});

it('continues and pushes OCR result even if upload fails', async () => {
  storage.uploadImage.mockRejectedValue(new Error('R2 down'));
  await handleImageMessage(event);
  await new Promise(resolve => setImmediate(resolve));
  expect(lineService.pushMessage).toHaveBeenCalledWith('U123', expect.anything());
  expect(db.updateReceipt).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/handlers/image.test.js
```

Expected: FAIL — new tests fail because handler doesn't upload yet

- [ ] **Step 3: Update `src/handlers/image.js`**

Replace entire file:

```js
// src/handlers/image.js
const { downloadImageBuffer, replyMessage, pushMessage, buildOcrResultMessage, getUserDisplayName } = require('../services/line');
const { extractReceiptData } = require('../services/ocr');
const { insertReceipt, updateReceipt } = require('../services/db');
const { uploadImage } = require('../services/storage');

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

    const displayName = await getUserDisplayName(userId, groupId);

    const receiptId = await insertReceipt({
      line_user_id: userId,
      line_display_name: displayName,
      group_id: groupId,
      date_on_receipt: ocrData.date_on_receipt,
      store_name: ocrData.store_name,
      items: ocrData.items,
      total_amount: ocrData.total_amount,
      status: 'pending'
    });

    // Upload image fire-and-forget — never block the LINE response
    const imageKey = `receipts/${userId}/${receiptId}.jpg`;
    uploadImage(imageKey, imageBuffer)
      .then(() => updateReceipt(receiptId, { image_key: imageKey }))
      .catch(err => console.error('image upload error:', err));

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

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/handlers/image.test.js
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/handlers/image.js tests/handlers/image.test.js
git commit -m "feat: upload receipt image to R2 after OCR insert"
```

---

### Task 5: API routes — attach signed image URLs

**Files:**
- Modify: `src/routes/api.js`
- Modify: `tests/routes/api.test.js`

- [ ] **Step 1: Add failing tests to `tests/routes/api.test.js`**

After the existing `jest.mock('../../src/services/export')` line, add:

```js
jest.mock('../../src/services/storage', () => ({
  getSignedUrl: jest.fn().mockResolvedValue(null)
}));
```

Add this import after the existing requires:

```js
const { getSignedUrl } = require('../../src/services/storage');
```

Add new test cases inside `describe('GET /api/receipts', ...)` (after the existing tests):

```js
it('attaches image_url when receipt has image_key', async () => {
  getSignedUrl.mockResolvedValue('https://r2.example.com/img.jpg?sig=x');
  db.getReceipts.mockResolvedValue([{ id: '1', image_key: 'receipts/U1/1.jpg' }]);
  const res = await request(makeApp())
    .get('/api/receipts')
    .set('Cookie', adminCookie());
  expect(res.body[0].image_url).toBe('https://r2.example.com/img.jpg?sig=x');
  expect(getSignedUrl).toHaveBeenCalledWith('receipts/U1/1.jpg', 3600);
});

it('sets image_url null for receipts with no image_key', async () => {
  db.getReceipts.mockResolvedValue([{ id: '2', image_key: null }]);
  const res = await request(makeApp())
    .get('/api/receipts')
    .set('Cookie', adminCookie());
  expect(res.body[0].image_url).toBeNull();
  expect(getSignedUrl).not.toHaveBeenCalled();
});
```

Also add a test inside a new `describe('GET /api/receipts/:id', ...)` block:

```js
describe('GET /api/receipts/:id', () => {
  it('attaches image_url to single receipt', async () => {
    getSignedUrl.mockResolvedValue('https://r2.example.com/img.jpg?sig=y');
    db.getReceiptById.mockResolvedValue({ id: '1', image_key: 'receipts/U1/1.jpg' });
    const res = await request(makeApp())
      .get('/api/receipts/1')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.image_url).toBe('https://r2.example.com/img.jpg?sig=y');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/routes/api.test.js
```

Expected: FAIL — `image_url` missing from response

- [ ] **Step 3: Update `src/routes/api.js`**

Add storage import at the top (after the existing requires):

```js
const { getSignedUrl } = require('../services/storage');
```

Add `addImageUrls` helper function after the `receiptAuth` function (before the first route):

```js
async function addImageUrls(receipts) {
  return Promise.all(receipts.map(async r => {
    if (!r.image_key) return { ...r, image_url: null };
    const url = await getSignedUrl(r.image_key, 3600).catch(() => null);
    return { ...r, image_url: url };
  }));
}
```

Update `GET /receipts` handler — replace `res.json(await db.getReceipts(opts))` with:

```js
const receipts = await db.getReceipts(opts);
res.json(await addImageUrls(receipts));
```

Update `GET /receipts/:id` handler — replace `res.json(receipt)` with:

```js
const [withUrl] = await addImageUrls([receipt]);
res.json(withUrl);
```

The full updated `GET /receipts/:id` handler becomes:

```js
router.get('/receipts/:id', receiptAuth, async (req, res) => {
  try {
    const receipt = await db.getReceiptById(req.params.id);
    if (req.liffUserId && receipt.line_user_id !== req.liffUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [withUrl] = await addImageUrls([receipt]);
    res.json(withUrl);
  } catch (err) {
    if (err.message.includes('Receipt not found')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Run all tests — expect PASS**

```bash
npm test
```

Expected: all tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add src/routes/api.js tests/routes/api.test.js
git commit -m "feat: attach signed image_url to GET /receipts responses"
```

---

### Task 6: Admin UI — receipt image thumbnail

**Files:**
- Modify: `public/admin/dashboard.html`
- Modify: `public/admin/app.js`

- [ ] **Step 1: Add `รูป` column header in `public/admin/dashboard.html`**

Find the `<thead>` row (line 53):
```html
<thead><tr><th>วันที่</th><th>ร้านค้า</th><th>หมวดหมู่</th><th>ยอด</th><th>ผู้ส่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
```

Replace with (adds `รูป` column before `จัดการ`, updates colspan from 7 to 8):
```html
<thead><tr><th>วันที่</th><th>ร้านค้า</th><th>หมวดหมู่</th><th>ยอด</th><th>ผู้ส่ง</th><th>สถานะ</th><th>รูป</th><th>จัดการ</th></tr></thead>
<tbody id="receipts-tbody"><tr><td colspan="8" style="text-align:center;padding:24px;color:#888">กำลังโหลด...</td></tr></tbody>
```

Also find and fix the empty-state colspan in `app.js` (line 90):
```js
tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px">ไม่พบข้อมูล</td></tr>';
```

Change `colspan="7"` to `colspan="8"`.

- [ ] **Step 2: Add thumbnail `<td>` in `renderTable` in `public/admin/app.js`**

Find the `renderTable` function (lines 87-105). Inside the `tbody.innerHTML = receipts.map(...)` template, after the `สถานะ` `<td>` block and before the `จัดการ` `<td>` block, add a thumbnail cell.

Replace the entire `renderTable` function:

```js
function renderTable(receipts) {
  currentReceipts = receipts;
  const tbody = document.getElementById('receipts-tbody');
  if (!receipts.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:24px">ไม่พบข้อมูล</td></tr>'; return; }
  tbody.innerHTML = receipts.map((r, i) => `
    <tr>
      <td>${r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-'}</td>
      <td>${r.store_name || '-'}</td>
      <td>${r.category || '-'}</td>
      <td>฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</td>
      <td>${r.line_display_name || '-'}</td>
      <td><span style="background:${r.status==='confirmed'?'#e8f5e9':'#fff3e0'};color:${r.status==='confirmed'?'#2e7d32':'#e65100'};padding:2px 8px;border-radius:4px;font-size:12px">${r.status}</span></td>
      <td>${r.image_url ? `<a href="${r.image_url}" target="_blank"><img src="${r.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:4px"></a>` : '-'}</td>
      <td>
        <button class="btn btn-warning" style="margin-right:4px;padding:5px 10px" data-idx="${i}" onclick="openEditByIdx(this.dataset.idx)">แก้ไข</button>
        <button class="btn btn-danger" style="padding:5px 10px" onclick="deleteReceipt('${r.id}')">ลบ</button>
      </td>
    </tr>
  `).join('');
}
```

- [ ] **Step 3: Commit**

```bash
git add public/admin/dashboard.html public/admin/app.js
git commit -m "feat: show receipt image thumbnail in admin panel"
```

---

### Task 7: LIFF UI — receipt image in card

**Files:**
- Modify: `public/liff/app.js`

- [ ] **Step 1: Update `renderReceipts` to show image below card**

Find the `renderReceipts` function (lines 177-200). Replace the `list.innerHTML = allReceipts.map(...)` template:

Current template (inside the map):
```js
  list.innerHTML = allReceipts.map(r => `
    <div class="receipt-card">
      <div class="row">
        <span class="store">${esc(r.store_name || 'ไม่ระบุร้าน')}</span>
        <span class="amount">฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</span>
      </div>
      <div class="meta">
        ${esc(r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-')}
        &nbsp;·&nbsp;
        <span class="category-badge">${esc(r.category || 'ไม่ระบุ')}</span>
      </div>
    </div>
  `).join('');
```

Replace with:
```js
  list.innerHTML = allReceipts.map(r => `
    <div class="receipt-card">
      <div class="row">
        <span class="store">${esc(r.store_name || 'ไม่ระบุร้าน')}</span>
        <span class="amount">฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</span>
      </div>
      <div class="meta">
        ${esc(r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-')}
        &nbsp;·&nbsp;
        <span class="category-badge">${esc(r.category || 'ไม่ระบุ')}</span>
      </div>
      ${r.image_url ? `<a href="${r.image_url}" target="_blank"><img src="${r.image_url}" style="width:100%;max-height:200px;object-fit:contain;border-radius:6px;margin-top:8px;display:block"></a>` : ''}
    </div>
  `).join('');
```

- [ ] **Step 2: Bump cache-bust version on LIFF script tag**

In `public/liff/index.html`, find:
```html
<script src="/liff/app.js?v=3"></script>
```

Replace with:
```html
<script src="/liff/app.js?v=4"></script>
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add public/liff/app.js public/liff/index.html
git commit -m "feat: show receipt image in LIFF card"
```

---

### Task 8: Run DB migration on VPS + deploy

**Files:** None (operational steps)

- [ ] **Step 1: Apply migration on VPS**

SSH into VPS and run:

```bash
docker exec -i receipt-bot-db-1 psql -U postgres -d receipts_db < migrations/002_add_image_key.sql
```

Or if the migration file isn't on VPS yet, run the SQL directly:

```bash
docker exec receipt-bot-db-1 psql -U postgres -d receipts_db -c "ALTER TABLE receipts ADD COLUMN IF NOT EXISTS image_key TEXT;"
```

Expected output: `ALTER TABLE`

- [ ] **Step 2: Verify column exists**

```bash
docker exec receipt-bot-db-1 psql -U postgres -d receipts_db -c "\d receipts"
```

Expected: `image_key | text` column appears in output.

- [ ] **Step 3: Add R2 env vars to VPS `.env`**

Add to `/root/receipt-bot/.env` (or wherever the env file lives on VPS):

```
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-token-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-token-secret>
R2_BUCKET_NAME=<bucket-name>
```

If R2 is not yet set up, leave these empty — storage is a no-op when `R2_ACCOUNT_ID` is empty.

- [ ] **Step 4: Push code and deploy**

```bash
git push origin <branch>
```

On VPS:

```bash
git pull
docker compose up -d --build receipt-bot
```

- [ ] **Step 5: Smoke test**

1. Send a receipt image via LINE
2. Check R2 bucket — new file `receipts/{userId}/{receiptId}.jpg` should appear
3. Open admin panel → receipt list → `รูป` column shows thumbnail
4. Open LIFF → receipt list → image appears below card
5. Click image → opens full-size in new tab

---

## Manual Verification Checklist

After deploy:
- [ ] Admin panel receipt table has 8 columns (รูป column visible)
- [ ] Old receipts (no image) show `-` in รูป column and no image in LIFF
- [ ] New receipt sent via LINE → image appears in both admin and LIFF
- [ ] Signed URLs expire (test: try URL after 1 hour → should 403)
- [ ] App still works with empty R2 env vars (receipts save normally, no crash)
