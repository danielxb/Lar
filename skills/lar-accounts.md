---
name: lar-accounts
description: Check and manage account balances in Lar.
version: 1.0.0
tags: [finance, household]
triggers:
  - accounts
  - balance
  - net worth
  - how much do i have
  - savings
---

# Account Balances

Check and update account balances.

## View Balances
```bash
curl -s http://localhost:7777/api/savings
```

## Update Balance (manual — when user checks their bank)
```bash
curl -s -X PUT http://localhost:7777/api/savings/<ID> \
  -H "Content-Type: application/json" \
  -d '{"balance": 5000.00}'
```

## Add Account
```bash
curl -s -X POST http://localhost:7777/api/savings \
  -H "Content-Type: application/json" \
  -d '{"account_name":"My Bank","balance":5000,"currency":"AUD","account_type":"everyday"}'
```

Account types: `everyday` (spending), `savings` (long-term)

## Transfer Between Accounts
```bash
curl -s -X POST http://localhost:7777/api/transfer \
  -H "Content-Type: application/json" \
  -d '{"from_id": 1, "to_id": 2, "amount": 500}'
```

## Response Format
```
💰 Your Accounts:

Everyday:
  Bank Account: $5,000.00 AUD

Savings:
  Savings Account: $20,000.00 AUD
  Foreign Account: €500.00

Net Worth (AUD): $25,800.00
```
