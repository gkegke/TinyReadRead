#!/bin/bash
# Tiny-ReadRead Appliance Bootstrap
set -e

# Default values
PORT=7777
BUILD_FLAG=""

# Parse arguments regardless of order
for arg in "$@"; do
    case "$arg" in
        --build)
            BUILD_FLAG="--build"
            ;;
        [0-9]*)
            PORT=$arg
            ;;
        *)
            echo "Usage: ./run.sh [--build] [port]"
            exit 1
            ;;
    esac
done

echo "------------------------------------------------"
echo "   Tiny-ReadRead (TRR) Deployment Utility"
echo "   Port: $PORT | Build: ${BUILD_FLAG:-No}"
echo "------------------------------------------------"

# Check for Docker
if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

# Set Env for Compose
export TRR_PORT=$PORT

# [FIX] Changed [[ ]] to [ ] for POSIX compatibility with 'sh'
if [ "$BUILD_FLAG" = "--build" ]; then
    echo "--- Building Production Image ---"
    docker compose build
fi

echo "--- Launching Services ---"
docker compose up -d

echo "--- Waiting for healthcheck (max 60s) ---"
for i in {1..12}; do
    # Handle case where container might not be up yet
    STATUS=$(docker inspect --format='{{json .State.Health.Status}}' tiny-readread 2>/dev/null || echo "starting")
    if [ "$STATUS" = "\"healthy\"" ]; then
        echo "Successfully Started!"
        break
    fi
    echo "Starting... ($i/12)"
    sleep 5
done

echo "------------------------------------------------"
echo "Tiny-ReadRead is running!"
echo "Studio UI: http://localhost:$PORT"
echo "Logs:      docker logs -f tiny-readread"
echo "------------------------------------------------"
