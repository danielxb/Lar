---
name: lar-work
description: Log work hours with cash/invoice split.
version: 1.0.0
tags: [finance, work]
triggers:
  - worked
  - hours
  - invoice
  - cash
---

# Work Hours Logging

Log work hours and calculate cash/invoice split.

## When to Use
- "worked 7 hours today, got $165 cash"
- "worked 5h, all invoice"
- "got $20 tip"

## How It Works

1. Parse: hours, date, rate, cash_amount
2. Calculate: invoice_amount = (hours × rate) − cash_amount
3. POST to API

## Tips vs Work Cash
- **Work cash** = payment for work, reduces invoice
- **Tips** = bonus, does NOT reduce invoice. Add as separate purchase:
```bash
curl -s -X POST http://localhost:7777/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"item":"Tip","amount":20,"category":"Income:Tip","person":"worker","created":"YYYY-MM-DD","payment_method":"cash"}'
```

## API Call
```bash
curl -s -X POST http://localhost:7777/api/worklog \
  -H "Content-Type: application/json" \
  -d '{"person":"worker","date":"YYYY-MM-DD","hours":7,"rate":30,"cash_amount":200,"invoice_amount":38}'
```

## Rules
- ALWAYS include the correct date
- cash_amount + invoice_amount must equal hours × rate
- If "all cash": cash_amount = total, invoice_amount = 0
- If no cash: cash_amount = 0, invoice_amount = total
- When cash > 0, also create income transaction:
```bash
curl -s -X POST http://localhost:7777/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"item":"Work cash","amount":200,"category":"Income:Cash","person":"worker","created":"YYYY-MM-DD","payment_method":"cash"}'
```

## Response
"✅ Logged: 7h on Thu 7 May — Total $238 (cash $200 + invoice $38)"
