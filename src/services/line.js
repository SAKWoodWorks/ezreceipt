// src/services/line.js
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET } = require('../config');

const client = new line.Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
});

const CATEGORIES = [
  'อาหาร/เครื่องดื่ม',
  'ค่าเดินทาง',
  'สำนักงาน/อุปกรณ์',
  'ค่าสาธารณูปโภค',
  'ใบแจ้งหนี้/บิล',
  'อื่นๆ'
];

function buildRow(label, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: label, color: '#888888', size: 'sm', flex: 3 },
      { type: 'text', text: String(value || '-'), flex: 5, wrap: true }
    ]
  };
}

function buildOcrResultMessage(receiptId, ocrData) {
  const total = ocrData.total_amount
    ? `฿${Number(ocrData.total_amount).toLocaleString('th-TH')}`
    : 'ไม่พบข้อมูล';

  return {
    type: 'flex',
    altText: `อ่านใบเสร็จสำเร็จ - กรุณาเลือกหมวดหมู่`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E3A5F',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '📄 อ่านใบเสร็จสำเร็จ', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'กดเลือกหมวดหมู่เพื่อบันทึก', color: '#aaccff', size: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        contents: [
          buildRow('ร้านค้า', ocrData.store_name || 'ไม่พบข้อมูล'),
          buildRow('วันที่', ocrData.date_on_receipt || 'ไม่พบข้อมูล'),
          buildRow('ยอดรวม', total),
          buildRow('AI แนะนำ', ocrData.category_suggestion || 'อื่นๆ')
        ]
      }
    },
    quickReply: {
      items: CATEGORIES.map(cat => ({
        type: 'action',
        action: {
          type: 'postback',
          label: cat,
          data: `action=confirm&id=${receiptId}&category=${encodeURIComponent(cat)}`,
          displayText: cat
        }
      }))
    }
  };
}

function buildSuccessMessage(receipt) {
  const total = receipt.total_amount
    ? `฿${Number(receipt.total_amount).toLocaleString('th-TH')}`
    : '-';

  return {
    type: 'flex',
    altText: `จดสำเร็จ ✅ ${receipt.store_name || ''} ${total}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#27AE60',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: '✅ จดสำเร็จ', color: '#ffffff', weight: 'bold', size: 'xl' },
          { type: 'text', text: 'บันทึกใน Google Sheet แล้ว', color: '#ccffcc', size: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        contents: [
          buildRow('ร้านค้า', receipt.store_name),
          buildRow('วันที่', receipt.date_on_receipt),
          buildRow('หมวดหมู่', receipt.category),
          buildRow('ยอดรวม', total),
          buildRow('บันทึกโดย', receipt.line_display_name)
        ]
      }
    }
  };
}

async function downloadImageBuffer(messageId) {
  const stream = await client.getMessageContent(messageId);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function replyMessage(replyToken, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  return client.replyMessage(replyToken, msgs);
}

async function pushMessage(userId, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  return client.pushMessage(userId, msgs);
}

module.exports = {
  buildOcrResultMessage,
  buildSuccessMessage,
  downloadImageBuffer,
  replyMessage,
  pushMessage,
  CATEGORIES
};
