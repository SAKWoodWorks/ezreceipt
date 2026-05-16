# Phase 5b: Google Drive Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Cloudflare R2 image storage with Google Drive using the existing service account credential.

**Architecture:** `storage.js` is rewritten to use the `googleapis` Drive API (already installed). `uploadImage` uploads to a configured folder and returns the Drive fileId. `getImageUrl(fileId)` is a sync function that constructs a permanent public URL. The `image_key` DB column stores Drive fileId instead of an S3 key. No DB migration needed.

**Tech Stack:** `googleapis` (already installed), Google Drive API v3, Node.js/Express, PostgreSQL

---

## File Changes

| File | Action |
|------|--------|
| `src/services/storage.js` | Rewrite — Drive client, `uploadImage(fileName, buffer)→fileId\|null`, `getImageUrl(fileId)→string\|null` |
| `src/config.js` | Remove 4 R2 vars, add `GOOGLE_DRIVE_FOLDER_ID` |
| `src/handlers/image.js` | Filename `{userId}_{receiptId}.jpg`; capture fileId from uploadImage |
| `src/routes/api.js` | `addImageUrls` becomes sync; import `getImageUrl` instead of `getSignedUrl` |
| `tests/services/storage.test.js` | Rewrite — mock `googleapis` instead of `@aws-sdk/*` |
| `tests/handlers/image.test.js` | Update filename expectation; uploadImage resolves to fileId not undefined |
| `tests/routes/api.test.js` | Update storage mock to `getImageUrl` (sync); remove async error-path tests |
| `package.json` | `npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` |

---

### Task 1: Rewrite storage.js with Drive API (TDD)

**Files:**
- Modify: `src/services/storage.js`
- Modify: `tests/services/storage.test.js`

- [ ] **Step 1: Write failing tests — replace entire `tests/services/storage.test.js`**

```js
// jest.mock hoisted to top; jest.resetModules() in beforeEach forces storage.js
// re-evaluation so the module-level drive client picks up the new config mock.
jest.mock('googleapis');

describe('storage — Drive configured', () => {
  let uploadImage, getImageUrl;
  let mockFilesCreate, mockPermCreate;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account' }),
      GOOGLE_DRIVE_FOLDER_ID: 'test-folder-id'
    }));
    const { google } = require('googleapis');
    mockFilesCreate = jest.fn().mockResolvedValue({ data: { id: 'file-id-123' } });
    mockPermCreate = jest.fn().mockResolvedValue({});
    google.auth.GoogleAuth = jest.fn().mockImplementation(() => ({}));
    google.drive = jest.fn().mockReturnValue({
      files: { create: mockFilesCreate },
      permissions: { create: mockPermCreate }
    });
    ({ uploadImage, getImageUrl } = require('../../src/services/storage'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.clearAllMocks());

  it('uploadImage calls drive.files.create with correct name and parent folder', async () => {
    const buf = Buffer.from('imgdata');
    const fileId = await uploadImage('U123_42.jpg', buf);
    expect(mockFilesCreate).toHaveBeenCalledWith({
      requestBody: { name: 'U123_42.jpg', parents: ['test-folder-id'] },
      media: expect.objectContaining({ mimeType: 'image/jpeg' }),
      fields: 'id'
    });
    expect(fileId).toBe('file-id-123');
  });

  it('uploadImage sets file permission to anyone reader', async () => {
    await uploadImage('U123_42.jpg', Buffer.from('x'));
    expect(mockPermCreate).toHaveBeenCalledWith({
      fileId: 'file-id-123',
      requestBody: { role: 'reader', type: 'anyone' }
    });
  });

  it('uploadImage returns null on Drive API error', async () => {
    mockFilesCreate.mockRejectedValue(new Error('Drive API error'));
    const result = await uploadImage('U123_42.jpg', Buffer.from('x'));
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('getImageUrl returns correct Drive download URL', () => {
    expect(getImageUrl('file-id-123')).toBe(
      'https://drive.google.com/uc?id=file-id-123&export=download'
    );
  });

  it('getImageUrl returns null for null fileId', () => {
    expect(getImageUrl(null)).toBeNull();
  });
});

describe('storage — Drive not configured', () => {
  let uploadImage, getImageUrl;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config', () => ({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: 'service_account' }),
      GOOGLE_DRIVE_FOLDER_ID: ''
    }));
    ({ uploadImage, getImageUrl } = require('../../src/services/storage'));
  });

  afterEach(() => jest.clearAllMocks());

  it('uploadImage returns null when not configured', async () => {
    const { google } = require('googleapis');
    const result = await uploadImage('key.jpg', Buffer.from('x'));
    expect(result).toBeNull();
    expect(google.drive).not.toHaveBeenCalled();
  });

  it('getImageUrl returns null for any input', () => {
    expect(getImageUrl(null)).toBeNull();
    expect(getImageUrl('some-id')).toBe(
      'https://drive.google.com/uc?id=some-id&export=download'
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test -- tests/services/storage.test.js 2>&1 | tail -5
```

Expected: FAIL — storage.js still uses S3Client.

- [ ] **Step 3: Rewrite `src/services/storage.js`**

```js
const { google } = require('googleapis');
const { Readable } = require('stream');
const { GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID } = require('../config');

function getDriveClient() {
  if (!GOOGLE_DRIVE_FOLDER_ID) return null;
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  return google.drive({ version: 'v3', auth });
}

const drive = getDriveClient();

async function uploadImage(fileName, buffer) {
  if (!drive) return null;
  try {
    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [GOOGLE_DRIVE_FOLDER_ID]
      },
      media: {
        mimeType: 'image/jpeg',
        body: Readable.from(buffer)
      },
      fields: 'id'
    });
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    return res.data.id;
  } catch (err) {
    console.error(`Drive upload failed for ${fileName}:`, err);
    return null;
  }
}

function getImageUrl(fileId) {
  if (!fileId) return null;
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
}

module.exports = { uploadImage, getImageUrl };
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test -- tests/services/storage.test.js 2>&1 | tail -5
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && git add src/services/storage.js tests/services/storage.test.js && git commit -m "feat: replace R2 storage with Google Drive"
```

---

### Task 2: Update config.js — swap R2 vars for Drive folder ID

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Update `src/config.js`**

Find the four R2 lines at the end of `module.exports`:
```js
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || ''
```

Replace with:
```js
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || ''
```

- [ ] **Step 2: Run all tests — no regressions**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test 2>&1 | tail -5
```

Expected: all tests pass (storage tests use mocked config so they are unaffected).

- [ ] **Step 3: Commit**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && git add src/config.js && git commit -m "feat: replace R2 config vars with GOOGLE_DRIVE_FOLDER_ID"
```

---

### Task 3: Update image handler — Drive filename + capture fileId

**Files:**
- Modify: `src/handlers/image.js`
- Modify: `tests/handlers/image.test.js`

- [ ] **Step 1: Update failing tests in `tests/handlers/image.test.js`**

Update the two storage-related tests at the bottom. Find and replace them:

Old test (around line 102):
```js
it('uploads image to R2 with key receipts/{userId}/{receiptId}.jpg', async () => {
  await handleImageMessage(event);
  await new Promise(resolve => setImmediate(resolve));
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

Replace with:
```js
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
```

Also update the `beforeEach` mock default to return a fileId (not undefined):
Find: `storage.uploadImage.mockResolvedValue(undefined);`
Replace: `storage.uploadImage.mockResolvedValue('drive-file-id-default');`

- [ ] **Step 2: Run tests — expect the 3 new/modified tests to FAIL**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test -- tests/handlers/image.test.js 2>&1 | tail -10
```

Expected: 3 tests fail — wrong filename format and missing fileId capture.

- [ ] **Step 3: Update `src/handlers/image.js`**

Replace the entire file:

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

    // Upload fire-and-forget — store Drive fileId in image_key
    const fileName = `${userId}_${receiptId}.jpg`;
    uploadImage(fileName, imageBuffer)
      .then(fileId => {
        if (fileId) return updateReceipt(receiptId, { image_key: fileId });
      })
      .catch(err => console.error(`image upload/update failed for receipt ${receiptId}:`, err));

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
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test -- tests/handlers/image.test.js 2>&1 | tail -5
```

Expected: all handler tests pass (now 8 tests — 5 original + 3 new).

- [ ] **Step 5: Commit**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && git add src/handlers/image.js tests/handlers/image.test.js && git commit -m "feat: store Drive fileId in image_key after upload"
```

---

### Task 4: Update API routes — sync addImageUrls

**Files:**
- Modify: `src/routes/api.js`
- Modify: `tests/routes/api.test.js`

- [ ] **Step 1: Update storage mock in `tests/routes/api.test.js`**

Find the current storage mock (line 13-15):
```js
jest.mock('../../src/services/storage', () => ({
  getSignedUrl: jest.fn().mockResolvedValue(null)
}));
```
Replace with:
```js
jest.mock('../../src/services/storage', () => ({
  getImageUrl: jest.fn().mockReturnValue(null)
}));
```

Find the import (line 23):
```js
const { getSignedUrl } = require('../../src/services/storage');
```
Replace with:
```js
const { getImageUrl } = require('../../src/services/storage');
```

- [ ] **Step 2: Update image_url tests in `tests/routes/api.test.js`**

Find and update all 6 storage-related tests. Replace them in-place:

Inside `describe('GET /api/receipts', ...)`, find and replace the two image_url tests:
```js
it('attaches image_url when receipt has image_key', async () => {
  getImageUrl.mockReturnValue('https://drive.google.com/uc?id=abc&export=download');
  db.getReceipts.mockResolvedValue([{ id: '1', image_key: 'abc' }]);
  const res = await request(makeApp())
    .get('/api/receipts')
    .set('Cookie', adminCookie());
  expect(res.status).toBe(200);
  expect(res.body[0].image_url).toBe('https://drive.google.com/uc?id=abc&export=download');
  expect(getImageUrl).toHaveBeenCalledWith('abc');
});

it('sets image_url null for receipts with no image_key', async () => {
  db.getReceipts.mockResolvedValue([{ id: '2', image_key: null }]);
  const res = await request(makeApp())
    .get('/api/receipts')
    .set('Cookie', adminCookie());
  expect(res.status).toBe(200);
  expect(res.body[0].image_url).toBeNull();
  expect(getImageUrl).not.toHaveBeenCalled();
});

it('sets image_url null when getImageUrl returns null', async () => {
  getImageUrl.mockReturnValue(null);
  db.getReceipts.mockResolvedValue([{ id: '3', image_key: 'some-id' }]);
  const res = await request(makeApp())
    .get('/api/receipts')
    .set('Cookie', adminCookie());
  expect(res.status).toBe(200);
  expect(res.body[0].image_url).toBeNull();
});
```

Find and replace the `describe('GET /api/receipts/:id', ...)` image_url describe block — keep the two original tests but update to sync mock, and remove the `mockRejectedValue` tests (getImageUrl is sync, can't reject):
```js
describe('GET /api/receipts/:id image_url', () => {
  it('attaches image_url to single receipt', async () => {
    getImageUrl.mockReturnValue('https://drive.google.com/uc?id=xyz&export=download');
    db.getReceiptById.mockResolvedValue({ id: '1', image_key: 'xyz' });
    const res = await request(makeApp())
      .get('/api/receipts/1')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.image_url).toBe('https://drive.google.com/uc?id=xyz&export=download');
  });

  it('sets image_url null when no image_key', async () => {
    db.getReceiptById.mockResolvedValue({ id: '2', image_key: null });
    const res = await request(makeApp())
      .get('/api/receipts/2')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.image_url).toBeNull();
  });
});
```

- [ ] **Step 3: Run api tests — expect FAIL**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test -- tests/routes/api.test.js 2>&1 | tail -10
```

Expected: FAIL — `getSignedUrl` still referenced in api.js.

- [ ] **Step 4: Update `src/routes/api.js`**

Find the storage import:
```js
const { getSignedUrl } = require('../services/storage');
```
Replace with:
```js
const { getImageUrl } = require('../services/storage');
```

Find the `addImageUrls` function:
```js
async function addImageUrls(receipts) {
  return Promise.all(receipts.map(async r => {
    if (!r.image_key) return { ...r, image_url: null };
    const url = await getSignedUrl(r.image_key, 3600).catch(() => null);
    return { ...r, image_url: url };
  }));
}
```
Replace with (sync — no async, no Promise.all needed):
```js
function addImageUrls(receipts) {
  return receipts.map(r => ({
    ...r,
    image_url: r.image_key ? getImageUrl(r.image_key) : null
  }));
}
```

In `GET /receipts` handler, replace:
```js
    const receipts = await db.getReceipts(opts);
    res.json(await addImageUrls(receipts));
```
With:
```js
    const receipts = await db.getReceipts(opts);
    res.json(addImageUrls(receipts));
```

In `GET /receipts/:id` handler, replace:
```js
    const [withUrl] = await addImageUrls([receipt]);
    res.json(withUrl);
```
With:
```js
    const [withUrl] = addImageUrls([receipt]);
    res.json(withUrl);
```

- [ ] **Step 5: Run api tests — expect PASS**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test -- tests/routes/api.test.js 2>&1 | tail -5
```

Expected: all api tests pass.

- [ ] **Step 6: Run full suite — no regressions**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && git add src/routes/api.js tests/routes/api.test.js && git commit -m "feat: use sync getImageUrl for Drive URLs in API responses"
```

---

### Task 5: Remove aws-sdk packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall packages**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: removes packages, updates package.json and package-lock.json.

- [ ] **Step 2: Verify no remaining imports**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && grep -r "aws-sdk" src/ tests/ 2>/dev/null && echo "FOUND" || echo "CLEAN"
```

Expected: `CLEAN`

- [ ] **Step 3: Run full test suite**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "D:\Works\Web\accounting\.worktrees\phase5b-google-drive" && git add package.json package-lock.json && git commit -m "chore: remove aws-sdk packages, replaced by googleapis Drive"
```

---

## VPS Activation Checklist (after merge + deploy)

1. **Share Drive folder with service account**
   - In Google Drive (Workspace), create folder `EzReceipt/receipts`
   - Right-click → Share → paste service account email (from `client_email` in `GOOGLE_SERVICE_ACCOUNT_JSON`)
   - Set to **Editor**

2. **Get folder ID** from Drive URL: `drive.google.com/drive/folders/{FOLDER_ID}`

3. **Add to VPS `.env`:**
   ```
   GOOGLE_DRIVE_FOLDER_ID=<folder-id>
   ```
   Remove old R2 vars if present.

4. **Deploy:**
   ```bash
   git pull && docker compose up -d --build receipt-bot
   ```

5. **Smoke test:** Send receipt via LINE → check Drive folder for `{userId}_{receiptId}.jpg` → admin panel shows thumbnail → LIFF shows image.
