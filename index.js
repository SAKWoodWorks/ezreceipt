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
