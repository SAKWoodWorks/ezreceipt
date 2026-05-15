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
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when cookies object is absent', () => {
    const req = {};
    const res = makeRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with expired token', () => {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '-1s' });
    const req = { cookies: { admin_token: token } };
    const res = makeRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 with non-admin role', () => {
    const token = jwt.sign({ role: 'user' }, JWT_SECRET);
    const req = { cookies: { admin_token: token } };
    const res = makeRes();
    const next = jest.fn();
    adminAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
