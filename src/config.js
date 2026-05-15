// src/config.js
const REQUIRED = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'OPENROUTER_API_KEY',
  'DATABASE_URL',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON'
];

for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

module.exports = {
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  PORT: process.env.PORT || 3000
};
