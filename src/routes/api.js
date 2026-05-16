const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const db = require('../services/db');
const { generateCsv } = require('../services/export');
const { getImageUrl } = require('../services/storage');
const adminAuth = require('../middleware/adminAuth');
const { pushMessage, buildSuccessMessage } = require('../services/line');

const router = express.Router();
router.use(express.json());

function receiptAuth(req, res, next) {
  const adminToken = req.cookies?.admin_token;
  if (adminToken) {
    try {
      const payload = jwt.verify(adminToken, JWT_SECRET);
      if (payload.role === 'admin') { req.isAdmin = true; return next(); }
    } catch {}
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      if (payload.userId) { req.liffUserId = payload.userId; return next(); }
    } catch {}
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function addImageUrls(receipts) {
  return receipts.map(r => ({
    ...r,
    image_url: r.image_key ? getImageUrl(r.image_key) : null
  }));
}

router.get('/receipts', receiptAuth, async (req, res) => {
  try {
    let { userId, month, category } = req.query;
    const opts = { month: month || null, category: category || null };
    if (req.liffUserId) {
      opts.userId = req.liffUserId;
      opts.status = 'confirmed';
    } else {
      opts.userId = userId || null;
    }
    const receipts = await db.getReceipts(opts);
    res.json(addImageUrls(receipts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/receipts/:id', receiptAuth, async (req, res) => {
  try {
    const receipt = await db.getReceiptById(req.params.id);
    if (req.liffUserId && receipt.line_user_id !== req.liffUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [withUrl] = addImageUrls([receipt]);
    res.json(withUrl);
  } catch (err) {
    if (err.message.includes('Receipt not found')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.put('/receipts/:id', receiptAuth, async (req, res) => {
  try {
    if (req.liffUserId) {
      const receipt = await db.getReceiptById(req.params.id);
      if (receipt.line_user_id !== req.liffUserId) return res.status(403).json({ error: 'Forbidden' });
      if (receipt.status !== 'pending') return res.status(403).json({ error: 'Receipt already confirmed' });
    }
    const { store_name, date_on_receipt, category, total_amount, status } = req.body;
    const resolvedStatus = req.liffUserId ? 'confirmed' : status;
    await db.updateReceipt(req.params.id, { store_name, date_on_receipt, category, total_amount, status: resolvedStatus });
    if (req.liffUserId) {
      const updated = await db.getReceiptById(req.params.id);
      pushMessage(req.liffUserId, buildSuccessMessage(updated)).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.message.includes('Receipt not found')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/receipts/:id', adminAuth, async (req, res) => {
  try {
    await db.deleteReceipt(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', adminAuth, async (req, res) => {
  try {
    res.json(await db.getStats(parseInt(req.query.months) || 6));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    res.json(await db.getUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/csv', adminAuth, async (req, res) => {
  try {
    const { from, to, userId } = req.query;
    const receipts = await db.getReceipts({ from: from || null, to: to || null, userId: userId || null });
    const csv = generateCsv(receipts);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="receipts.csv"');
    res.send('﻿' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/liff/verify', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
    const lineRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!lineRes.ok) return res.status(401).json({ error: 'Invalid LINE access token' });
    const profile = await lineRes.json();
    const sessionToken = jwt.sign({ userId: profile.userId }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ userId: profile.userId, displayName: profile.displayName, sessionToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
