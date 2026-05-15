# Receipt LINE Bot — Core MVP Design

**Date:** 2026-05-14  
**Status:** Approved  
**Phase:** 1 of 2 (Core MVP)

---

## Overview

LINE Bot สำหรับทีม/กลุ่ม LINE ส่งรูปใบเสร็จ → GPT-4o Vision อ่านข้อมูลอัตโนมัติ → user confirm/แก้ไขหมวดหมู่ → บันทึกลง Google Sheet และ Supabase

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (Express.js) |
| Host | Digital Ocean VPS |
| LINE | LINE Messaging API (Webhook) |
| AI/OCR | OpenAI GPT-4o Vision |
| Database | Supabase (PostgreSQL) |
| Sheet | Google Sheets API v4 |

---

## Data Flow

```
User ส่งรูปใบเสร็จใน LINE group/1-on-1
  → LINE Webhook POST /webhook
  → ดาวน์โหลดรูปจาก LINE CDN (Bearer token)
  → ส่ง base64 image ไป GPT-4o Vision
  → parse JSON fields จาก response
  → INSERT row ใน Supabase receipts (status='pending')
  → reply Flex Message + Quick Reply (category confirm)

User กด category quick reply
  → LINE Webhook POST /webhook (postback/message event)
  → UPDATE receipts SET category=?, status='confirmed'
  → เขียนแถวใหม่ใน Google Sheet
  → push message: Summary card "จดสำเร็จ ✅"
```

---

## Project Structure

```
src/
  webhook.js          # Express route POST /webhook, LINE signature verify
  handlers/
    image.js          # handle imageMessage event
    postback.js       # handle postback/quickReply confirm event
  services/
    ocr.js            # GPT-4o Vision prompt + JSON parse
    sheets.js         # Google Sheets API write
    line.js           # LINE reply/push helpers, Flex Message builders
    supabase.js       # Supabase client + receipt CRUD
  config.js           # env vars validation
index.js              # Express app setup
```

---

## Supabase Schema

```sql
create table receipts (
  id uuid default gen_random_uuid() primary key,
  line_user_id text not null,
  line_display_name text,
  group_id text,
  date_on_receipt date,
  store_name text,
  category text,
  items jsonb,           -- [{ name: string, amount: number }]
  total_amount numeric,
  status text default 'pending', -- 'pending' | 'confirmed' | 'cancelled'
  sheet_row_id text,
  image_url text,
  created_at timestamptz default now()
);

-- RLS: service role only (bot uses service key)
alter table receipts enable row level security;
```

---

## Google Sheet Columns

| Col | Field | Example |
|-----|-------|---------|
| A | วันที่บันทึก | 2026-05-14 10:03 |
| B | วันที่ในใบเสร็จ | 2026-05-03 |
| C | ร้านค้า | การไฟฟ้าส่วนภูมิภาค |
| D | หมวดหมู่ | ค่าสาธารณูปโภค |
| E | รายการ (JSON) | [{"name":"ค่าไฟ","amount":572.59}] |
| F | ยอดรวม | 572.59 |
| G | ผู้ส่ง | Pupa |
| H | LINE User ID | Uxxxxxxxx |

---

## GPT-4o OCR Prompt

```
You are a Thai receipt OCR assistant. Extract the following fields from this receipt image and return valid JSON only:

{
  "date_on_receipt": "YYYY-MM-DD or null",
  "store_name": "string or null",
  "category_suggestion": "one of: อาหาร/เครื่องดื่ม | ค่าเดินทาง | สำนักงาน/อุปกรณ์ | ค่าสาธารณูปโภค | ใบแจ้งหนี้/บิล | อื่นๆ",
  "items": [{ "name": "string", "amount": number }],
  "total_amount": number or null
}

Return ONLY the JSON object. No explanation.
```

---

## LINE Messages

### Reply after OCR (Flex Message + Quick Reply)

- Header: "อ่านใบเสร็จสำเร็จ"
- Body: แสดง store_name, date, total_amount, items (ถ้ามี), category_suggestion
- Quick Reply buttons: หมวดหมู่ 6 ตัว (highlight ตัวที่ AI แนะนำ)
- Footer: "กดเลือกหมวดหมู่เพื่อบันทึก"

### Push after confirm (Flex Message)

- Header: "จดสำเร็จ ✅"
- Body: ข้อมูลครบ + ชื่อผู้ส่ง + หมวดหมู่ที่เลือก
- Footer: "บันทึกใน Google Sheet แล้ว"

---

## Categories

- อาหาร/เครื่องดื่ม
- ค่าเดินทาง
- สำนักงาน/อุปกรณ์
- ค่าสาธารณูปโภค
- ใบแจ้งหนี้/บิล
- อื่นๆ

---

## Error Handling

| Case | Bot reply |
|------|-----------|
| OCR ล้มเหลว / parse JSON ไม่ได้ | "อ่านใบเสร็จไม่สำเร็จ กรุณาลองใหม่หรือส่งรูปที่ชัดขึ้น" |
| LINE CDN download fail | log error, reply generic error |
| Google Sheet write fail | บันทึก Supabase ไว้ก่อน, retry 3 ครั้ง |
| pending หมดอายุ (>1 ชม.) | auto-cancel, ไม่ต้อง reply |

---

## Environment Variables

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=  # stringified JSON
PORT=3000
```

---

## Out of Scope (Phase 2)

- LIFF mobile web app (dashboard, รายการจ่าย)
- Web admin dashboard
- Export (Excel/CSV/VAT report)
- Budget tracking
- Role management
- Income tracking (รายการรับ)
