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

echo "==> docker compose up --build (Wallpaparr)"
docker compose up --build -d

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
  docker compose logs --tail=80
  exit 1
fi

echo "==> GET /api/health"
curl -sf http://127.0.0.1:8787/api/health
echo

echo "==> GET /api/wallpaper/status (demo catalog, no Jellyfin required)"
curl -sf "http://127.0.0.1:8787/api/wallpaper/status?layout=Netflix%20Hero&sort=latest"
echo "==> GET /api/tonight + /api/dashboard"
curl -sf "http://127.0.0.1:8787/api/tonight?layout=Netflix%20Hero"
echo
curl -sf http://127.0.0.1:8787/api/dashboard
echo
echo
echo "Wallpaparr is up. UI: http://127.0.0.1:8787"
echo "APK (after CI): Actions artifact wallpaparr-plugin-apk → wallpaparr-plugin-release.apk"
