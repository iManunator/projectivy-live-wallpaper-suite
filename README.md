# Projectivy Live Wallpaper Suite

A self-hosted **cinematic wallpaper** suite for [Projectivy Launcher](https://play.google.com/store/apps/details?id=com.spocky.projengmenu): generate stills (and optional Ken Burns MP4 loops) from **Jellyfin** and **Jellyseerr/Seerr**, edit layouts in a modern web UI, and serve the wallpaper HTTP API consumed by a dedicated Android TV plugin.

This is a clean-room overhaul of the older TV Background Suite stack ([androidtvbackgroundWebGui](https://github.com/iManunator/androidtvbackgroundWebGui) + [projectivy-tvbgsuite-plugin](https://github.com/iManunator/projectivy-tvbgsuite-plugin)). It keeps the Projectivy plugin API contract and pick-mode semantics, with a maintainable FastAPI + React + Kotlin layout.

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
                                               ▼
                                     gallery JPEGs + catalog.json
```

| Piece | Path | Role |
| --- | --- | --- |
| Backend | `backend/` | Generate, catalog, cron, Projectivy HTTP API |
| Web UI | `web/` | Layout editor, gallery, generate, settings |
| Plugin | `plugin/` | Projectivy wallpaper provider (`com.imanunator.projectivy.livewallpaper`) |

Wallpaper plugins **do not** publish Preview Channel rows. For Jellyfin/Jellyseerr channel rows in Projectivy, use **[SeerChannel](https://github.com/iManunator/SeerChannel)** alongside this suite.

## Docker quickstart

```bash
cp config.example.json data/config.json   # then edit keys in the UI or this file
cp .env.example .env                      # set PUBLIC_BASE_URL to a LAN URL the TV can reach
docker compose up --build -d
```

Open `http://YOUR_LAN_IP:8787`. First boot seeds a **demo catalog** (no Jellyfin required) so the plugin and gallery work immediately.

Bind-mount `./data` holds `config.json`, layouts, and generated images. **Never commit `data/config.json` or real API keys.**

### Projectivy setup

1. Build the plugin: `cd plugin && ./gradlew :app:assembleDebug`
2. Install `plugin/app/build/outputs/apk/debug/app-debug.apk` on the TV.
3. Projectivy → Appearance → Wallpaper → **Live Wallpaper Suite**.
4. Plugin settings:
   - **Server URL**: `http://YOUR_LAN_IP:8787` (must match `PUBLIC_BASE_URL`)
   - Layout, pick mode, filters, preferred client, prefer motion
5. Set Projectivy’s wallpaper change interval. The plugin answers `TimeElapsed`; it does not run its own timer.

Package: `com.imanunator.projectivy.livewallpaper`  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`

### Migrating from `com.butch708.projectivy.tvbgsuite`

The older plugin talked to the Flask WebGUI on port **5000**. This suite defaults to **8787** and a new application id, so both can be installed side by side. Point the new plugin at this server; pick modes (`sort` / `pool` / `exclude`) are the same. Uninstall the old APK when you are ready.

## API contract

See [docs/API.md](docs/API.md). Minimum Projectivy endpoints:

- `GET /api/layouts/list`
- `GET /api/layouts/with-images`
- `GET /api/genres/list`
- `GET /api/ages/list`
- `GET /api/year/list`
- `GET /api/wallpaper/status` — `imageUrl`, `actionUrl`, `path`, optional `mediaType` / `videoUrl`

Query params on status: `layout`, `genre`, `age_rating`, `min_year`, `max_year`, `min_rating`, `max_rating`, `sort`, `pool`, `exclude`.

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
# backend (no Jellyfin)
cd backend && pip install -r requirements-dev.txt && pytest -q

# frontend
cd web && npm install && npm test

# Android plugin (JVM core always; full APK needs Android SDK)
cd plugin
./gradlew :core:test
./gradlew :app:testDebugUnitTest :app:assembleDebug   # if SDK present
```

GitHub Actions runs all three jobs on push/PR.

### Manual QA still needed

- Sideload the APK on a real Android TV / Google TV device
- Confirm Projectivy binds the plugin, cycles stills, and plays MP4 loops
- Confirm Jellyfin / Moonfin deep links from `actionUri`
- Confirm LAN `PUBLIC_BASE_URL` rewrite (plugin maps `localhost` image URLs to the configured server)

## Credits

- Projectivy wallpaper plugin contract: [spocky/projectivy-plugin-wallpaper-provider](https://github.com/spocky/projectivy-plugin-wallpaper-provider)
- Prior WebGUI / plugin work: [iManunator/androidtvbackgroundWebGui](https://github.com/iManunator/androidtvbackgroundWebGui), [iManunator/projectivy-tvbgsuite-plugin](https://github.com/iManunator/projectivy-tvbgsuite-plugin)
- Channels (separate app): [iManunator/SeerChannel](https://github.com/iManunator/SeerChannel)
