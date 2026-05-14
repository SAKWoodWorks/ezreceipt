// index.js
require('dotenv').config();
const express = require('express');
const webhookRouter = require('./src/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/webhook', webhookRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
