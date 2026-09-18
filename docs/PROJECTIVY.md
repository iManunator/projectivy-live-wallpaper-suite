# Projectivy plugin

Package: **`com.imanunator.projectivy.livewallpaper`**  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`  
AIDL contract: `tv.projectivy.plugin.wallpaperprovider.api` (unchanged from [upstream sample](https://github.com/spocky/projectivy-plugin-wallpaper-provider)).

## Build

```bash
cd plugin
./gradlew :core:test
./gradlew :app:assembleDebug
```

APK: `plugin/app/build/outputs/apk/debug/app-debug.apk`

The `:core` JVM module holds pick-mode mapping, URL rewrite, and deep-link builders so logic is tested without an emulator.

## Settings the plugin sends to the suite

| Setting | Status API |
| --- | --- |
| Collection / layout | `layout` |
| Pick mode | `sort` + `pool` (see `WallpaperPickModes`) |
| Genre / age / year | `genre`, `age_rating`, `min_year`, `max_year` |
| No-repeat bag | `exclude` |
| Prefer motion | uses `videoUrl` when `mediaType=video` |

Deep links: `jellyfin://items/{id}` is rewritten to a Jellyfin or Moonfin VIEW intent when that client is selected. Other clients (Kodi, Fladder, Wholphin, Void) launch the app.

## SeerChannel

This plugin only supplies **wallpapers**. Home-screen **Preview Channels** are published by [SeerChannel](https://github.com/iManunator/SeerChannel), which talks to Jellyfin/Jellyseerr directly. Install both if you want rows + cinematic backgrounds.
