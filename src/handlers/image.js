// src/handlers/image.js
const { downloadImageBuffer, replyMessage, pushMessage, buildOcrResultMessage, getUserDisplayName } = require('../services/line');
const { extractReceiptData } = require('../services/ocr');
const { insertReceipt } = require('../services/db');

async function handleImageMessage(event) {
  const { replyToken, source, message } = event;
  const userId = source.userId;
  const groupId = source.groupId || null;

  // Reply immediately so LINE token doesn't expire during OCR
  await replyMessage(replyToken, {
    type: 'text',
    text: '📄 กำลังอ่านใบเสร็จ... กรุณารอสักครู่'
  });

  try {
    const imageBuffer = await downloadImageBuffer(message.id);
    const ocrData = await extractReceiptData(imageBuffer);

    const displayName = await getUserDisplayName(userId, groupId);

    const receiptId = await insertReceipt({
      line_user_id: userId,
      line_display_name: displayName,
      group_id: groupId,
      date_on_receipt: ocrData.date_on_receipt,
      store_name: ocrData.store_name,
      items: ocrData.items,
      total_amount: ocrData.total_amount,
      status: 'pending'
    });

    const resultMessage = buildOcrResultMessage(receiptId, ocrData);
    await pushMessage(userId, resultMessage);
  } catch (err) {
    console.error('handleImageMessage error:', err);
    await pushMessage(userId, {
      type: 'text',
      text: '❌ อ่านใบเสร็จไม่สำเร็จ กรุณาลองใหม่หรือส่งรูปที่ชัดขึ้น'
    });
  }
}

module.exports = { handleImageMessage };
