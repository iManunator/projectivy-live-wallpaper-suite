# Changelog

## Unreleased

Flagship editor, motion preview, connection toasts, and a license-safe cinematic demo catalog — on top of real Jellyfin artwork.

- **Generate** downloads backdrop (then poster) by default, with Jellyfin auth headers. HTML/non-image responses are rejected. Unconfigured Jellyfin/Seerr falls back to the demo catalog **with a warning**, instead of failing silently. Ids that sit past the first `limit` titles are still found.
- Jellyfin items request `ImageTags`. Missing Backdrop uses Primary/Thumb so poster-only titles still render.
- **Editor** is a 16:9 Projectivy stage: linear/radial multi-stop gradients, angle, opacity, vignette, overlay wash, four-edge fades, look DNA chips, draggable metadata, TV chrome / safe-zone guides. Demo or Jellyfin artwork. Save persists the layout JSON.
- **Motion preview** (CSS Ken Burns / parallax / drift) on Tonight, Editor, Generate, and Settings — Subtle / Cinematic / Bold visible without a TV. Baked ffmpeg VIDEO is still what Projectivy plays.
- **Toasts** for provider tests and generate: “Connected to Jellyfin (Living Room)” / failure reasons / “Created 6 stills for Netflix Hero”. Success and error notices work on mobile and desktop (44px close target, safe-area insets, Esc / tap-outside / close, contrast above the editor stage).
- **Movie / series logos.** Layout DNA `title_display`: `auto` \| `logo` \| `text`. Jellyfin `Images/Logo` (MediaBrowser token), TMDB/Seerr `logos` (English/null iso, PNG). Smart resize (~1200×450, shorter cap for tall/square marks), luminance contrast, 25px gap before tags, Projectivy clock/dock safe zones. Editor toggles logo vs text live on the 16:9 stage. Stills and parallax chrome both composite the logo. `GET /api/media/logo/{id}` rejects non-images. Demo **Northlight** ships an original clearlogo PNG; other demo titles fall back to the name.
- **Demo catalog** paints NASA / NARA / Library of Congress public-domain stills (plus one CC BY-SA Kew photograph) instead of synthetic-only gradients. Attribution: `backend/app/demo_stills/ATTRIBUTION.md`, `GET /api/demo/catalog`.
- **Gallery** (and the generated strip under the editor) opens stills in a full-screen lightbox (arrows / Esc).
- `GET /api/media/artwork/{item_id}` serves demo stills, then proxies Jellyfin Primary/Backdrop (image sniffing, correct content-type).

## 1.1.0

Flagship Wallpaparr layer on the 1.0 wallpaper core.

- Tonight’s home screen preview (Projectivy chrome overlay) and health dashboard in the web UI
- Smart queues: Unwatched, Continue watching, Newly added, Seerr trending, Requestable, Pinned
- Taste profiles with weighted mixes (`profile=` / `pool=taste:<name>`)
- Pin / never-show gallery flags (hidden titles never selected)
- Layout DNA: **Projectivy Dock** safe-zone preset plus Netflix Hero / Prime Cinematic / Google TV Clean
- Parallax intensity presets Subtle / Cinematic / Bold and optional light-leak layer
- Overlay widget hook (off by default) with a local clock card; HA / news / JSON demo stubs
- Plugin pick modes for tonight / continue watching / newly added / Seerr trending / pinned
- Additive status fields `queue` and `pinned`
- Packaging: CI on `main` publishes `ghcr.io/imanunator/wallpaparr:latest` (`packages: write`); `v*` tags attach `wallpaparr-plugin-release.apk` to a GitHub Release

Local verify: demo `sort=latest` is **Northlight**; `./scripts/test.sh` uses `backend/.venv`; `./scripts/verify.sh` falls back to `docker build`/`docker run` without Compose v2.

## 1.0.0

First release of **Wallpaparr**.

- FastAPI backend: Jellyfin + Jellyseerr/Seerr + optional TMDB, layout editor API, catalog, cron, demo seed
- Wallpaper HTTP API compatible with the TV Background Suite plugin (`/api/wallpaper/status` plus list endpoints)
- Optional parallax / Ken Burns / drift VIDEO loops (ffmpeg); still IMAGE always kept
- Extra status fields when a clip exists: `parallaxStyle`, `motionDuration` (`mediaType` / `videoUrl` unchanged)
- React web UI: gallery, layout editor, generate, comprehensive settings
- Kotlin Projectivy plugin `com.imanunator.wallpaparr` with pick modes, filters, mix/round-robin, IMAGE vs VIDEO choice, deep links
- Docker image `ghcr.io/imanunator/wallpaparr`
- Sideload APKs from CI / GitHub Releases (`wallpaparr-plugin-release.apk`)
- Local verify: `./scripts/verify.sh` (compose build + health + demo status curl)

SeerChannel (Preview Channels) is a separate app and is not bundled.
