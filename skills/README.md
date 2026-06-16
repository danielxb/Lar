# Lar Skills for AI Agents

Pre-made skills for connecting AI agents (Hermes/OpenClaw) to your Lar dashboard.

## Setup

Copy the skills you want to your agent's skills directory:

```bash
# For Hermes
cp skills/lar-*.md ~/.hermes/skills/

# Or symlink
ln -s $(pwd)/skills/lar-quick-add.md ~/.hermes/skills/lar-quick-add/SKILL.md
```

## Available Skills

| Skill | What it does |
|-------|-------------|
| `lar-quick-add` | Add expenses/income via natural language ("spent $45 groceries") |
| `lar-summary` | Get spending summaries ("how much did I spend this week?") |
| `lar-receipt` | Process receipt PDFs or photos |
| `lar-work` | Log work hours with cash/invoice split |
| `lar-accounts` | Check balances, update accounts, transfers |
| `lar-shopping` | Manage shopping list — add, check off, remove items |
| `lar-recurring` | Manage recurring bills/subscriptions — add, remove, list |
| `lar-budgets` | Check budget progress, alert when overspending |
| `lar-goals` | Track savings goals progress |
| `lar-digest` | Generate daily/weekly household digest for messaging |

## Configuration

The skills assume Lar runs on `http://localhost:7777`. If your setup differs, find-and-replace the URL in the skill files.

## Usage with Hermes

```yaml
# In ~/.hermes/config.yaml
platforms:
  telegram:
    extra:
      group_topics:
      - chat_id: YOUR_GROUP_ID
        topics:
        - name: Finance
          thread_id: YOUR_THREAD_ID
          skill:
          - lar-quick-add
          - lar-summary
          - lar-receipt
          - lar-accounts
          - lar-work
          - lar-shopping
          - lar-recurring
          - lar-budgets
          - lar-goals
          - lar-digest
```

## Usage with OpenClaw

Place skill files in your agent's skill directory. They'll be auto-loaded based on message triggers.
