# Phase 2: LIFF Dashboard + Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม LIFF web app สำหรับสมาชิกดู receipt ของตัวเอง และ Admin Panel สำหรับผู้จัดการดู/แก้ไข/export receipt ทั้งหมด บน Express server เดิม

**Architecture:** เพิ่ม routes และ static files ใน Express เดิม ไม่สร้าง service ใหม่ Admin ใช้ JWT httpOnly cookie, LIFF ใช้ LINE access token verify แล้วแลก session JWT

**Tech Stack:** Node.js/Express, jsonwebtoken, csv-stringify, cookie-parser, Chart.js CDN, LINE LIFF SDK v2

---

## File Structure

```
src/
  config.js                     (modify — add ADMIN_PASSWORD, JWT_SECRET)
  services/
    db.js                       (modify — add getReceipts, deleteReceipt, getStats, getUsers)
    export.js                   (create — CSV generation)
  middleware/
    adminAuth.js                (create — JWT cookie verification)
  routes/
    api.js                      (create — REST endpoints)
    admin.js                    (create — admin login/serve HTML)
    liff.js                     (create — serve LIFF HTML)
index.js                        (modify — wire up routes)
public/
  admin/
    index.html                  (create — login page)
    dashboard.html              (create — dashboard SPA)
    style.css                   (create)
    app.js                      (create — admin JS)
  liff/
    index.html                  (create — LIFF SPA)
    style.css                   (create)
    app.js                      (create — LIFF JS)
tests/
  middleware/
    adminAuth.test.js           (create)
  routes/
    api.test.js                 (create)
    admin.test.js               (create)
  services/
    export.test.js              (create)
.env.example                    (modify)
```

---

### Task 1: Install dependencies + update config

**Files:**
- Modify: `src/config.js`
- Modify: `tests/services/config.test.js`
- Modify: `.env.example`

- [ ] **Step 1: Install packages**

```bash
cd D:/Works/Web/accounting
npm install jsonwebtoken csv-stringify cookie-parser
```

Expected: packages added to `node_modules/` and `package.json`

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
npx jest --no-coverage
```

Expected: 23 passed

- [ ] **Step 3: Update config.js**

Replace `src/config.js` with:

```javascript
const REQUIRED = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'GOOGLE_AI_API_KEY',
  'DATABASE_URL',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'ADMIN_PASSWORD',
  'JWT_SECRET'
];

for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

module.exports = {
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET,
  LIFF_ID: process.env.LIFF_ID || '',
  PORT: process.env.PORT || 3000
};
```

- [ ] **Step 4: Update all config mocks in tests**

In `tests/services/config.test.js`, `tests/handlers/image.test.js`, `tests/handlers/postback.test.js` — add these two keys to the mock object:

```javascript
ADMIN_PASSWORD: 'test-admin-pass',
JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
```

Also update `tests/services/config.test.js` REQUIRED array:

```javascript
const REQUIRED = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'GOOGLE_AI_API_KEY',
  'DATABASE_URL',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'ADMIN_PASSWORD',
  'JWT_SECRET'
];
```

- [ ] **Step 5: Update .env.example**

Add at end of `D:/Works/Web/accounting/.env.example`:

```
ADMIN_PASSWORD=your_strong_admin_password
JWT_SECRET=your_jwt_secret_minimum_32_characters_long
LIFF_ID=your_liff_id_from_line_developers
```

- [ ] **Step 6: Run tests**

```bash
npx jest --no-coverage
```

Expected: 23 passed

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/config.js tests/services/config.test.js tests/handlers/image.test.js tests/handlers/postback.test.js .env.example
git commit -m "feat: add Phase 2 dependencies and config vars"
```

---

### Task 2: DB queries for API

**Files:**
- Modify: `src/services/db.js`
- Create: `tests/services/db.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/services/db.test.js`:

```javascript
jest.mock('../../src/config', () => ({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  ADMIN_PASSWORD: 'test-pass',
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx'
}));

const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery }))
}));

const db = require('../../src/services/db');

beforeEach(() => mockQuery.mockReset());

describe('getReceipts', () => {
  it('returns confirmed receipts filtered by userId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: '1', store_name: 'Test' }] });
    const result = await db.getReceipts({ userId: 'U123', month: null, category: null });
    expect(result).toEqual([{ id: '1', store_name: 'Test' }]);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      expect.arrayContaining(['U123'])
    );
  });

  it('passes null filters correctly', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await db.getReceipts({ userId: null, month: '2026-05', category: 'อาหาร/เครื่องดื่ม' });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      [null, '2026-05', 'อาหาร/เครื่องดื่ม', null, null]
    );
  });
});

describe('deleteReceipt', () => {
  it('deletes receipt by id', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 });
    await expect(db.deleteReceipt('uuid-123')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      ['uuid-123']
    );
  });

  it('throws if receipt not found', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0 });
    await expect(db.deleteReceipt('bad-id')).rejects.toThrow('Receipt not found');
  });
});

describe('getStats', () => {
  it('returns monthly and category stats', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ month: '2026-05', total: 1000, count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ category: 'อาหาร/เครื่องดื่ม', total: 500, count: 3 }] });
    const result = await db.getStats(6);
    expect(result.monthly).toHaveLength(1);
    expect(result.categories).toHaveLength(1);
  });
});

describe('getUsers', () => {
  it('returns distinct users', async () => {
    mockQuery.mockResolvedValue({ rows: [{ line_user_id: 'U1', line_display_name: 'Alice' }] });
    const result = await db.getUsers();
    expect(result).toEqual([{ line_user_id: 'U1', line_display_name: 'Alice' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/services/db.test.js --no-coverage
```

Expected: FAIL — `db.getReceipts is not a function`

- [ ] **Step 3: Implement new DB functions**

Append to `src/services/db.js` (before `module.exports`):

```javascript
async function getReceipts({ userId = null, month = null, category = null, from = null, to = null } = {}) {
  const { rows } = await pool.query(
    `SELECT id, line_user_id, line_display_name, date_on_receipt,
            store_name, category, items, total_amount, status, created_at
     FROM receipts
     WHERE ($1::text IS NULL OR line_user_id = $1)
       AND ($2::text IS NULL OR to_char(date_on_receipt, 'YYYY-MM') = $2)
       AND ($3::text IS NULL OR category = $3)
       AND ($4::text IS NULL OR to_char(date_on_receipt, 'YYYY-MM') >= $4)
       AND ($5::text IS NULL OR to_char(date_on_receipt, 'YYYY-MM') <= $5)
     ORDER BY date_on_receipt DESC NULLS LAST, created_at DESC`,
    [userId, month, category, from, to]
  );
  return rows;
}

async function deleteReceipt(id) {
  const { rowCount } = await pool.query('DELETE FROM receipts WHERE id = $1', [id]);
  if (rowCount === 0) throw new Error(`Receipt not found: ${id}`);
}

async function getStats(months = 6) {
  const startMonth = new Date();
  startMonth.setMonth(startMonth.getMonth() - (months - 1));
  const startDate = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const monthlyResult = await pool.query(
    `SELECT to_char(date_trunc('month', date_on_receipt), 'YYYY-MM') as month,
            SUM(total_amount)::float as total, COUNT(*)::int as count
     FROM receipts
     WHERE status = 'confirmed' AND date_on_receipt >= $1::date
     GROUP BY 1 ORDER BY 1`,
    [startDate]
  );

  const categoryResult = await pool.query(
    `SELECT category, SUM(total_amount)::float as total, COUNT(*)::int as count
     FROM receipts
     WHERE status = 'confirmed'
       AND to_char(date_on_receipt, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
     GROUP BY category ORDER BY total DESC`
  );

  return { monthly: monthlyResult.rows, categories: categoryResult.rows };
}

async function getUsers() {
  const { rows } = await pool.query(
    `SELECT DISTINCT line_user_id, line_display_name
     FROM receipts
     WHERE line_display_name IS NOT NULL
     ORDER BY line_display_name`
  );
  return rows;
}
```

Update `module.exports` in `src/services/db.js`:

```javascript
module.exports = { insertReceipt, updateReceipt, getReceiptById, getReceipts, deleteReceipt, getStats, getUsers };
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/services/db.test.js --no-coverage
```

Expected: 6 passed

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 6: Commit**

```bash
git add src/services/db.js tests/services/db.test.js
git commit -m "feat: add getReceipts, deleteReceipt, getStats, getUsers to db service"
```

---

### Task 3: adminAuth middleware

**Files:**
- Create: `src/middleware/adminAuth.js`
- Create: `tests/middleware/adminAuth.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/middleware/adminAuth.test.js`:

```javascript
jest.mock('../../src/config', () => ({
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
  ADMIN_PASSWORD: 'test-pass',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  GOOGLE_AI_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{}'
}));

const jwt = require('jsonwebtoken');
const adminAuth = require('../../src/middleware/adminAuth');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe('adminAuth middleware', () => {
  const JWT_SECRET = 'test-secret-32-chars-xxxxxxxxxxxxxxxxx';

  it('calls next() with valid admin JWT cookie', () => {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET);
    const req = { cookies: { admin_token: token } };
    const res = makeRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.admin.role).toBe('admin');
  });

  it('returns 401 when no cookie', () => {
    const req = { cookies: {} };
    const res = makeRes();
    adminAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with expired token', () => {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '-1s' });
    const req = { cookies: { admin_token: token } };
    const res = makeRes();
    adminAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 with non-admin role', () => {
    const token = jwt.sign({ role: 'user' }, JWT_SECRET);
    const req = { cookies: { admin_token: token } };
    const res = makeRes();
    adminAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/middleware/adminAuth.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/middleware/adminAuth'`

- [ ] **Step 3: Create adminAuth middleware**

Create `src/middleware/adminAuth.js`:

```javascript
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function adminAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = adminAuth;
```

- [ ] **Step 4: Run test**

```bash
npx jest tests/middleware/adminAuth.test.js --no-coverage
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/middleware/adminAuth.js tests/middleware/adminAuth.test.js
git commit -m "feat: add adminAuth JWT middleware"
```

---

### Task 4: API routes

**Files:**
- Create: `src/routes/api.js`
- Create: `tests/routes/api.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/routes/api.test.js`:

```javascript
jest.mock('../../src/config', () => ({
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
  ADMIN_PASSWORD: 'test-pass',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  GOOGLE_AI_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{}'
}));
jest.mock('../../src/services/db');
jest.mock('../../src/services/export');

const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('../../src/services/db');
const { generateCsv } = require('../../src/services/export');

const JWT_SECRET = 'test-secret-32-chars-xxxxxxxxxxxxxxxxx';

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use('/api', require('../../src/routes/api'));
  return app;
}

function adminCookie() {
  return `admin_token=${jwt.sign({ role: 'admin' }, JWT_SECRET)}`;
}

function liffHeader() {
  const token = jwt.sign({ userId: 'U123' }, JWT_SECRET);
  return `Bearer ${token}`;
}

describe('GET /api/receipts', () => {
  it('returns receipts for admin', async () => {
    db.getReceipts.mockResolvedValue([{ id: '1' }]);
    const app = makeApp();
    const res = await request(app)
      .get('/api/receipts')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('forces userId filter for LIFF', async () => {
    db.getReceipts.mockResolvedValue([]);
    const app = makeApp();
    await request(app)
      .get('/api/receipts?userId=OTHER')
      .set('Authorization', liffHeader());
    expect(db.getReceipts).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'U123' })
    );
  });

  it('returns 401 with no auth', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/receipts');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/receipts/:id', () => {
  it('deletes with admin auth', async () => {
    db.deleteReceipt.mockResolvedValue();
    const app = makeApp();
    const res = await request(app)
      .delete('/api/receipts/uuid-1')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(db.deleteReceipt).toHaveBeenCalledWith('uuid-1');
  });

  it('returns 401 without admin auth', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/receipts/uuid-1');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/receipts/:id', () => {
  it('updates receipt with admin auth', async () => {
    db.updateReceipt.mockResolvedValue();
    const app = makeApp();
    const res = await request(app)
      .put('/api/receipts/uuid-1')
      .set('Cookie', adminCookie())
      .send({ store_name: 'New Store', category: 'อื่นๆ' });
    expect(res.status).toBe(200);
    expect(db.updateReceipt).toHaveBeenCalledWith('uuid-1', expect.objectContaining({ store_name: 'New Store' }));
  });
});

describe('GET /api/stats', () => {
  it('returns stats for admin', async () => {
    db.getStats.mockResolvedValue({ monthly: [], categories: [] });
    const app = makeApp();
    const res = await request(app)
      .get('/api/stats')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('monthly');
  });
});

describe('GET /api/export/csv', () => {
  it('returns CSV with admin auth', async () => {
    db.getReceipts.mockResolvedValue([{ store_name: 'Test' }]);
    generateCsv.mockReturnValue('วันที่,ร้านค้า\n,Test');
    const app = makeApp();
    const res = await request(app)
      .get('/api/export/csv')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });
});
```

- [ ] **Step 2: Install supertest**

```bash
npm install --save-dev supertest
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest tests/routes/api.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/routes/api'`

- [ ] **Step 4: Create src/routes/api.js**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../services/db');
const { generateCsv } = require('../services/export');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(express.json());

function receiptAuth(req, res, next) {
  const adminToken = req.cookies?.admin_token;
  if (adminToken) {
    try {
      const payload = jwt.verify(adminToken, JWT_SECRET);
      if (payload.role === 'admin') { req.isAdmin = true; return next(); }
    } catch {}
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      if (payload.userId) { req.liffUserId = payload.userId; return next(); }
    } catch {}
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

router.get('/receipts', receiptAuth, async (req, res) => {
  try {
    let { userId, month, category } = req.query;
    if (req.liffUserId) userId = req.liffUserId;
    res.json(await db.getReceipts({ userId: userId || null, month: month || null, category: category || null }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/receipts/:id', adminAuth, async (req, res) => {
  try {
    const { store_name, date_on_receipt, category, total_amount } = req.body;
    await db.updateReceipt(req.params.id, { store_name, date_on_receipt, category, total_amount });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/receipts/:id', adminAuth, async (req, res) => {
  try {
    await db.deleteReceipt(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', adminAuth, async (req, res) => {
  try {
    res.json(await db.getStats(parseInt(req.query.months) || 6));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    res.json(await db.getUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/csv', adminAuth, async (req, res) => {
  try {
    const { from, to, userId } = req.query;
    const receipts = await db.getReceipts({ from: from || null, to: to || null, userId: userId || null });
    const csv = generateCsv(receipts);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="receipts.csv"');
    res.send('﻿' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/liff/verify', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
    const lineRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!lineRes.ok) return res.status(401).json({ error: 'Invalid LINE access token' });
    const profile = await lineRes.json();
    const sessionToken = jwt.sign({ userId: profile.userId }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ userId: profile.userId, displayName: profile.displayName, sessionToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 5: Run tests**

```bash
npx jest tests/routes/api.test.js --no-coverage
```

Expected: all passed

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 7: Commit**

```bash
git add src/routes/api.js tests/routes/api.test.js package.json package-lock.json
git commit -m "feat: add API routes (receipts CRUD, stats, export, liff/verify)"
```

---

### Task 5: Export service

**Files:**
- Create: `src/services/export.js`
- Create: `tests/services/export.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/services/export.test.js`:

```javascript
const { generateCsv } = require('../../src/services/export');

describe('generateCsv', () => {
  it('returns CSV string with header row', () => {
    const csv = generateCsv([]);
    expect(csv).toContain('วันที่');
    expect(csv).toContain('ร้านค้า');
    expect(csv).toContain('ยอดรวม');
  });

  it('includes receipt data rows', () => {
    const receipts = [{
      date_on_receipt: '2026-05-07',
      store_name: '7-Eleven',
      category: 'อาหาร/เครื่องดื่ม',
      total_amount: 64,
      line_display_name: 'Alice',
      line_user_id: 'U123',
      created_at: '2026-05-07T10:00:00.000Z'
    }];
    const csv = generateCsv(receipts);
    expect(csv).toContain('7-Eleven');
    expect(csv).toContain('64');
    expect(csv).toContain('Alice');
  });

  it('handles null fields without throwing', () => {
    const csv = generateCsv([{ date_on_receipt: null, store_name: null, category: null, total_amount: null, line_display_name: null, line_user_id: 'U1', created_at: null }]);
    expect(typeof csv).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/services/export.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/services/export'`

- [ ] **Step 3: Create src/services/export.js**

```javascript
const { stringify } = require('csv-stringify/sync');

function generateCsv(receipts) {
  const header = ['วันที่', 'ร้านค้า', 'หมวดหมู่', 'ยอดรวม', 'ผู้ส่ง', 'LINE User ID', 'บันทึกเมื่อ'];
  const rows = receipts.map(r => [
    r.date_on_receipt ? String(r.date_on_receipt).slice(0, 10) : '',
    r.store_name || '',
    r.category || '',
    r.total_amount ?? '',
    r.line_display_name || '',
    r.line_user_id || '',
    r.created_at ? String(r.created_at).slice(0, 19) : ''
  ]);
  return stringify([header, ...rows]);
}

module.exports = { generateCsv };
```

- [ ] **Step 4: Run test**

```bash
npx jest tests/services/export.test.js --no-coverage
```

Expected: 3 passed

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 6: Commit**

```bash
git add src/services/export.js tests/services/export.test.js
git commit -m "feat: add CSV export service"
```

---

### Task 6: Admin auth routes

**Files:**
- Create: `src/routes/admin.js`
- Create: `tests/routes/admin.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/routes/admin.test.js`:

```javascript
jest.mock('../../src/config', () => ({
  JWT_SECRET: 'test-secret-32-chars-xxxxxxxxxxxxxxxxx',
  ADMIN_PASSWORD: 'correct-password',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  GOOGLE_AI_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  GOOGLE_SHEET_ID: 'test-sheet-id',
  GOOGLE_SERVICE_ACCOUNT_JSON: '{}',
  LIFF_ID: ''
}));

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use('/admin', require('../../src/routes/admin'));
  return app;
}

describe('POST /admin/login', () => {
  it('sets cookie and returns ok on correct password', async () => {
    const res = await request(makeApp())
      .post('/admin/login')
      .send({ password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('admin_token');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(makeApp())
      .post('/admin/login')
      .send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('POST /admin/logout', () => {
  it('clears cookie', async () => {
    const res = await request(makeApp()).post('/admin/logout');
    expect(res.headers['set-cookie'][0]).toContain('admin_token=;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest tests/routes/admin.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/routes/admin'`

- [ ] **Step 3: Create src/routes/admin.js**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const { ADMIN_PASSWORD, JWT_SECRET } = require('../config');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const token = req.cookies?.admin_token;
    if (token) { jwt.verify(token, JWT_SECRET); return res.redirect('/admin/dashboard'); }
  } catch {}
  res.redirect('/admin/login');
});

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

router.post('/login', express.json(), (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'strict', maxAge: 8 * 3600 * 1000 });
  res.json({ ok: true });
});

router.get('/dashboard', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/routes/admin.test.js --no-coverage
```

Expected: 3 passed

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.js tests/routes/admin.test.js
git commit -m "feat: add admin auth routes (login/logout/serve dashboard)"
```

---

### Task 7: LIFF route

**Files:**
- Create: `src/routes/liff.js`

- [ ] **Step 1: Create src/routes/liff.js**

```javascript
const express = require('express');
const path = require('path');
const { LIFF_ID } = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/liff/index.html'));
});

router.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.LIFF_ID = '${LIFF_ID}';`);
});

module.exports = router;
```

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 3: Commit**

```bash
git add src/routes/liff.js
git commit -m "feat: add LIFF route (serve HTML + inject LIFF_ID)"
```

---

### Task 8: Wire up index.js + create public directories

**Files:**
- Modify: `index.js`

- [ ] **Step 1: Create public directories**

```bash
mkdir -p D:/Works/Web/accounting/public/admin
mkdir -p D:/Works/Web/accounting/public/liff
```

- [ ] **Step 2: Create placeholder HTML files** (so Express doesn't crash on startup before Task 9/10)

Create `public/admin/index.html`:
```html
<!DOCTYPE html><html><body><h1>Admin Login</h1></body></html>
```

Create `public/admin/dashboard.html`:
```html
<!DOCTYPE html><html><body><h1>Admin Dashboard</h1></body></html>
```

Create `public/liff/index.html`:
```html
<!DOCTYPE html><html><body><h1>LIFF App</h1></body></html>
```

- [ ] **Step 3: Update index.js**

Replace `index.js` with:

```javascript
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const webhookRouter = require('./src/webhook');
const apiRouter = require('./src/routes/api');
const adminRouter = require('./src/routes/admin');
const liffRouter = require('./src/routes/liff');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use('/webhook', webhookRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);
app.use('/liff', liffRouter);
app.use('/liff', express.static(path.join(__dirname, 'public/liff')));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;
```

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add index.js public/admin/index.html public/admin/dashboard.html public/liff/index.html
git commit -m "feat: wire up Phase 2 routes in Express, add public dirs"
```

---

### Task 9: Admin HTML frontend

**Files:**
- Create: `public/admin/index.html`
- Create: `public/admin/dashboard.html`
- Create: `public/admin/style.css`
- Create: `public/admin/app.js`

- [ ] **Step 1: Update .env with Phase 2 vars** (local dev only)

Add to `D:/Works/Web/accounting/.env`:
```
ADMIN_PASSWORD=admin123
JWT_SECRET=phase2-jwt-secret-minimum-32-chars-long
LIFF_ID=
```

- [ ] **Step 2: Create public/admin/style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; }

/* Login */
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.login-box { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.1); width: 360px; }
.login-box h1 { font-size: 22px; margin-bottom: 8px; color: #1e3a5f; }
.login-box p { color: #888; margin-bottom: 24px; font-size: 14px; }
.login-box input { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; margin-bottom: 12px; }
.login-box button { width: 100%; padding: 11px; background: #1e3a5f; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
.login-box button:hover { background: #2a5080; }
.error-msg { color: #e74c3c; font-size: 13px; margin-top: 8px; display: none; }

/* Layout */
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: #2c3e50; color: white; padding: 20px 0; flex-shrink: 0; }
.sidebar .brand { padding: 0 20px 20px; font-size: 17px; font-weight: bold; border-bottom: 1px solid #3d5166; }
.sidebar nav a { display: block; padding: 12px 20px; color: #bdc3c7; text-decoration: none; font-size: 14px; transition: background 0.2s; }
.sidebar nav a:hover, .sidebar nav a.active { background: #34495e; color: white; }
.sidebar .logout-btn { display: block; margin: 20px; padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; width: calc(100% - 40px); }
.main { flex: 1; padding: 28px; overflow-y: auto; }

/* Cards */
.stat-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.stat-card .label { font-size: 13px; color: #888; margin-bottom: 8px; }
.stat-card .value { font-size: 26px; font-weight: bold; color: #1e3a5f; }

/* Charts */
.charts { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 24px; }
.chart-box { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.chart-box h3 { font-size: 14px; color: #555; margin-bottom: 16px; }

/* Filters */
.filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.filters select, .filters input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.btn-primary { background: #1e3a5f; color: white; }
.btn-danger { background: #e74c3c; color: white; }
.btn-warning { background: #f39c12; color: white; }

/* Table */
.table-wrap { background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { background: #f8f9fa; padding: 12px 14px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #eee; }
td { padding: 11px 14px; border-bottom: 1px solid #f0f0f0; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafbfc; }

/* Modal */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: white; border-radius: 12px; padding: 28px; width: 440px; max-width: 95vw; }
.modal h2 { margin-bottom: 18px; font-size: 18px; color: #1e3a5f; }
.modal label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; margin-top: 12px; }
.modal input, .modal select { width: 100%; padding: 9px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }

/* Page sections */
.page { display: none; }
.page.active { display: block; }
h2.page-title { font-size: 20px; color: #1e3a5f; margin-bottom: 20px; }
```

- [ ] **Step 3: Create public/admin/index.html** (login page)

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EzReceipt Admin</title>
  <link rel="stylesheet" href="/admin/style.css">
</head>
<body>
  <div class="login-wrap">
    <div class="login-box">
      <h1>💼 EzReceipt Admin</h1>
      <p>เข้าสู่ระบบสำหรับผู้ดูแล</p>
      <input type="password" id="password" placeholder="รหัสผ่าน" onkeydown="if(event.key==='Enter')login()">
      <button onclick="login()">เข้าสู่ระบบ</button>
      <div class="error-msg" id="error">รหัสผ่านไม่ถูกต้อง</div>
    </div>
  </div>
  <script>
    async function login() {
      const password = document.getElementById('password').value;
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        document.getElementById('error').style.display = 'block';
      }
    }
  </script>
</body>
</html>
```

- [ ] **Step 4: Create public/admin/app.js**

```javascript
const CATEGORIES = ['อาหาร/เครื่องดื่ม','ค่าเดินทาง','สำนักงาน/อุปกรณ์','ค่าสาธารณูปโภค','ใบแจ้งหนี้/บิล','อื่นๆ'];

let barChart, pieChart;
let editingId = null;

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Unauthorized'); }
  return res;
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  if (name === 'dashboard') loadDashboard();
  if (name === 'receipts') loadReceipts();
  if (name === 'export') loadUsersDropdown('export-user');
}

async function loadDashboard() {
  const stats = await (await api('/stats')).json();
  const now = new Date();
  const thisMonth = stats.monthly.find(m => m.month === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  document.getElementById('stat-total').textContent = '฿' + Number(thisMonth?.total || 0).toLocaleString('th-TH');
  document.getElementById('stat-count').textContent = thisMonth?.count || 0;

  const users = await (await api('/users')).json();
  document.getElementById('stat-users').textContent = users.length;

  // Bar chart
  if (barChart) barChart.destroy();
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: stats.monthly.map(m => m.month),
      datasets: [{ label: 'ยอดรวม (฿)', data: stats.monthly.map(m => m.total), backgroundColor: '#1e3a5f' }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // Pie chart
  if (pieChart) pieChart.destroy();
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: stats.categories.map(c => c.category),
      datasets: [{ data: stats.categories.map(c => c.total), backgroundColor: ['#1e3a5f','#2980b9','#27ae60','#f39c12','#e74c3c','#9b59b6'] }]
    },
    options: { responsive: true }
  });
}

async function loadUsersDropdown(selectId) {
  const users = await (await api('/users')).json();
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">ทุกคน</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.line_user_id;
    opt.textContent = u.line_display_name || u.line_user_id;
    sel.appendChild(opt);
  });
}

async function loadReceipts() {
  await loadUsersDropdown('filter-user');
  await fetchReceipts();
}

async function fetchReceipts() {
  const month = document.getElementById('filter-month').value;
  const category = document.getElementById('filter-category').value;
  const userId = document.getElementById('filter-user').value;
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (category) params.set('category', category);
  if (userId) params.set('userId', userId);
  const receipts = await (await api('/receipts?' + params)).json();
  renderTable(receipts);
}

function renderTable(receipts) {
  const tbody = document.getElementById('receipts-tbody');
  if (!receipts.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px">ไม่พบข้อมูล</td></tr>'; return; }
  tbody.innerHTML = receipts.map(r => `
    <tr>
      <td>${r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-'}</td>
      <td>${r.store_name || '-'}</td>
      <td>${r.category || '-'}</td>
      <td>฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</td>
      <td>${r.line_display_name || '-'}</td>
      <td><span style="background:${r.status==='confirmed'?'#e8f5e9':'#fff3e0'};color:${r.status==='confirmed'?'#2e7d32':'#e65100'};padding:2px 8px;border-radius:4px;font-size:12px">${r.status}</span></td>
      <td>
        <button class="btn btn-warning" style="margin-right:4px;padding:5px 10px" onclick='openEdit(${JSON.stringify(r)})'>แก้ไข</button>
        <button class="btn btn-danger" style="padding:5px 10px" onclick="deleteReceipt('${r.id}')">ลบ</button>
      </td>
    </tr>
  `).join('');
}

function openEdit(r) {
  editingId = r.id;
  document.getElementById('edit-store').value = r.store_name || '';
  document.getElementById('edit-date').value = r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '';
  document.getElementById('edit-total').value = r.total_amount || '';
  const catSel = document.getElementById('edit-category');
  catSel.innerHTML = CATEGORIES.map(c => `<option value="${c}" ${c===r.category?'selected':''}>${c}</option>`).join('');
  document.getElementById('edit-modal').classList.add('open');
}

async function saveEdit() {
  await api(`/receipts/${editingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_name: document.getElementById('edit-store').value,
      date_on_receipt: document.getElementById('edit-date').value || null,
      category: document.getElementById('edit-category').value,
      total_amount: parseFloat(document.getElementById('edit-total').value) || null
    })
  });
  document.getElementById('edit-modal').classList.remove('open');
  fetchReceipts();
}

async function deleteReceipt(id) {
  if (!confirm('ลบใบเสร็จนี้?')) return;
  await api(`/receipts/${id}`, { method: 'DELETE' });
  fetchReceipts();
}

async function downloadCsv() {
  const from = document.getElementById('export-from').value;
  const to = document.getElementById('export-to').value;
  const userId = document.getElementById('export-user').value;
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (userId) params.set('userId', userId);
  const res = await api('/export/csv?' + params);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'receipts.csv'; a.click();
}

async function logout() {
  await fetch('/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login';
}
```

- [ ] **Step 5: Create public/admin/dashboard.html**

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EzReceipt Admin</title>
  <link rel="stylesheet" href="/admin/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
<div class="layout">
  <div class="sidebar">
    <div class="brand">💼 EzReceipt Admin</div>
    <nav>
      <a href="#" data-page="dashboard" onclick="showPage('dashboard')" class="active">📊 Dashboard</a>
      <a href="#" data-page="receipts" onclick="showPage('receipts')">🧾 ใบเสร็จทั้งหมด</a>
      <a href="#" data-page="export" onclick="showPage('export')">📥 Export</a>
    </nav>
    <button class="logout-btn" onclick="logout()">ออกจากระบบ</button>
  </div>

  <div class="main">
    <!-- Dashboard -->
    <div class="page active" id="page-dashboard">
      <h2 class="page-title">📊 Dashboard</h2>
      <div class="stat-cards">
        <div class="stat-card"><div class="label">ยอดรวมเดือนนี้</div><div class="value" id="stat-total">-</div></div>
        <div class="stat-card"><div class="label">ใบเสร็จเดือนนี้</div><div class="value" id="stat-count">-</div></div>
        <div class="stat-card"><div class="label">สมาชิกที่ส่ง</div><div class="value" id="stat-users">-</div></div>
      </div>
      <div class="charts">
        <div class="chart-box"><h3>ยอดรายเดือน (6 เดือนล่าสุด)</h3><canvas id="barChart"></canvas></div>
        <div class="chart-box"><h3>หมวดหมู่เดือนนี้</h3><canvas id="pieChart"></canvas></div>
      </div>
    </div>

    <!-- Receipts -->
    <div class="page" id="page-receipts">
      <h2 class="page-title">🧾 ใบเสร็จทั้งหมด</h2>
      <div class="filters">
        <input type="month" id="filter-month">
        <select id="filter-category">
          <option value="">ทุกหมวดหมู่</option>
          <option>อาหาร/เครื่องดื่ม</option><option>ค่าเดินทาง</option>
          <option>สำนักงาน/อุปกรณ์</option><option>ค่าสาธารณูปโภค</option>
          <option>ใบแจ้งหนี้/บิล</option><option>อื่นๆ</option>
        </select>
        <select id="filter-user"><option value="">ทุกคน</option></select>
        <button class="btn btn-primary" onclick="fetchReceipts()">ค้นหา</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>วันที่</th><th>ร้านค้า</th><th>หมวดหมู่</th><th>ยอด</th><th>ผู้ส่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody id="receipts-tbody"><tr><td colspan="7" style="text-align:center;padding:24px;color:#888">กำลังโหลด...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Export -->
    <div class="page" id="page-export">
      <h2 class="page-title">📥 Export CSV</h2>
      <div style="background:white;border-radius:10px;padding:28px;max-width:480px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
        <label style="display:block;font-size:13px;color:#666;margin-bottom:4px">จากเดือน</label>
        <input type="month" id="export-from" style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:14px">
        <label style="display:block;font-size:13px;color:#666;margin-bottom:4px">ถึงเดือน</label>
        <input type="month" id="export-to" style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:14px">
        <label style="display:block;font-size:13px;color:#666;margin-bottom:4px">ผู้ส่ง</label>
        <select id="export-user" style="width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;margin-bottom:20px"><option value="">ทุกคน</option></select>
        <button class="btn btn-primary" style="width:100%;padding:12px" onclick="downloadCsv()">⬇️ Download CSV</button>
      </div>
    </div>
  </div>
</div>

<!-- Edit Modal -->
<div class="modal-overlay" id="edit-modal">
  <div class="modal">
    <h2>แก้ไขใบเสร็จ</h2>
    <label>ร้านค้า</label><input type="text" id="edit-store">
    <label>วันที่</label><input type="date" id="edit-date">
    <label>หมวดหมู่</label><select id="edit-category"></select>
    <label>ยอดรวม (฿)</label><input type="number" id="edit-total" step="0.01">
    <div class="modal-actions">
      <button class="btn" onclick="document.getElementById('edit-modal').classList.remove('open')" style="background:#eee">ยกเลิก</button>
      <button class="btn btn-primary" onclick="saveEdit()">บันทึก</button>
    </div>
  </div>
</div>

<script src="/admin/app.js"></script>
<script>showPage('dashboard');</script>
</body>
</html>
```

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 7: Manual test Admin Panel**

```bash
# Add to .env (if not already):
# ADMIN_PASSWORD=admin123
# JWT_SECRET=phase2-jwt-secret-minimum-32-chars-long

node index.js
```

Open `http://localhost:3000/admin` — ควรเห็น login page → ใส่ password → redirect dashboard

- [ ] **Step 8: Commit**

```bash
git add public/admin/
git commit -m "feat: add admin panel HTML (login + dashboard with charts + receipt table)"
```

---

### Task 10: LIFF HTML frontend

**Files:**
- Create: `public/liff/index.html`
- Create: `public/liff/style.css`
- Create: `public/liff/app.js`

- [ ] **Step 1: Create public/liff/style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; color: #333; max-width: 480px; margin: 0 auto; }

.header { background: #1e3a5f; color: white; padding: 16px 20px; }
.header h1 { font-size: 17px; font-weight: bold; }
.header .user-name { font-size: 13px; color: #aaccff; margin-top: 2px; }

.filter-bar { padding: 12px 16px; background: white; display: flex; gap: 8px; border-bottom: 1px solid #eee; }
.filter-bar select { flex: 1; padding: 7px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }

.receipt-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; padding-bottom: 80px; }

.receipt-card { background: white; border-radius: 10px; padding: 14px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
.receipt-card .row { display: flex; justify-content: space-between; align-items: baseline; }
.receipt-card .store { font-weight: 600; font-size: 15px; }
.receipt-card .amount { font-weight: bold; color: #27ae60; font-size: 16px; }
.receipt-card .meta { font-size: 12px; color: #888; margin-top: 5px; }
.receipt-card .category-badge { font-size: 11px; background: #e8f0ff; color: #1e3a5f; padding: 2px 8px; border-radius: 10px; }

.footer-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: #1e3a5f; color: white; padding: 14px 20px; font-size: 15px; font-weight: bold; }

.empty { text-align: center; padding: 40px 20px; color: #888; }
.loading { text-align: center; padding: 40px 20px; color: #888; }
```

- [ ] **Step 2: Create public/liff/app.js**

```javascript
let userId = null;
let sessionToken = null;
let allReceipts = [];

async function init() {
  await liff.init({ liffId: window.LIFF_ID });
  if (!liff.isLoggedIn()) { liff.login(); return; }

  const accessToken = liff.getAccessToken();
  const res = await fetch('/api/liff/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken })
  });
  const data = await res.json();
  userId = data.userId;
  sessionToken = data.sessionToken;

  document.getElementById('user-name').textContent = data.displayName || '';
  populateMonthFilter();
  await loadReceipts();
}

function populateMonthFilter() {
  const sel = document.getElementById('filter-month');
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleString('th-TH', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

async function loadReceipts() {
  document.getElementById('receipt-list').innerHTML = '<div class="loading">กำลังโหลด...</div>';
  const month = document.getElementById('filter-month').value;
  const category = document.getElementById('filter-category').value;
  const params = new URLSearchParams({ userId });
  if (month) params.set('month', month);
  if (category) params.set('category', category);

  const res = await fetch('/api/receipts?' + params, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
  allReceipts = await res.json();
  renderReceipts();
}

function renderReceipts() {
  const list = document.getElementById('receipt-list');
  const total = allReceipts.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  document.getElementById('footer-total').textContent = '฿' + total.toLocaleString('th-TH');

  if (!allReceipts.length) {
    list.innerHTML = '<div class="empty">ไม่พบใบเสร็จในช่วงนี้</div>';
    return;
  }

  list.innerHTML = allReceipts.map(r => `
    <div class="receipt-card">
      <div class="row">
        <span class="store">${r.store_name || 'ไม่ระบุร้าน'}</span>
        <span class="amount">฿${Number(r.total_amount || 0).toLocaleString('th-TH')}</span>
      </div>
      <div class="meta">
        ${r.date_on_receipt ? String(r.date_on_receipt).slice(0,10) : '-'}
        &nbsp;·&nbsp;
        <span class="category-badge">${r.category || 'ไม่ระบุ'}</span>
      </div>
    </div>
  `).join('');
}

window.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 3: Create public/liff/index.html**

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสร็จของฉัน</title>
  <link rel="stylesheet" href="/liff/style.css">
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script src="/liff/config.js"></script>
</head>
<body>
  <div class="header">
    <h1>📄 ใบเสร็จของฉัน</h1>
    <div class="user-name" id="user-name"></div>
  </div>

  <div class="filter-bar">
    <select id="filter-month" onchange="loadReceipts()">
      <option value="">ทุกเดือน</option>
    </select>
    <select id="filter-category" onchange="loadReceipts()">
      <option value="">ทุกหมวดหมู่</option>
      <option>อาหาร/เครื่องดื่ม</option>
      <option>ค่าเดินทาง</option>
      <option>สำนักงาน/อุปกรณ์</option>
      <option>ค่าสาธารณูปโภค</option>
      <option>ใบแจ้งหนี้/บิล</option>
      <option>อื่นๆ</option>
    </select>
  </div>

  <div class="receipt-list" id="receipt-list">
    <div class="loading">กำลังโหลด...</div>
  </div>

  <div class="footer-bar">
    ยอดรวม: <span id="footer-total">฿0</span>
  </div>

  <script src="/liff/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all passed

- [ ] **Step 5: Commit**

```bash
git add public/liff/
git commit -m "feat: add LIFF receipt history HTML app"
```

---

### Task 11: Deploy Phase 2

- [ ] **Step 1: Update VPS .env**

SSH to VPS and add to `.env`:
```
ADMIN_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret_min_32_chars_random_string
LIFF_ID=your_liff_id_from_line_developers
```

- [ ] **Step 2: Pull and rebuild on VPS**

```bash
git pull && docker compose up -d --build
```

- [ ] **Step 3: Test Admin Panel**

Open `https://ezreceipt.sakww.com/admin` → login → dashboard

- [ ] **Step 4: Setup LIFF (Manual)**

LINE Developers Console → channel → LIFF → Add LIFF app:
- Endpoint URL: `https://ezreceipt.sakww.com/liff`
- Scope: `profile`
- Copy LIFF ID → update VPS `.env` → `docker compose up -d --build`

- [ ] **Step 5: Test LIFF**

เปิด LIFF URL ในแอป LINE → ควรเห็น receipt list ของตัวเอง

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: Phase 2 complete — LIFF dashboard + Admin panel"
git push
```
