# Changelog

## 1.0.0

First release of the Projectivy Live Wallpaper Suite.

- FastAPI backend: Jellyfin + Jellyseerr/Seerr + optional TMDB, layout editor API, catalog, cron
- Wallpaper HTTP API compatible with the TV Background Suite plugin (`/api/wallpaper/status` plus list endpoints)
- Optional parallax / Ken Burns / drift VIDEO loops (ffmpeg); still IMAGE always kept
- Extra status fields when a clip exists: `parallaxStyle`, `motionDuration` (`mediaType` / `videoUrl` unchanged)
- React web UI: gallery, layout editor, generate, comprehensive settings
- Kotlin Projectivy plugin `com.imanunator.projectivy.livewallpaper` with pick modes, filters, mix/round-robin, IMAGE vs VIDEO choice, deep links
- Docker image `ghcr.io/imanunator/projectivy-live-wallpaper-suite`
- Sideload APK from CI / GitHub Releases

SeerChannel (Preview Channels) is a separate app and is not bundled.
