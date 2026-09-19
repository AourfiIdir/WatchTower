.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help
help:
	@echo "WatchTower — available commands"
	@echo "  make frontend       Build the React frontend (dist/)"
	@echo "  make backend        Build frontend + copy into public/ + run backend locally"
	@echo "  make dev            Start DB + run backend locally (with frontend embedded)"
	@echo "  make db             Start PostgreSQL container only"
	@echo "  make up             Build & start full stack via Docker (detached)"
	@echo "  make watch          Docker compose watch: auto rebuild on file changes"
	@echo "  make logs           Tail Docker logs (backend + db)"
	@echo "  make down           Stop Docker containers (keeps pgdata volume)"
	@echo "  make clean          Remove build output (dist/, public assets)"
	@echo "  make lint           Lint the frontend"

.PHONY: frontend
frontend:
	cd frontend/WatchTower_Gui && npm run build

.PHONY: copy-frontend
copy-frontend: frontend
	cp -r frontend/WatchTower_Gui/dist/. backend/public/

.PHONY: backend
backend: copy-frontend
	cd backend && source .env && cargo run

.PHONY: dev
dev: db
	$(MAKE) backend

.PHONY: db
db:
	docker compose up -d db

.PHONY: up
up:
	docker compose up --build -d

.PHONY: watch
watch:
	docker compose up --watch

.PHONY: logs
logs:
	docker compose logs -f

.PHONY: down
down:
	docker compose down

.PHONY: clean
clean:
	rm -rf frontend/WatchTower_Gui/dist
	rm -f backend/public/*
	rmdir backend/public/assets backend/public 2>/dev/null || true

.PHONY: lint
lint:
	cd frontend/WatchTower_Gui && npm run lint