# Verify Wallpaparr locally (no Jellyfin, no GHCR)

The owner’s assistant can run this on a machine with Docker. It **builds the repo Dockerfile**; it does not need a published GHCR image or a real media server.

## 1. One command

```bash
./scripts/verify.sh
```

That script is:

```bash
mkdir -p data
cp -n config.example.json data/config.json || true
docker compose up --build -d
```

`docker-compose.yml` sets `build: .` and `pull_policy: build`, so Compose **always builds from `Dockerfile`**. It will not fail just because `ghcr.io/imanunator/wallpaparr` is not public yet.

## 2. Healthcheck

Wait until healthy (the script already waits), or:

```bash
curl -sf http://127.0.0.1:8787/api/health
```

Expected:

```json
{"ok":true,"service":"wallpaparr","version":"1.1.0"}
```

Compose healthcheck: `curl -sf http://127.0.0.1:8787/api/health` inside the container. UI: http://127.0.0.1:8787

## 3. Demo wallpaper status (fixture catalog)

First boot seeds six demo titles into the **Netflix Hero** layout when the catalog is empty (`SUITE_SKIP_SEED` is unset). No Jellyfin/Seerr keys required.

```bash
curl -sf "http://127.0.0.1:8787/api/wallpaper/status?layout=Netflix%20Hero&sort=latest"
```

Expected fields (tvbgsuite-compatible): `imageUrl`, `actionUrl`, `path`, `title`, `layout`. Demo `title` for `sort=latest` is **Northlight**. Open `imageUrl` in a browser — it is a JPEG from the seeded gallery.

Tonight + health (same demo catalog):

```bash
curl -sf "http://127.0.0.1:8787/api/tonight?layout=Netflix%20Hero"
curl -sf http://127.0.0.1:8787/api/dashboard
```

## 4. Unit tests (no Docker)

```bash
# first time on a machine
cd backend && python3 -m pip install -r requirements-dev.txt && cd ..
cd web && npm install && cd ..

./scripts/test.sh
```

Runs backend pytest, frontend vitest, and `plugin` `:core:test`.

## 5. Plugin APK

After GitHub Actions is green on the PR:

1. Open the **CI** workflow on the PR
2. Artifact **`wallpaparr-plugin-apk`**
3. Files: **`wallpaparr-plugin-release.apk`** (sideload) and `wallpaparr-plugin-debug.apk`

Same filenames on a GitHub Release (`v*` tag). Sideload: `adb install -r wallpaparr-plugin-release.apk`, then Projectivy → Wallpaper → **Wallpaparr**.
