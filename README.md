# Projectivy Live Wallpaper Suite

A self-hosted **cinematic wallpaper** suite for [Projectivy Launcher](https://play.google.com/store/apps/details?id=com.spocky.projengmenu): generate stills (and optional **parallax / Ken Burns VIDEO** loops) from **Jellyfin** and **Jellyseerr/Seerr**, edit layouts in a modern web UI, and serve the wallpaper HTTP API consumed by a dedicated Android TV plugin.

This is a clean-room overhaul of the older TV Background Suite stack ([androidtvbackgroundWebGui](https://github.com/iManunator/androidtvbackgroundWebGui) + [projectivy-tvbgsuite-plugin](https://github.com/iManunator/projectivy-tvbgsuite-plugin)). It keeps the Projectivy plugin API contract and pick-mode semantics, with a maintainable FastAPI + React + Kotlin layout.

**Version:** 1.0.0 — see [CHANGELOG.md](CHANGELOG.md). Install steps: [docs/INSTALL.md](docs/INSTALL.md). Parallax / IMAGE vs VIDEO: [docs/MOTION.md](docs/MOTION.md).

## Architecture

```
┌──────────────────┐     REST      ┌─────────────────────────┐
│  Projectivy TV   │◄─────────────►│  FastAPI backend        │
│  plugin (Kotlin) │  wallpaper    │  /api/wallpaper/status  │
└──────────────────┘     API       │  /api/layouts|genres…   │
                                   │  renderer (Pillow)      │
┌──────────────────┐               │  optional ffmpeg motion │
│  Web editor      │──────────────►│  Jellyfin / Seerr / TMDB│
│  (React, / )     │               └───────────┬─────────────┘
└──────────────────┘                           │
                                     gallery JPEGs + MP4s + catalog.json
```

| Piece | Path | Role |
| --- | --- | --- |
| Backend | `backend/` | Generate, catalog, cron, Projectivy HTTP API |
| Web UI | `web/` | Layout editor, gallery, generate, settings |
| Plugin | `plugin/` | Projectivy wallpaper provider (`com.imanunator.projectivy.livewallpaper`) |

Wallpaper plugins **do not** publish Preview Channel rows. For Jellyfin/Jellyseerr channel rows in Projectivy, use **[SeerChannel](https://github.com/iManunator/SeerChannel)** alongside this suite. SeerChannel is **out of scope** here; this repo still ships the wallpaper plugin APK.

## Install tonight

### Server image

Published as `ghcr.io/imanunator/projectivy-live-wallpaper-suite` (`:latest` on `main`, semver on `v*` tags). CI on pull requests also uploads a loadable `projectivy-live-wallpaper-suite-image` artifact.

```bash
mkdir -p data
cp config.example.json data/config.json
cp .env.example .env          # set PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787
docker compose pull           # or: docker compose up --build -d
docker compose up -d
```

Open `http://YOUR_LAN_IP:8787`. First boot seeds a **demo catalog** (no Jellyfin required). Bind-mount `./data` holds `config.json`, layouts, and generated images. **Never commit `data/config.json` or real API keys.**

### Plugin APK

Download from a **GitHub Release** (`live-wallpaper-plugin-release.apk`) or the Actions artifact **`live-wallpaper-plugin-apk`**. Sideload on Android TV / Google TV, then:

1. Projectivy → Appearance → Wallpaper → **Live Wallpaper Suite**
2. **Server URL**: `http://YOUR_LAN_IP:8787`
3. Layout, pick mode, filters, preferred client, prefer VIDEO / fallback still
4. Set Projectivy’s wallpaper change interval. The plugin answers `TimeElapsed`; it does not run its own timer.

Package: `com.imanunator.projectivy.livewallpaper`  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`

Local APK: `cd plugin && ./gradlew :app:assembleRelease` → `plugin/app/build/outputs/apk/release/app-release.apk` (debug-keystore signed for sideload).

### Migrating from `com.butch708.projectivy.tvbgsuite`

The older plugin talked to the Flask WebGUI on port **5000**. This suite defaults to **8787** and a new application id, so both can be installed side by side. Point the new plugin at this server; pick modes (`sort` / `pool` / `exclude`) are the same. Uninstall the old APK when you are ready.

## API contract

See [docs/API.md](docs/API.md). Minimum Projectivy endpoints (tvbgsuite-compatible):

- `GET /api/layouts/list`
- `GET /api/layouts/with-images`
- `GET /api/genres/list`
- `GET /api/ages/list`
- `GET /api/year/list`
- `GET /api/wallpaper/status` — `imageUrl`, `actionUrl`, `path`, optional `mediaType` / `videoUrl`

When a motion clip exists, status also includes `parallaxStyle` and `motionDuration`. Clients that ignore unknown fields keep working.

Query params on status: `layout`, `genre`, `age_rating`, `min_year`, `max_year`, `min_rating`, `max_rating`, `sort`, `pool`, `exclude`.

## Options

**Web UI → Settings / Generate** and the **plugin settings** cover:

- Wallpaper pick modes: random, latest/oldest, rating, year, unwatched/partial/watched, library/Seerr/source pools, mix / round-robin layouts, no-repeat bag
- Filters: genre, age rating, year range, min/max rating, primary + secondary + third layouts
- Motion: enable, style (parallax / Ken Burns / drift), intensity, duration, fps, quality; plugin prefer-VIDEO + fallback still
- Providers: Jellyfin, Jellyseerr/Seerr, TMDB + connection tests
- Cron/batch: skip by media id, overwrite/replace, cleanup, schedule, id allow/deny lists
- Deep links / preferred client (Jellyfin, Moonfin, Fladder, Kodi, Wholphin, Void)
- Editor theme

## Local development

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
SUITE_SKIP_SEED=0 uvicorn app.main:app --reload --port 8787

# web (proxies /api → :8787)
cd web
npm install
npm run dev
```

## Tests

```bash
# backend (no Jellyfin; ffmpeg optional but used for parallax encode tests)
cd backend && pip install -r requirements-dev.txt && pytest -q

# frontend
cd web && npm install && npm test

# Android plugin (JVM core always; full APK needs Android SDK)
cd plugin
./gradlew :core:test
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease
```

GitHub Actions runs backend, frontend, Android APK upload, and a Docker image build (push to GHCR on `main` / tags; loadable image artifact on PRs). Tag `v*` to cut a GitHub Release with APKs + compose/config.

### Manual QA still needed

- Sideload the APK on a real Android TV / Google TV device
- Confirm Projectivy binds the plugin, cycles stills, and plays MP4 loops
- Confirm Jellyfin / Moonfin deep links from `actionUri`
- Confirm LAN `PUBLIC_BASE_URL` rewrite (plugin maps `localhost` image URLs to the configured server)

## Credits

- Projectivy wallpaper plugin contract: [spocky/projectivy-plugin-wallpaper-provider](https://github.com/spocky/projectivy-plugin-wallpaper-provider)
- Prior WebGUI / plugin work: [iManunator/androidtvbackgroundWebGui](https://github.com/iManunator/androidtvbackgroundWebGui), [iManunator/projectivy-tvbgsuite-plugin](https://github.com/iManunator/projectivy-tvbgsuite-plugin)
- Channels (separate app): [iManunator/SeerChannel](https://github.com/iManunator/SeerChannel)
