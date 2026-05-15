const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const { ADMIN_PASSWORD, JWT_SECRET } = require('../config');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const token = req.cookies?.admin_token;
    if (token) { jwt.verify(token, JWT_SECRET); return res.redirect('/admin/dashboard'); }
  } catch {}
  res.redirect('/admin/login');
});

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

router.post('/login', express.json(), (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 3600 * 1000 });
  res.json({ ok: true });
});

router.get('/dashboard', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/dashboard.html'));
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

module.exports = router;
