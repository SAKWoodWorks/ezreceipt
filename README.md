# EzReceipt — LINE Bot บันทึกใบเสร็จ

ส่งรูปใบเสร็จเข้า LINE Group → AI อ่านข้อมูล → ยืนยันหมวดหมู่ → บันทึกลง Google Sheet + PostgreSQL

## Stack

- **Node.js 20** + Express
- **LINE Messaging API** — webhook, Flex Message, Quick Reply
- **OpenRouter** (google/gemini-2.0-flash-exp) — OCR ใบเสร็จภาษาไทย
- **PostgreSQL 16** — เก็บข้อมูลใบเสร็จ
- **Google Sheets API** — export ข้อมูลรายวัน
- **Docker** — deploy บน VPS

## การทำงาน

1. ส่งรูปใบเสร็จเข้า LINE Group
2. Bot ตอบ "กำลังอ่านใบเสร็จ..." ทันที
3. AI อ่านข้อมูล: ร้านค้า, วันที่, รายการ, ยอดรวม, หมวดหมู่
4. Bot ส่ง Flex Message พร้อม Quick Reply ให้เลือกหมวดหมู่ 6 ประเภท
5. กด confirm → บันทึกลง DB + Google Sheet

## Setup

### 1. Clone & ติดตั้ง

```bash
git clone https://github.com/SAKWoodWorks/ezreceipt.git
cd ezreceipt
npm install
```

### 2. สร้าง .env

```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```env
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
OPENROUTER_API_KEY=...
DATABASE_URL=postgresql://receiptbot:PASSWORD@postgres:5432/receiptbot
POSTGRES_PASSWORD=PASSWORD
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
PORT=3000
```

### 3. Google Sheet

1. สร้าง Sheet ใหม่ ตั้งชื่อ tab ว่า `Sheet1`
2. Row 1: `วันที่บันทึก | วันที่ในใบเสร็จ | ร้านค้า | หมวดหมู่ | รายการ | ยอดรวม | ผู้ส่ง | LINE User ID`
3. Share กับ `client_email` จาก service account JSON เป็น Editor

### 4. รัน Tests

```bash
npm test
```

### 5. Deploy (Docker)

```bash
# บน VPS
docker compose up -d --build

# รัน migration (ครั้งแรกเท่านั้น)
docker compose exec postgres psql -U receiptbot -d receiptbot \
  -f /dev/stdin < migrations/001_create_receipts.sql

# ดู logs
docker compose logs -f receipt-bot
```

### 6. ตั้ง LINE Webhook URL

LINE Developers Console → Messaging API → Webhook URL:
```
https://your-domain.com/webhook
```

เปิด "Use webhook" และกด Verify

## Project Structure

```
src/
  config.js          — env vars validation
  webhook.js         — LINE webhook router
  handlers/
    image.js         — รับรูปใบเสร็จ → OCR → บันทึก DB
    postback.js      — รับ confirm → บันทึก DB + Sheet
  services/
    line.js          — LINE API client, Flex Message builder
    ocr.js           — OpenRouter vision OCR
    db.js            — PostgreSQL queries
    sheets.js        — Google Sheets append
migrations/
  001_create_receipts.sql
```

## Environment Variables

| ตัวแปร | คำอธิบาย |
|--------|----------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console |
| `LINE_CHANNEL_SECRET` | LINE Developers Console |
| `OPENROUTER_API_KEY` | openrouter.ai/keys |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | รหัสผ่าน PostgreSQL |
| `GOOGLE_SHEET_ID` | ID จาก URL ของ Google Sheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account key JSON (single line) |
