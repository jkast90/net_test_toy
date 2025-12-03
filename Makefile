# NetStream - BGP Lab & Testing Platform
# Makefile for managing the NetStream environment

# Auto-detect docker compose vs docker-compose
DOCKER_COMPOSE := $(shell if docker compose version >/dev/null 2>&1; then echo "docker compose"; else echo "docker-compose"; fi)
COMPOSE_FILE := docker-compose.yml

# Container names
CONTAINER_MANAGER := container-manager
MONITORING := netstream-monitoring
UI := netstream-ui

# API endpoints
CONTAINER_API := http://localhost:5010
MONITORING_API := http://localhost:5002
UI_URL := http://localhost:3000

.PHONY: help up down restart logs build rebuild clean \
        build-images build-base build-daemons build-hosts \
        ps status health \
        test test-apis test-live test-write \
        network-create network-delete \
        logs-container logs-monitoring logs-ui \
        shell-container shell-monitoring shell-ui \
        clean-containers clean-images clean-all

##############################################################################
# Help & Info
##############################################################################

help:
	@echo "NetStream - BGP Lab & Testing Platform"
	@echo "======================================"
	@echo ""
	@echo "🚀 Quick Start:"
	@echo "  make setup              Complete first-time setup"
	@echo "  make up                 Start all services"
	@echo "  make status             Check service status"
	@echo "  make test               Run API tests"
	@echo ""
	@echo "📦 Service Management:"
	@echo "  make up                 Start all services"
	@echo "  make down               Stop all services"
	@echo "  make restart            Restart all services"
	@echo "  make rebuild            Rebuild and restart services"
	@echo "  make logs               Tail logs from all services"
	@echo "  make ps                 List running containers"
	@echo ""
	@echo "🏗️  Image Building:"
	@echo "  make build              Build all images"
	@echo "  make build-base         Build base images (python, bullseye)"
	@echo "  make build-daemons      Build daemon images (FRR, GoBGP, ExaBGP)"
	@echo "  make build-hosts        Build host images (NetKnight)"
	@echo "  make build-images       Build base + daemon + host images"
	@echo ""
	@echo "🔍 Monitoring & Testing:"
	@echo "  make status             Show all service status"
	@echo "  make health             Check API health"
	@echo "  make test               Run comprehensive API tests"
	@echo "  make test-live          Test running daemon containers"
	@echo "  make test-write         Test write operations (POST/PUT/DELETE)"
	@echo ""
	@echo "🌐 Network Management:"
	@echo "  make network-create     Create lab network"
	@echo "  make network-delete     Delete lab network"
	@echo "  make network-info       Show network information"
	@echo ""
	@echo "📋 Logs:"
	@echo "  make logs               All service logs"
	@echo "  make logs-container     Container manager logs"
	@echo "  make logs-monitoring    Monitoring API logs"
	@echo "  make logs-ui            UI logs"
	@echo ""
	@echo "🐚 Shell Access:"
	@echo "  make shell-container    Shell into container manager"
	@echo "  make shell-monitoring   Shell into monitoring API"
	@echo "  make shell-ui           Shell into UI"
	@echo ""
	@echo "🧹 Cleanup:"
	@echo "  make clean              Stop and remove containers"
	@echo "  make clean-containers   Remove all lab containers"
	@echo "  make clean-images       Remove all NetStream images"
	@echo "  make clean-all          Nuclear option - remove everything"

##############################################################################
# Setup & Initialization
##############################################################################

setup: network-create build up
	@echo ""
	@echo "✅ NetStream setup complete!"
	@echo ""
	@echo "🌐 Services available at:"
	@echo "  UI:                 $(UI_URL)"
	@echo "  Container API:      $(CONTAINER_API)"
	@echo "  Monitoring API:     $(MONITORING_API)"
	@echo ""
	@echo "📖 Next steps:"
	@echo "  1. Open $(UI_URL) in your browser"
	@echo "  2. Use the Lab Manager to create BGP daemons"
	@echo "  3. Run 'make test' to verify everything works"

network-create:
	@echo "🌐 Creating lab network..."
	@docker network create --subnet=192.168.70.0/24 netstream_lab_builder_network 2>/dev/null || echo "Network already exists"

network-delete:
	@echo "🗑️  Deleting lab network..."
	@docker network rm netstream_lab_builder_network 2>/dev/null || echo "Network doesn't exist"

network-info:
	@echo "📊 Lab Network Information:"
	@docker network inspect netstream_lab_builder_network 2>/dev/null || echo "❌ Network not found. Run 'make network-create'"

##############################################################################
# Service Management
##############################################################################

up:
	@echo "🚀 Starting NetStream services..."
	$(DOCKER_COMPOSE) up -d
	@sleep 3
	@$(MAKE) --no-print-directory status

down:
	@echo "🛑 Stopping NetStream services..."
	$(DOCKER_COMPOSE) down

restart: down up

rebuild:
	@echo "🔨 Rebuilding and restarting services..."
	$(DOCKER_COMPOSE) up -d --build

ps:
	@$(DOCKER_COMPOSE) ps

status:
	@echo "📊 NetStream Service Status:"
	@echo ""
	@$(DOCKER_COMPOSE) ps
	@echo ""
	@echo "🌐 Endpoints:"
	@echo "  UI:                 $(UI_URL)"
	@echo "  Container API:      $(CONTAINER_API)"
	@echo "  Monitoring API:     $(MONITORING_API)"

##############################################################################
# Image Building
##############################################################################

build:
	@echo "🏗️  Building all service images..."
	$(DOCKER_COMPOSE) build

build-base:
	@echo "🏗️  Building base images..."
	$(DOCKER_COMPOSE) build _python-base _bullseye-base

build-daemons:
	@echo "🏗️  Building daemon images..."
	$(DOCKER_COMPOSE) build _frr-unified _gobgp-unified _exabgp-unified

build-hosts:
	@echo "🏗️  Building host images..."
	$(DOCKER_COMPOSE) build _host-netknight

build-images: build-base build-daemons build-hosts
	@echo "✅ All base, daemon, and host images built successfully"

##############################################################################
# Health & Testing
##############################################################################

health:
	@echo "🔍 Checking API health..."
	@echo ""
	@echo -n "Container API: "
	@curl -s $(CONTAINER_API)/ > /dev/null && echo "✅ OK" || echo "❌ FAILED"
	@echo -n "Monitoring API: "
	@curl -s $(MONITORING_API)/ > /dev/null && echo "✅ OK" || echo "❌ FAILED"
	@echo -n "UI: "
	@curl -s $(UI_URL) > /dev/null && echo "✅ OK" || echo "❌ FAILED"

test:
	@echo "🧪 Running comprehensive API tests..."
	@if [ ! -f test-apis.sh ]; then \
		echo "❌ test-apis.sh not found"; \
		exit 1; \
	fi
	@./test-apis.sh

test-live:
	@echo "🧪 Testing live daemon containers..."
	@if [ ! -f test-apis-live.sh ]; then \
		echo "❌ test-apis-live.sh not found"; \
		exit 1; \
	fi
	@./test-apis-live.sh

test-write:
	@echo "🧪 Testing write operations (POST/PUT/DELETE)..."
	@if [ ! -f test-write-operations.sh ]; then \
		echo "❌ test-write-operations.sh not found"; \
		exit 1; \
	fi
	@./test-write-operations.sh

##############################################################################
# Logs
##############################################################################

logs:
	$(DOCKER_COMPOSE) logs -f

logs-container:
	@echo "📋 Container Manager logs:"
	@docker logs $(CONTAINER_MANAGER) -f --tail 50

logs-monitoring:
	@echo "📋 Monitoring API logs:"
	@docker logs $(MONITORING) -f --tail 50

logs-ui:
	@echo "📋 UI logs:"
	@docker logs $(UI) -f --tail 50

##############################################################################
# Shell Access
##############################################################################

shell-container:
	@echo "🐚 Opening shell in container manager..."
	@docker exec -it $(CONTAINER_MANAGER) /bin/bash || docker exec -it $(CONTAINER_MANAGER) /bin/sh

shell-monitoring:
	@echo "🐚 Opening shell in monitoring API..."
	@docker exec -it $(MONITORING) /bin/bash || docker exec -it $(MONITORING) /bin/sh

shell-ui:
	@echo "🐚 Opening shell in UI..."
	@docker exec -it $(UI) /bin/sh

##############################################################################
# Cleanup
##############################################################################

clean:
	@echo "🧹 Cleaning up containers and volumes..."
	$(DOCKER_COMPOSE) down -v

clean-containers:
	@echo "🧹 Removing all lab daemon and host containers..."
	@echo "⚠️  This will remove all GoBGP, FRR, ExaBGP, and Host containers!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker ps -a --filter "name=gobgp" --filter "name=frr" --filter "name=exabgp" --filter "name=host" -q | xargs -r docker rm -f; \
		echo "✅ Lab containers removed"; \
	else \
		echo "❌ Cancelled"; \
	fi

clean-images:
	@echo "🧹 Removing NetStream images..."
	@echo "⚠️  This will remove all built NetStream images!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker images --filter "reference=*frr*" --filter "reference=*gobgp*" --filter "reference=*exabgp*" --filter "reference=*netknight*" --filter "reference=*python-base*" --filter "reference=*bullseye-base*" -q | xargs -r docker rmi -f; \
		echo "✅ NetStream images removed"; \
	else \
		echo "❌ Cancelled"; \
	fi

clean-all: clean clean-containers clean-images network-delete
	@echo "✅ Complete cleanup finished"
