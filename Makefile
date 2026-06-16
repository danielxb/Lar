.PHONY: serve build up down test backup status clean

# Development
serve:
	@echo "Lar Dashboard → http://127.0.0.1:7777"
	PROJECT_ROOT=. python src/server.py

# Docker
build:
	docker compose -f docker/docker-compose.yml build

up:
	docker compose -f docker/docker-compose.yml up --build -d

down:
	docker compose -f docker/docker-compose.yml down

logs:
	docker compose -f docker/docker-compose.yml logs -f --tail 20

# Testing
test:
	pytest tests/ -v

# Database
backup:
	@mkdir -p data/backups
	cp data/lar.db "data/backups/lar_$$(date +%Y%m%d_%H%M%S).db"
	@echo "Backup saved to data/backups/"

# Status
status:
	@lsof -iTCP:7777 -sTCP:LISTEN 2>/dev/null || echo "Port 7777 free"

stop:
	@lsof -ti:7777 | xargs kill -9 2>/dev/null && echo "Stopped" || echo "Nothing on 7777"

# Cleanup
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -type f -name "*.pyc" -delete 2>/dev/null; true
