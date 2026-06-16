---
name: lar-recurring
description: Manage recurring bills and subscriptions — add, remove, list.
version: 1.0.0
tags: [finance, bills]
triggers:
  - recurring
  - bills
  - subscriptions
  - add bill
  - cancel subscription
  - monthly expenses
---

# Recurring Bills

Manage recurring expenses and income (rent, subscriptions, salary, etc.)

## List All Active
```bash
curl -s http://localhost:7777/api/recurring
```
Returns: `[{"id":1,"item":"Rent","amount":-2200,"category":"Housing","person":"shared","frequency":"monthly","active":1,"remind":0,"start_date":null},...]`

## Add Recurring
```bash
curl -s -X POST http://localhost:7777/api/recurring \
  -H "Content-Type: application/json" \
  -d '{"item":"Netflix","amount":-22.99,"category":"Entertainment","person":"shared","frequency":"monthly","remind":1}'
```

## Update Recurring
```bash
curl -s -X PUT http://localhost:7777/api/recurring/<ID> \
  -H "Content-Type: application/json" \
  -d '{"amount":-25.99}'
```

## Remove (deactivate)
```bash
curl -s -X DELETE http://localhost:7777/api/recurring/<ID>
```

## Rules
- Expenses are NEGATIVE, income is POSITIVE
- Frequencies: `weekly`, `fortnightly`, `monthly`, `quarterly`, `yearly`
- `remind: 1` means the agent should alert before it's due
- `start_date` (optional): "YYYY-MM-DD" — won't apply until that date

## Response Format
```
📋 Recurring Bills:

Monthly:
• Rent: -$2,200 (shared)
• Netflix: -$22.99 (shared)
• Gym: -$29.99 (person1)

Income:
• Salary: +$7,500 (monthly)

Total monthly: -$2,252.98 + $7,500 = +$5,247.02
```
