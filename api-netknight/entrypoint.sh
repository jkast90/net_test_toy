#!/bin/bash
set -e

echo "Starting NetKnight API for host container..."

# Start NetKnight API on port 8000
cd /app/api-netknight
export PYTHONPATH=/app
uvicorn netknight.main:app --host 0.0.0.0 --port 8000 --log-level info &

echo "NetKnight API started on port 8000"

# Keep container running
tail -f /dev/null
