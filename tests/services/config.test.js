// tests/services/config.test.js
describe('config', () => {
  const REQUIRED = [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'OPENAI_API_KEY',
    'DATABASE_URL',
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
    expect(config.DATABASE_URL).toBe('test_DATABASE_URL');
  });

  it('throws if required env var is missing', () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    jest.resetModules();
    expect(() => require('../../src/config')).toThrow('Missing env var: LINE_CHANNEL_ACCESS_TOKEN');
  });
});
