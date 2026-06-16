---
name: lar-receipt
description: Process receipt PDFs/images for Lar.
version: 1.0.0
tags: [finance, household, receipts]
triggers:
  - receipt
  - process this
  - woolworths
  - coles
---

# Receipt Processing

Process receipt PDFs or images and add items to Lar.

## Rules
1. Do NOT analyze images yourself
2. ONLY follow the steps below

## For PDF Receipts (e-receipts from Woolworths, Coles, etc.)

### 1. Copy to inbox
```bash
cp "<file_path>" <LAR_PROJECT>/data/inbox/
```

### 2. Call the API
```bash
curl -s -X POST http://localhost:7777/api/receipt/process \
  -H "Content-Type: application/json" \
  -d '{"filename": "<filename>"}'
```

### 3. Report result
Show: store, item count, total, any unclassified items.

## For Photos/Images

### 1. Copy to inbox
```bash
cp "<file_path>" <LAR_PROJECT>/data/inbox/
```

### 2. Use vision to read items, then POST each
```bash
curl -s -X POST http://localhost:7777/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"item":"Product","amount":-5.50,"category":"Groceries:Dairy","person":"shared","created":"YYYY-MM-DD","receipt_file":"YYYY-MM-DD_storename_total_count_hash"}'
```

**IMPORTANT:** All items from the same receipt must share the same `receipt_file` value so they group together.

Format: `YYYY-MM-DD_storename_total_count_hash`
- storename: lowercase, no spaces
- total: receipt total
- count: number of items
- hash: any 8-char random string

## Cash/Card Split
If user paid part cash and part card:
```bash
curl -s -X POST http://localhost:7777/api/transfer \
  -H "Content-Type: application/json" \
  -d '{"from_id": <cash_account_id>, "to_id": <card_account_id>, "amount": <cash_amount>}'
```
