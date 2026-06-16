---
name: lar-goals
description: Track savings goals progress — view, add, update.
version: 1.0.0
tags: [finance, savings, goals]
triggers:
  - goal
  - savings goal
  - how close am i
  - progress
  - target
---

# Savings Goals

Track progress toward savings targets.

## View All Goals
```bash
curl -s http://localhost:7777/api/goals
```
Returns: `[{"id":1,"name":"Holiday Fund","target":5000,"current":2300,"deadline":"2026-12-01","created":"..."},...]`

## Add Goal
```bash
curl -s -X POST http://localhost:7777/api/goals \
  -H "Content-Type: application/json" \
  -d '{"name":"Holiday Fund","target":5000,"current":0,"deadline":"2026-12-01"}'
```

## Update Progress
```bash
curl -s -X PUT http://localhost:7777/api/goals/<ID> \
  -H "Content-Type: application/json" \
  -d '{"current": 2500}'
```

## Delete Goal
```bash
curl -s -X DELETE http://localhost:7777/api/goals/<ID>
```

## Rules
- Calculate percentage: `current / target * 100`
- If deadline exists, calculate days remaining and required weekly savings
- When user says "added $X to goal", update current += X

## Response Format
```
🎯 Savings Goals:

Holiday Fund: $2,300 / $5,000 (46%)
  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░ 46%
  Deadline: 1 Dec 2026 (168 days)
  Need: ~$16/day to hit target

Emergency Fund: $8,000 / $10,000 (80%)
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 80%
  No deadline set
```
