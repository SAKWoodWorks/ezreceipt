// src/services/line.js
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, LIFF_ID } = require('../config');

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

const THAI_MONTHS = {
  '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
  '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
  '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.'
};

function thaiMonthLabel(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '';
  const [year, mm] = month.split('-');
  return `${THAI_MONTHS[mm] || mm} ${Number(year) + 543}`;
}

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
          ...(ocrData.items && ocrData.items.length > 0 ? [
            { type: 'separator', margin: 'sm' },
            ...ocrData.items.map(item => buildRow(item.name, `฿${Number(item.amount).toLocaleString('th-TH')}`)),
            { type: 'separator', margin: 'sm' }
          ] : []),
          buildRow('ยอดรวม', total),
          buildRow('AI แนะนำ', ocrData.category_suggestion || 'อื่นๆ')
        ]
      }
    },
    quickReply: {
      items: [
        ...CATEGORIES.map(cat => ({
          type: 'action',
          action: {
            type: 'postback',
            label: cat,
            data: `action=confirm&id=${receiptId}&category=${encodeURIComponent(cat)}`,
            displayText: cat
          }
        })),
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '✏️ แก้ไขข้อมูล',
            uri: LIFF_ID
              ? `https://liff.line.me/${LIFF_ID}?receipt_id=${receiptId}&mode=edit`
              : `#edit-${receiptId}`
          }
        }
      ]
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
          buildRow('ร้านค้า', receipt.store_name || '-'),
          buildRow('วันที่', receipt.date_on_receipt || '-'),
          buildRow('หมวดหมู่', receipt.category || '-'),
          buildRow('ยอดรวม', total),
          buildRow('บันทึกโดย', receipt.line_display_name || '-')
        ]
      }
    }
  };
}

function buildMonthlySummaryMessage(stats, month) {
  const { categories, total } = stats;
  const label = thaiMonthLabel(month);

  const bodyContents = categories.length === 0
    ? [{ type: 'text', text: 'ยังไม่มีค่าใช้จ่ายเดือนนี้', color: '#888888', size: 'sm', align: 'center' }]
    : [
        buildRow('ยอดรวมทั้งหมด', `฿${Number(total).toLocaleString('th-TH')}`),
        { type: 'separator', margin: 'sm' },
        ...categories.map(cat =>
          buildRow(cat.category || 'อื่นๆ', `฿${Number(cat.total).toLocaleString('th-TH')} (${cat.count} ใบ)`)
        )
      ];

  const footerContents = LIFF_ID ? [{
    type: 'button',
    action: { type: 'uri', label: 'ดูทั้งหมด', uri: `https://liff.line.me/${LIFF_ID}` },
    style: 'primary',
    color: '#1E3A5F'
  }] : [];

  return {
    type: 'flex',
    altText: `สรุปค่าใช้จ่าย ${label}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E3A5F',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: `📊 สรุป ${label}`, color: '#ffffff', weight: 'bold', size: 'lg' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'none',
        contents: bodyContents
      },
      footer: footerContents.length > 0 ? {
        type: 'box',
        layout: 'vertical',
        contents: footerContents
      } : undefined
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

async function getUserDisplayName(userId, groupId = null) {
  try {
    if (groupId) {
      const profile = await client.getGroupMemberProfile(groupId, userId);
      return profile.displayName;
    }
    const profile = await client.getProfile(userId);
    return profile.displayName;
  } catch {
    return null;
  }
}

module.exports = {
  buildOcrResultMessage,
  buildSuccessMessage,
  buildMonthlySummaryMessage,
  downloadImageBuffer,
  replyMessage,
  pushMessage,
  getUserDisplayName,
  CATEGORIES
};
