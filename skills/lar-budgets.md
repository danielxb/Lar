---
name: lar-budgets
description: Check budget progress and alert when overspending.
version: 1.0.0
tags: [finance, budgets]
triggers:
  - budget
  - over budget
  - am i overspending
  - how much left
  - spending limit
---

# Budget Alerts

Check spending against budget limits and alert when thresholds are crossed.

## Check All Budgets (includes current spending)
```bash
curl -s http://localhost:7777/api/budgets
```
Returns: `[{"id":1,"category":"Groceries","monthly_limit":800,"frequency":"monthly","alert_thresholds":"90,100","spent":650,"pct":81.25},...]`

## Add/Update Budget
```bash
curl -s -X POST http://localhost:7777/api/budgets \
  -H "Content-Type: application/json" \
  -d '{"category":"Groceries","monthly_limit":800,"frequency":"monthly","alert_thresholds":"90,100"}'
```

## Remove Budget
```bash
curl -s -X DELETE http://localhost:7777/api/budgets/<ID>
```

## Rules
- `spent` and `pct` are auto-calculated by the API
- Alert when `pct` >= first threshold (default 90%)
- CRITICAL when `pct` >= 100%
- Frequencies: `weekly`, `fortnightly`, `monthly`, `yearly`
- Category matches base category (e.g. budget for "Groceries" includes "Groceries:Meat")

## Response Format
```
📊 Budget Status:

✅ Groceries: $650/$800 (81%) — $150 left
⚠️ Food: $270/$300 (90%) — $30 left
🚨 Entertainment: $105/$100 (105%) — OVER by $5

Overall: 3 budgets, 1 warning, 1 over limit
```
