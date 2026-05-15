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

  it('returns 401 with LIFF Bearer token', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/receipts/uuid-1')
      .set('Authorization', liffHeader());
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

describe('GET /api/users', () => {
  it('returns users for admin', async () => {
    db.getUsers.mockResolvedValue([{ line_user_id: 'U1', line_display_name: 'Alice' }]);
    const app = makeApp();
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 401 without admin auth', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/liff/verify', () => {
  afterEach(() => { delete global.fetch; });

  it('returns 400 when accessToken is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/liff/verify').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when LINE rejects the token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const app = makeApp();
    const res = await request(app)
      .post('/api/liff/verify')
      .send({ accessToken: 'bad-line-token' });
    expect(res.status).toBe(401);
  });

  it('returns sessionToken when LINE accepts the token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'Uabc', displayName: 'Alice' })
    });
    const app = makeApp();
    const res = await request(app)
      .post('/api/liff/verify')
      .send({ accessToken: 'valid-line-token' });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('Uabc');
    const decoded = jwt.verify(res.body.sessionToken, JWT_SECRET);
    expect(decoded.userId).toBe('Uabc');
  });
});

describe('GET /api/receipts/:id', () => {
  const receipt = { id: 'uuid-1', line_user_id: 'U123', status: 'pending', store_name: 'Test', total_amount: 100 };

  it('returns receipt for admin', async () => {
    db.getReceiptById.mockResolvedValue(receipt);
    const app = makeApp();
    const res = await request(app)
      .get('/api/receipts/uuid-1')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('uuid-1');
  });

  it('returns own receipt for LIFF user', async () => {
    db.getReceiptById.mockResolvedValue(receipt);
    const app = makeApp();
    const res = await request(app)
      .get('/api/receipts/uuid-1')
      .set('Authorization', liffHeader());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('uuid-1');
  });

  it('returns 403 when LIFF user requests another user receipt', async () => {
    db.getReceiptById.mockResolvedValue({ ...receipt, line_user_id: 'OTHER' });
    const app = makeApp();
    const res = await request(app)
      .get('/api/receipts/uuid-1')
      .set('Authorization', liffHeader());
    expect(res.status).toBe(403);
  });

  it('returns 404 when receipt not found', async () => {
    db.getReceiptById.mockRejectedValue(new Error('Receipt not found: uuid-1'));
    const app = makeApp();
    const res = await request(app)
      .get('/api/receipts/uuid-1')
      .set('Cookie', adminCookie());
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/receipts/uuid-1');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/receipts/:id (LIFF auth)', () => {
  const pendingReceipt = { id: 'uuid-1', line_user_id: 'U123', status: 'pending' };
  const confirmedReceipt = { id: 'uuid-1', line_user_id: 'U123', status: 'confirmed' };

  beforeEach(() => {
    db.updateReceipt.mockResolvedValue();
  });

  it('allows LIFF user to update own pending receipt', async () => {
    db.getReceiptById.mockResolvedValue(pendingReceipt);
    const app = makeApp();
    const res = await request(app)
      .put('/api/receipts/uuid-1')
      .set('Authorization', liffHeader())
      .send({ store_name: 'Edited', category: 'อื่นๆ', status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(db.updateReceipt).toHaveBeenCalledWith('uuid-1', expect.objectContaining({ store_name: 'Edited' }));
  });

  it('returns 403 when LIFF user tries to update confirmed receipt', async () => {
    db.getReceiptById.mockResolvedValue(confirmedReceipt);
    const app = makeApp();
    const res = await request(app)
      .put('/api/receipts/uuid-1')
      .set('Authorization', liffHeader())
      .send({ store_name: 'Edited' });
    expect(res.status).toBe(403);
    expect(db.updateReceipt).not.toHaveBeenCalled();
  });

  it('returns 403 when LIFF user tries to update another user receipt', async () => {
    db.getReceiptById.mockResolvedValue({ ...pendingReceipt, line_user_id: 'OTHER' });
    const app = makeApp();
    const res = await request(app)
      .put('/api/receipts/uuid-1')
      .set('Authorization', liffHeader())
      .send({ store_name: 'Edited' });
    expect(res.status).toBe(403);
  });

  it('admin can still update any receipt without ownership check', async () => {
    // Mock a confirmed receipt belonging to a different user — LIFF would reject this
    db.getReceiptById.mockResolvedValue({ id: 'uuid-1', line_user_id: 'OTHER_USER', status: 'confirmed' });
    const app = makeApp();
    const res = await request(app)
      .put('/api/receipts/uuid-1')
      .set('Cookie', adminCookie())
      .send({ store_name: 'Admin Edit' });
    expect(res.status).toBe(200);
    expect(db.updateReceipt).toHaveBeenCalledWith('uuid-1', expect.objectContaining({ store_name: 'Admin Edit' }));
  });
});
