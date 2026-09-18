#!/usr/bin/env bash
# Unit/integration tests (no Docker, no Jellyfin).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> backend pytest"
(cd "$ROOT/backend" && python3 -m pytest -q)

echo "==> frontend vitest"
(cd "$ROOT/web" && npm test)

echo "==> plugin :core:test"
(cd "$ROOT/plugin" && ./gradlew :core:test --no-daemon)
