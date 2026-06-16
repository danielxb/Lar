---
name: lar-summary
description: Get spending summaries from Lar.
version: 1.0.0
tags: [finance, household]
triggers:
  - how much
  - summary
  - spending
  - this week
  - this month
  - balance
---

# Finance Summary

Fetch and present spending summaries from the Lar API.

## When to Use
- "How much did I spend this week?"
- "What's my spending this month?"
- "Summary for May"

## API Calls

### Summary (income/expenses/balance for a period)
```bash
curl -s "http://localhost:7777/api/summary?start=YYYY-MM-DD&end=YYYY-MM-DD"
```
Returns: `{"income": X, "expenses": -X, "balance": X, "count": N, "categories": {...}}`

### Account balances
```bash
curl -s "http://localhost:7777/api/savings"
```

### Budgets with progress
```bash
curl -s "http://localhost:7777/api/budgets"
```

## Date Ranges
- This week: Monday to today
- This month: 1st to today
- Last month: 1st to last day of previous month

## Response Format
```
📊 Spending Summary (1-15 May)

Expenses: $1,234.56
Income: $3,000.00
Net: +$1,765.44

Top categories:
• Rent: $650
• Groceries: $320
• Transport: $89
```
