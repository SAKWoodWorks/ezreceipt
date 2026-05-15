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
