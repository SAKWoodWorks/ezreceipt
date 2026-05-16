// src/services/db.js
const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');

const pool = new Pool({ connectionString: DATABASE_URL });

async function insertReceipt(data) {
  const { rows } = await pool.query(
    `INSERT INTO receipts (line_user_id, line_display_name, group_id, date_on_receipt, store_name, items, total_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      data.line_user_id,
      data.line_display_name || null,
      data.group_id || null,
      data.date_on_receipt || null,
      data.store_name || null,
      JSON.stringify(data.items || []),
      data.total_amount || null,
      data.status || 'pending'
    ]
  );
  return rows[0].id;
}

async function updateReceipt(id, data) {
  const filtered = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const keys = Object.keys(filtered);
  const values = Object.values(filtered);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await pool.query(
    `UPDATE receipts SET ${setClause} WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

async function getReceiptById(id) {
  const { rows } = await pool.query('SELECT * FROM receipts WHERE id = $1', [id]);
  if (!rows[0]) throw new Error(`Receipt not found: ${id}`);
  return rows[0];
}

async function getReceipts({ userId = null, month = null, category = null, from = null, to = null, status = null } = {}) {
  const { rows } = await pool.query(
    `SELECT id, line_user_id, line_display_name, date_on_receipt,
            store_name, category, items, total_amount, status, created_at, image_key
     FROM receipts
     WHERE ($1::text IS NULL OR line_user_id = $1)
       AND ($2::text IS NULL OR to_char(date_on_receipt, 'YYYY-MM') = $2)
       AND ($3::text IS NULL OR category = $3)
       AND ($4::text IS NULL OR to_char(date_on_receipt, 'YYYY-MM') >= $4)
       AND ($5::text IS NULL OR to_char(date_on_receipt, 'YYYY-MM') <= $5)
       AND ($6::text IS NULL OR status = $6)
     ORDER BY date_on_receipt DESC NULLS LAST, created_at DESC`,
    [userId, month, category, from, to, status]
  );
  return rows;
}

async function deleteReceipt(id) {
  const { rowCount } = await pool.query('DELETE FROM receipts WHERE id = $1', [id]);
  if (rowCount === 0) throw new Error(`Receipt not found: ${id}`);
}

async function getStats(months = 6) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const startDate = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const monthlyResult = await pool.query(
    `SELECT to_char(date_trunc('month', date_on_receipt), 'YYYY-MM') as month,
            SUM(total_amount)::float as total, COUNT(*)::int as count
     FROM receipts
     WHERE status = 'confirmed' AND date_on_receipt >= $1::date
     GROUP BY 1 ORDER BY 1`,
    [startDate]
  );

  const categoryResult = await pool.query(
    `SELECT category, SUM(total_amount)::float as total, COUNT(*)::int as count
     FROM receipts
     WHERE status = 'confirmed'
       AND to_char(date_on_receipt, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
     GROUP BY category ORDER BY total DESC`
  );

  return { monthly: monthlyResult.rows, categories: categoryResult.rows };
}

async function getUsers() {
  const { rows } = await pool.query(
    `SELECT DISTINCT line_user_id, line_display_name
     FROM receipts
     WHERE line_display_name IS NOT NULL
     ORDER BY line_display_name`
  );
  return rows;
}

async function getUserMonthlyStats(userId, month) {
  const { rows } = await pool.query(
    `SELECT category,
            SUM(total_amount)::float AS total,
            COUNT(*)::int AS count
     FROM receipts
     WHERE line_user_id = $1
       AND to_char(date_on_receipt, 'YYYY-MM') = $2
       AND status = 'confirmed'
     GROUP BY category
     ORDER BY total DESC`,
    [userId, month]
  );
  const total = rows.reduce((sum, r) => sum + (r.total || 0), 0);
  return { categories: rows, total };
}

module.exports = { insertReceipt, updateReceipt, getReceiptById, getReceipts, deleteReceipt, getStats, getUsers, getUserMonthlyStats };
