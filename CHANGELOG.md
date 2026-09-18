# Changelog

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
