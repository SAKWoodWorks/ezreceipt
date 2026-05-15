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
