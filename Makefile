.PHONY: deploy up down build logs ps health check-db tools-up local-up local-down restart-api restart-games restart-web restart-admin env-combine env-check

COMPOSE := docker compose
LOCAL_COMPOSE := docker compose -f docker-compose.yml -f docker-compose.local.yml

local-up:
	$(LOCAL_COMPOSE) up -d --build

local-down:
	$(LOCAL_COMPOSE) down

deploy:
	@./deploy.sh

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

tools-up:
	$(COMPOSE) --profile tools up -d --build

restart-api:
	$(COMPOSE) up -d --build api

restart-games:
	$(COMPOSE) up -d --build games

restart-web:
	$(COMPOSE) up -d --build web

restart-admin:
	$(COMPOSE) up -d --build admin

check-db:
	@docker run --rm --add-host=host.docker.internal:host-gateway alpine:3.20 \
		sh -c "nc -zv -w 3 host.docker.internal 5432"

env-combine:
	python3 scripts/combine_env.py

env-check:
	python3 scripts/combine_env.py --check

health:
	@echo "API:   $$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:$${API_PORT:-8081}/health)"
	@echo "Games: $$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:$${GAMES_PORT:-8090}/healthz)"
	@echo "Web:   $$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:$${WEB_PORT:-3001}/)"
	@echo "Admin: $$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:$${ADMIN_PORT:-4200}/)"
