const { replyMessage, buildSuccessMessage } = require('../services/line');
const { updateReceipt, getReceiptById } = require('../services/db');
const { appendReceiptRow } = require('../services/sheets');

async function handlePostback(event) {
  const { replyToken, postback } = event;
  const params = new URLSearchParams(postback.data);
  const action = params.get('action');

  if (action !== 'confirm') return;

  const receiptId = params.get('id');
  const category = params.get('category');

  try {
    await updateReceipt(receiptId, { category, status: 'confirmed' });

    const receipt = await getReceiptById(receiptId);
    await appendReceiptRow(receipt);

    const successMessage = buildSuccessMessage(receipt);
    await replyMessage(replyToken, successMessage);
  } catch (err) {
    console.error('handlePostback error:', err);
    await replyMessage(replyToken, {
      type: 'text',
      text: '❌ บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    });
  }
}

module.exports = { handlePostback };
