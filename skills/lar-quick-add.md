---
name: lar-quick-add
description: Quick-add expenses/income to Lar via natural language.
version: 1.0.0
tags: [finance, household]
triggers:
  - spent
  - earned
  - paid
  - bought
  - received
  - add expense
  - add income
---

# Quick-Add Expense/Income

Parse natural language and POST to the Lar API.

## Examples
- "spent $45 groceries"
- "paid rent $650"
- "bought coffee $6.50"
- "$19.99 netflix entertainment"

## Rules

- Amount: look for `$XX.XX` or a number
- Expenses are NEGATIVE amounts, income is POSITIVE
- Categories must be capitalised: Groceries, Transport, Food, Bills, Entertainment, etc.
- Sub-categories use colon: Food:Coffee, Food:Delivery, Groceries:Meat
- Person: default "shared", or parse from message ("person2", "person1", etc.)
- ALWAYS include `"created": "YYYY-MM-DD"` (today unless specified)

## API Call

```bash
curl -X POST http://localhost:7777/api/purchases \
  -H "Content-Type: application/json" \
  -d '{"item": "ITEM", "amount": -AMOUNT, "category": "Category", "person": "shared", "created": "YYYY-MM-DD"}'
```

## Category Keywords
- groceries/coles/woolworths/aldi → Groceries
- fuel/petrol/uber → Transport
- rent/mortgage → Rent
- netflix/spotify → Entertainment
- restaurant/cafe/coffee/lunch/dinner → Food
- insurance/rego → Insurance
- internet/phone/electricity/gas → Bills
- salary/wage/pay → Income
- doctor/pharmacy/gym → Health

## Response
"✅ Added: -$XX.XX ITEM (Category) — person"
