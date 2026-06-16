# Contributing to Lar

Thanks for your interest in contributing! Lar is intentionally simple — please keep it that way.

## Principles

- **No JS frameworks** — vanilla JavaScript only, no build step
- **Single-file backend** — keep `server.py` as one readable file
- **API-first** — every feature must be accessible via REST endpoint
- **No external services required** — SQLite only, no Redis/Postgres/cloud
- **Agent-friendly** — if you add a feature, consider how an AI agent would use it

## How to Contribute

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run tests: `make test`
5. Open a PR with a clear description

## Adding a New Skill

If you're adding agent skill support:
1. Create `skills/lar-yourskill.md` following the existing format
2. Include: triggers, API calls with curl examples, response format
3. Test with a real agent (Hermes, OpenClaw, or similar)

## Code Style

- Python: follow existing patterns in `server.py`
- JavaScript: keep it readable, no minification, use template literals
- CSS: use CSS variables for theming, mobile-first
- Categories: always capitalised (`Groceries:Meat`, not `groceries:meat`)
- Amounts: expenses negative, income positive

## Reporting Bugs

Open an issue with:
- What you expected
- What happened
- Steps to reproduce
- Browser/OS if frontend-related
