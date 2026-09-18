# Changelog

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
