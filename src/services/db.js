// src/services/db.js
const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');

const pool = new Pool({ connectionString: DATABASE_URL });

async function insertReceipt(data) {
  const { rows } = await pool.query(
    `INSERT INTO receipts (line_user_id, group_id, date_on_receipt, store_name, items, total_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      data.line_user_id,
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
  const keys = Object.keys(data);
  const values = Object.values(data);
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

module.exports = { insertReceipt, updateReceipt, getReceiptById };
