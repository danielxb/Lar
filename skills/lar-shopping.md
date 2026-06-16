---
name: lar-shopping
description: Manage the household shopping list — add, check off, remove items.
version: 1.0.0
tags: [household, shopping]
triggers:
  - shopping list
  - add to list
  - need to buy
  - what do we need
  - bought it
  - got it
  - remove from list
---

# Shopping List

Manage the shared household shopping list.

## View List
```bash
curl -s http://localhost:7777/api/shopping
```
Returns: `[{"id":1,"item":"Milk","checked":0,"added_by":"user","created":"..."},...]`

## Add Item
```bash
curl -s -X POST http://localhost:7777/api/shopping \
  -H "Content-Type: application/json" \
  -d '{"item": "Milk", "added_by": "person1"}'
```

## Check Off Item (toggle)
```bash
curl -s -X PUT http://localhost:7777/api/shopping/<ID>
```

## Remove Item
```bash
curl -s -X DELETE http://localhost:7777/api/shopping/<ID>
```

## Clear All Checked Items
```bash
curl -s -X POST http://localhost:7777/api/shopping/clear
```

## Rules
- Show unchecked items first, then checked
- When user says "got it" or "bought it", toggle the item checked
- When user says "clear list", clear checked items only

## Response Format
```
🛒 Shopping List:

☐ Milk
☐ Bread
☐ Eggs
───────────
☑ Bananas (done)
```
