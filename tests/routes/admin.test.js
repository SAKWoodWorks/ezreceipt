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
