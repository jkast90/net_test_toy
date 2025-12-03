#!/bin/bash
# Build script that handles image dependency ordering
set -e

COMPOSE_CMD="docker-compose"
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

echo "🏗️  Building base images..."
$COMPOSE_CMD build _python-base _bullseye-base

echo "🏗️  Building daemon images..."
$COMPOSE_CMD build _gobgp-unified _frr-unified _exabgp-unified

echo "🏗️  Building host images..."
$COMPOSE_CMD build _host-netknight

echo "🏗️  Building service images..."
$COMPOSE_CMD build container-manager monitoring

echo "✅ All images built successfully!"
echo ""
echo "Run '$COMPOSE_CMD up -d' to start services"
