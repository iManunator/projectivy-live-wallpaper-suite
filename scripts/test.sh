#!/usr/bin/env bash
# Unit/integration tests (no Docker, no Jellyfin).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> backend pytest"
if [[ ! -d "$ROOT/backend/.venv" ]]; then
  python3 -m pip install -q -r "$ROOT/backend/requirements-dev.txt"
fi
(cd "$ROOT/backend" && python3 -m pytest -q)

echo "==> frontend vitest"
if [[ ! -d "$ROOT/web/node_modules" ]]; then
  (cd "$ROOT/web" && npm install)
fi
(cd "$ROOT/web" && npm test)

echo "==> plugin :core:test"
(cd "$ROOT/plugin" && ./gradlew :core:test --no-daemon)
