# Phase 2: LIFF Dashboard + Admin Panel Design

**Date:** 2026-05-15
**Status:** Approved
**Phase:** 2 of 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

---

## Goal

เพิ่ม LIFF web app (เปิดในแอป LINE) สำหรับสมาชิกดู receipt ของตัวเอง และ Admin Panel สำหรับผู้จัดการดู/แก้ไข/export receipt ทั้งหมด บน Express server เดิม

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (ไม่มี build step) |
| Charts | Chart.js CDN |
| LIFF Auth | LINE LIFF SDK v2 |
| Admin Auth | JWT (jsonwebtoken) + httpOnly cookie |
| Backend | Express.js (เดิม) |
| Export | csv-stringify |

---

## Architecture

เพิ่มใน Express server เดิม ไม่สร้าง service ใหม่

```
src/
  routes/
    liff.js          — serve LIFF HTML + verify LIFF token endpoint
    admin.js         — serve Admin HTML + login endpoint + auth middleware
    api.js           — REST endpoints (receipts, stats, export)
  services/
    export.js        — CSV generation
  middleware/
    adminAuth.js     — JWT cookie verification middleware
public/
  liff/
    index.html       — LIFF single page app
    app.js           — LIFF JS logic
    style.css
  admin/
    index.html       — Admin login page
    dashboard.html   — Admin dashboard (protected)
    app.js           — Admin JS logic
    style.css
```

---

## New Environment Variables

```env
ADMIN_PASSWORD=your_strong_admin_password
JWT_SECRET=your_jwt_secret_32chars_min
LIFF_ID=your_liff_id_from_line_developers
```

---

## LIFF Dashboard

### Flow
1. User เปิด LIFF URL ในแอป LINE
2. LIFF SDK init → `liff.login()` ถ้ายังไม่ได้ login
3. `liff.getAccessToken()` → ส่งไป `POST /api/liff/verify` → server verify กับ LINE API → return userId
4. Fetch `GET /api/receipts?userId=...&month=...&category=...`
5. แสดง receipt list

### UI Layout (Layout A)
- **Header:** "ใบเสร็จของฉัน" + ชื่อ user
- **Filter bar:** dropdown เดือน (ย้อนหลัง 6 เดือน) + dropdown หมวดหมู่
- **Receipt list:** card แต่ละใบ — ร้านค้า | วันที่ | หมวดหมู่ | ยอด (แสดงเฉพาะ status='confirmed')
- **Footer sticky:** "ยอดรวมเดือนนี้: ฿X,XXX"

### API สำหรับ LIFF
```
POST /api/liff/verify    body: { accessToken } → { userId, displayName }
GET  /api/receipts       query: userId, month (YYYY-MM), category → receipts[]
```

---

## Admin Panel

### Auth Flow
1. เปิด `/admin` → redirect ไป `/admin/login` ถ้าไม่มี JWT cookie
2. POST `/admin/login` body: `{ password }` → เทียบกับ `ADMIN_PASSWORD` env
3. ถ้าตรง → set httpOnly JWT cookie (expire 8h) → redirect `/admin/dashboard`
4. ทุก request ไป `/admin/dashboard` และ `/api/*` (mutating) ตรวจ cookie ผ่าน `adminAuth` middleware

### UI Layout (Layout A — Sidebar)
**Sidebar navigation:**
- 📊 Dashboard
- 🧾 ใบเสร็จทั้งหมด
- 📥 Export
- Logout

**Dashboard page:**
- 3 stat cards: ยอดรวมเดือนนี้ | จำนวนใบเสร็จเดือนนี้ | จำนวนสมาชิกที่ส่ง
- Bar chart: ยอดรวมรายเดือน (6 เดือนล่าสุด) — Chart.js
- Pie chart: breakdown ตามหมวดหมู่เดือนนี้ — Chart.js

**ใบเสร็จทั้งหมด page:**
- Filter bar: เดือน + หมวดหมู่ + ผู้ส่ง (dropdown ชื่อสมาชิกทั้งหมด)
- Table: วันที่ | ร้านค้า | หมวดหมู่ | รายการ | ยอด | ผู้ส่ง | แก้ไข | ลบ
- Edit: inline modal แก้ไข store_name, date_on_receipt, category, total_amount
- Delete: confirm dialog ก่อนลบ

**Export page:**
- เลือกช่วงเดือน (from/to)
- เลือก user (ทั้งหมด หรือเฉพาะคน)
- กด "Download CSV"

### API สำหรับ Admin
```
GET    /api/receipts              query: month, category, userId → receipts[]
PUT    /api/receipts/:id          body: { store_name, date_on_receipt, category, total_amount } (admin only)
DELETE /api/receipts/:id          (admin only)
GET    /api/stats                 query: months=6 → { monthly[], categories[] }
GET    /api/export/csv            query: from, to, userId → CSV file download
GET    /api/users                 → list unique users (userId + displayName) from receipts
```

---

## Database

ไม่มี schema ใหม่ — ใช้ `receipts` table เดิม

`line_display_name` ใช้สำหรับ user filter ใน admin (ดึงจาก receipts table)

---

## Security

- Admin routes ทั้งหมดผ่าน `adminAuth` middleware ตรวจ JWT cookie
- LIFF endpoints ตรวจ LINE access token ก่อน return data
- `GET /api/receipts` — ต้องส่ง `Authorization: Bearer <liff_access_token>` header (LIFF) หรือ admin JWT cookie ต้องมีอย่างใดอย่างหนึ่ง ถ้าเป็น LIFF token จะ force filter เฉพาะ userId ของ token นั้น ถ้าเป็น admin JWT สามารถ filter userId อะไรก็ได้หรือดูทั้งหมด
- `PUT, DELETE /api/receipts/:id` — admin JWT cookie เท่านั้น
- `GET /api/stats`, `GET /api/export/csv` — admin JWT cookie เท่านั้น
- JWT secret อย่างน้อย 32 characters ใน env

---

## LIFF Setup (Manual)

1. LINE Developers Console → เลือก channel → LIFF tab
2. Add LIFF app → Endpoint URL: `https://ezreceipt.sakww.com/liff`
3. Scope: `profile`
4. Copy LIFF ID → ใส่ใน `.env` เป็น `LIFF_ID`

---

## Dependencies ใหม่

```bash
npm install jsonwebtoken csv-stringify
```

`@line/bot-sdk` v7 มี `validateSignature` อยู่แล้ว — ไม่ต้องเพิ่ม LINE library ใหม่

---

## Testing

- Unit test: `adminAuth` middleware (valid/expired/missing JWT)
- Unit test: `api.js` receipt filters (mock db)
- Unit test: `export.js` CSV generation
- LIFF: ทดสอบ manual ใน LINE app (LIFF ต้องการ LINE environment)
