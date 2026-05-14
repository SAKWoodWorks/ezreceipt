// src/services/supabase.js
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('../config');

let supabase;

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

async function insertReceipt(data) {
  const client = getSupabaseClient();
  const { data: row, error } = await client
    .from('receipts')
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return row.id;
}

async function updateReceipt(id, data) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('receipts')
    .update(data)
    .eq('id', id);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function getReceiptById(id) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  return data;
}

module.exports = { insertReceipt, updateReceipt, getReceiptById };
