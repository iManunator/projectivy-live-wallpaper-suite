# Projectivy plugin (Wallpaparr)

Display name: **Wallpaparr**  
Package: **`com.imanunator.wallpaparr`**  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`  
AIDL contract: `tv.projectivy.plugin.wallpaperprovider.api` (unchanged from [upstream sample](https://github.com/spocky/projectivy-plugin-wallpaper-provider)).

## Build

```bash
cd plugin
./gradlew :core:test
./gradlew :app:assembleDebug :app:assembleRelease
```

CI uploads **`wallpaparr-plugin-apk`** (`wallpaparr-plugin-debug.apk` + sideload-signed `wallpaparr-plugin-release.apk`). Releases attach the same files. See [INSTALL.md](INSTALL.md).

The `:core` JVM module holds pick-mode mapping, URL rewrite, IMAGE vs VIDEO choice, and deep-link builders so logic is tested without an emulator.

## IMAGE vs VIDEO

Projectivy `WallpaperType.IMAGE` (0) plays `imageUrl` (JPEG). `WallpaperType.VIDEO` (4) loops `videoUrl` (H.264 MP4). Wallpaparr always keeps the still; motion is an optional sibling file. The plugin setting **Prefer parallax / motion VIDEO** picks VIDEO when `videoUrl` is present; **Fallback to still JPEG** uses IMAGE otherwise. Depth layers are baked into the MP4 (Projectivy is not a compositor). Details: [MOTION.md](MOTION.md).

## Settings the plugin sends to the suite

| Setting | Status API |
| --- | --- |
| Primary / secondary / third layout | `layout` (mix and round-robin modes) |
| Pick mode | Status API |
| --- | --- |
| Tonight’s mix | `pool=taste:tonight` (server taste profile) |
| Continue watching | `pool=continue_watching` |
| Newly added | `sort=latest` + `pool=newly_added` |
| Seerr trending | `pool=source:jellyseerr` + `sort=rating` |
| Pinned titles | `pool=pinned` (no fallback) |
| Genre / age / year | `genre`, `age_rating`, `min_year`, `max_year` |
| Min / max rating | `min_rating`, `max_rating` |
| No-repeat bag | `exclude` |
| Prefer motion | uses `videoUrl` when `mediaType=video` |

Deep links: `jellyfin://items/{id}` is rewritten to a Jellyfin or Moonfin VIEW intent when that client is selected. Other clients (Kodi, Fladder, Wholphin, Void) launch the app.

## SeerChannel

This plugin only supplies **wallpapers**. Home-screen **Preview Channels** are published by [SeerChannel](https://github.com/iManunator/SeerChannel), which talks to Jellyfin/Jellyseerr directly. Install both if you want rows + cinematic backgrounds. SeerChannel is **not** shipped in Wallpaparr.
