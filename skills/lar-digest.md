---
name: lar-digest
description: Generate daily/weekly household digest for messaging.
version: 1.0.0
tags: [finance, household, digest]
triggers:
  - digest
  - daily summary
  - weekly summary
  - weekly report
  - how are we doing
  - update me
---

# Household Digest

Generate a formatted summary combining finances, budgets, goals, and shopping list. Designed for sending via Telegram or other messaging.

## API Calls (fetch all data, then compose)

### 1. This week's spending
```bash
curl -s "http://localhost:7777/api/summary?start=YYYY-MM-DD&end=YYYY-MM-DD"
```

### 2. Budget status
```bash
curl -s http://localhost:7777/api/budgets
```

### 3. Goals progress
```bash
curl -s http://localhost:7777/api/goals
```

### 4. Shopping list (unchecked only)
```bash
curl -s http://localhost:7777/api/shopping
```

### 5. Upcoming bills (recurring with remind=1)
```bash
curl -s http://localhost:7777/api/recurring
```

## Date Ranges
- **Daily digest**: today only (start=today, end=tomorrow)
- **Weekly digest**: Monday to Sunday

## Compose Format — Daily
```
📅 Daily Update — Tue 16 Jun

💸 Today: -$45.50 (2 transactions)
📊 Budgets: all OK ✅
🛒 Shopping: 3 items pending
```

## Compose Format — Weekly
```
📊 Weekly Digest — 9-15 Jun

💰 Income: $3,000
💸 Expenses: -$1,245
📈 Net: +$1,755

📊 Budgets:
  ✅ Groceries: 72%
  ⚠️ Food: 91%

🎯 Goals:
  Holiday: 46% ($2,300/$5,000)

📋 Upcoming Bills:
  • Rent $2,200 (due ~1st)
  • Internet $89 (due ~15th)

🛒 Shopping: Milk, Bread, Eggs
```

## Rules
- Filter recurring by `remind=1` for "upcoming bills"
- Only show budgets that are ≥80% or over
- Keep it concise — this goes into a chat message
- Use emoji for scanability
