#!/usr/bin/env bash
# One-command local verify: build from Dockerfile (no GHCR required), wait for health, curl demo wallpaper status.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://127.0.0.1:8787}"
mkdir -p data
if [[ ! -f data/config.json ]]; then
  cp config.example.json data/config.json
fi

use_compose=0
if docker compose version >/dev/null 2>&1; then
  use_compose=1
fi

if [[ "$use_compose" == "1" ]]; then
  echo "==> docker compose up --build (Wallpaparr)"
  docker compose up --build -d
else
  echo "==> docker compose v2 plugin not found; docker build + docker run"
  docker build -t wallpaparr:local .
  docker rm -f wallpaparr >/dev/null 2>&1 || true
  docker run -d --name wallpaparr \
    -p 8787:8787 \
    -v "$ROOT/data:/data" \
    -e PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
    -e SUITE_DATA=/data \
    -e SUITE_LAYOUTS=/data/layouts \
    -e SUITE_GALLERY=/data/gallery \
    -e SUITE_CONFIG=/data/config.json \
    wallpaparr:local
fi

echo "==> waiting for http://127.0.0.1:8787/api/health"
ok=0
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8787/api/health >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" != "1" ]]; then
  echo "health check failed" >&2
  if [[ "$use_compose" == "1" ]]; then
    docker compose logs --tail=80
  else
    docker logs --tail=80 wallpaparr || true
  fi
  exit 1
fi

echo "==> GET /api/health"
curl -sf http://127.0.0.1:8787/api/health
echo

echo "==> GET /api/wallpaper/status (demo catalog, no Jellyfin required)"
curl -sf "http://127.0.0.1:8787/api/wallpaper/status?layout=Netflix%20Hero&sort=latest"
echo
echo "==> GET /api/tonight + /api/dashboard"
curl -sf "http://127.0.0.1:8787/api/tonight?layout=Netflix%20Hero"
echo
curl -sf http://127.0.0.1:8787/api/dashboard
echo
echo
echo "Wallpaparr is up. UI: http://127.0.0.1:8787"
echo "APK (after CI): Actions artifact wallpaparr-plugin-apk → wallpaparr-plugin-release.apk"
