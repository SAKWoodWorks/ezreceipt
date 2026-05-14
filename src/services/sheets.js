const { google } = require('googleapis');
const { GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON } = require('../config');

function getSheetClient() {
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

async function appendReceiptRow(receipt) {
  const sheets = getSheetClient();
  const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  const row = [
    now,                                         // A: วันที่บันทึก
    receipt.date_on_receipt || '',               // B: วันที่ในใบเสร็จ
    receipt.store_name || '',                    // C: ร้านค้า
    receipt.category || '',                      // D: หมวดหมู่
    JSON.stringify(receipt.items || []),         // E: รายการ
    receipt.total_amount || '',                  // F: ยอดรวม
    receipt.line_display_name || '',             // G: ผู้ส่ง
    receipt.line_user_id                         // H: LINE User ID
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Sheet1!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });

  return response.data.updates?.updatedRange || null;
}

module.exports = { appendReceiptRow };
