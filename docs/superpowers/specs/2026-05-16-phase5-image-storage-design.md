# Phase 5: Receipt Image Storage Design

## Overview

Store receipt images in Cloudflare R2 object storage after OCR processing. Save the object key in the database. Generate short-lived signed URLs when serving receipt data, so images are viewable in the admin panel and LIFF but not publicly accessible.

## Architecture

Four components:

1. **`src/services/storage.js`** — R2 client wrapper. Exposes `uploadImage(key, buffer)` and `getSignedUrl(key, expirySeconds)`. Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (R2 is S3-compatible).

2. **`src/handlers/image.js`** — After OCR extracts data, before inserting the receipt row, upload the image buffer to R2 as `receipts/{userId}/{receiptId}.jpg`. Pass the `image_key` to `insertReceipt`.

3. **`src/services/db.js`** — `insertReceipt` accepts and stores `image_key`. `getReceiptById` already uses `SELECT *` so returns `image_key` automatically. `getReceipts` uses explicit column list — add `image_key` to it.

4. **`src/routes/api.js`** — After fetching receipts (list or single), for each row that has `image_key`, call `getSignedUrl(image_key, 3600)` and attach as `image_url`. Receipts with no `image_key` get `image_url: null`.

## Storage Layout

```
R2 bucket: {R2_BUCKET_NAME}
Key format: receipts/{line_user_id}/{receiptId}.jpg
```

## Database Migration

```sql
ALTER TABLE receipts ADD COLUMN image_key TEXT;
```

New column is nullable — existing receipts have no image, `image_key` stays null.

## API Changes

`GET /api/receipts` and `GET /api/receipts/:id` responses include:
```json
{ "image_url": "https://..." }
```
or `"image_url": null` if no image.

Signed URL expiry: **1 hour** (`expirySeconds = 3600`).

For the receipt list (`GET /api/receipts`), generate signed URLs for all rows in parallel using `Promise.all`.

## UI Changes

### Admin Panel

In each receipt row/card, if `image_url` is not null: show a small thumbnail (`<img>` 60×60px). Clicking opens the full image in a new tab.

### LIFF

In each receipt card in the list view, if `image_url` is not null: show receipt image below the card details (`<img>` full-width, max-height 200px). Clicking opens the full image in a new tab.

Edit view is unaffected (no image display in edit form).

## Error Handling

- **Upload fails**: log the error, continue without `image_key` (receipt is saved, just no image). Never fail the whole receipt flow due to image upload error.
- **Signed URL generation fails**: log error, return `image_url: null`. Never fail the API response.
- **Old receipts (no image_key)**: skip signed URL generation, return `image_url: null`.

## Environment Variables

```
R2_ACCOUNT_ID=         # Cloudflare account ID
R2_ACCESS_KEY_ID=      # R2 API token Access Key ID
R2_SECRET_ACCESS_KEY=  # R2 API token Secret
R2_BUCKET_NAME=        # R2 bucket name
```

These are optional — if not set, storage is skipped (upload is no-op, signed URL returns null). This allows the app to run without R2 configured during development.

## File Changes

| File | Action |
|------|--------|
| `src/services/storage.js` | New — R2 client, `uploadImage`, `getSignedUrl` |
| `src/handlers/image.js` | Upload image after OCR, pass `image_key` to insertReceipt |
| `src/services/db.js` | Accept `image_key` in `insertReceipt`; add `image_key` to `getReceipts` SELECT columns |
| `migrations/002_add_image_key.sql` | `ALTER TABLE receipts ADD COLUMN image_key TEXT` |
| `src/routes/api.js` | Generate signed URLs in GET /receipts and GET /receipts/:id |
| `public/admin/index.html` | Show thumbnail in receipt list |
| `public/liff/app.js` | Show image in receipt card |
| `src/config.js` | Add R2 env vars (optional) |
| `tests/services/storage.test.js` | New — unit tests for storage service |

## Dependencies

```
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

## Testing

- Unit: `uploadImage` calls S3 PutObjectCommand with correct bucket/key/body
- Unit: `getSignedUrl` calls getSignedUrl with correct expiry
- Unit: `getSignedUrl` returns null when R2 not configured
- Unit: GET /api/receipts — receipts with image_key get image_url, without get null
- Manual: send receipt → check R2 bucket has file → admin panel shows thumbnail → LIFF shows image
