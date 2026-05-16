const REQUIRED = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'DATABASE_URL',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'ADMIN_PASSWORD',
  'JWT_SECRET'
];

for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || '';
if (!OLLAMA_BASE_URL && !process.env.GOOGLE_AI_API_KEY) {
  throw new Error('Missing env var: set either OLLAMA_BASE_URL or GOOGLE_AI_API_KEY');
}

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
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || ''
};
