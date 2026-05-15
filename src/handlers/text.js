const { replyMessage, buildMonthlySummaryMessage } = require('../services/line');
const { getUserMonthlyStats } = require('../services/db');

async function handleTextMessage(event) {
  const { replyToken, source, message } = event;
  const userId = source.userId;
  const text = message.text?.trim();

  if (text === 'เดือนนี้') {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const stats = await getUserMonthlyStats(userId, month);
      const flex = buildMonthlySummaryMessage(stats, month);
      return await replyMessage(replyToken, flex);
    } catch (err) {
      console.error('handleTextMessage เดือนนี้ error:', err);
      return replyMessage(replyToken, {
        type: 'text',
        text: '❌ ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  }

  if (text === 'ส่งใบเสร็จ') {
    return replyMessage(replyToken, {
      type: 'text',
      text: '📷 ส่งรูปใบเสร็จมาในแชทนี้ บอทจะอ่านและบันทึกให้อัตโนมัติ'
    });
  }

  // Other text messages are intentionally ignored
}

module.exports = { handleTextMessage };
