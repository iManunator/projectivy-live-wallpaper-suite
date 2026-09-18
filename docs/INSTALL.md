# Install

SeerChannel (Preview Channel rows) is **not** part of this suite. This package ships the **wallpaper server** + **Projectivy wallpaper plugin APK**. For home-screen rows, install [SeerChannel](https://github.com/iManunator/SeerChannel) separately.

## 1. Server — Docker Compose (recommended)

```bash
git clone https://github.com/iManunator/projectivy-live-wallpaper-suite.git
cd projectivy-live-wallpaper-suite
mkdir -p data
cp config.example.json data/config.json   # then edit URLs; keys can wait for the UI
cp .env.example .env                      # PUBLIC_BASE_URL must be a LAN URL the TV can open
docker compose up --build -d
```

Open `http://YOUR_LAN_IP:8787`. First boot seeds a demo catalog (no Jellyfin required).

### Pull a published image (after a release / main build)

```bash
docker pull ghcr.io/imanunator/projectivy-live-wallpaper-suite:latest
# or a version tag, e.g. ghcr.io/imanunator/projectivy-live-wallpaper-suite:1.0.0

export PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787
docker compose pull
docker compose up -d
```

`docker-compose.yml` names that GHCR image and can still `build: .` locally.

Load a CI image artifact (PR / Actions):

```bash
gzip -dc projectivy-live-wallpaper-suite-image.tar.gz | docker load
docker run --rm -p 8787:8787 \
  -e PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787 \
  -v "$PWD/data:/data" \
  ghcr.io/imanunator/projectivy-live-wallpaper-suite:ci
```

## 2. Plugin APK (Android TV / Projectivy)

Download **one** of:

- GitHub **Release** assets: `app-release.apk` (sideload-signed) or `app-debug.apk`
- GitHub **Actions** artifact `live-wallpaper-plugin-apk` on the CI workflow
- Local: `cd plugin && ./gradlew :app:assembleRelease` → `plugin/app/build/outputs/apk/release/app-release.apk`

Install on the TV (USB, ADB, or a sideload store):

```bash
adb connect TV_IP
adb install -r app-release.apk
```

Then:

1. Projectivy → Appearance → Wallpaper → **Live Wallpaper Suite**
2. Plugin settings → **Server URL** `http://YOUR_LAN_IP:8787`
3. Pick layout, pick mode, filters, preferred client (Jellyfin / Moonfin / …)
4. Enable **Prefer parallax / motion VIDEO** if you baked MP4s; keep **Fallback to still JPEG** on
5. Set Projectivy’s wallpaper change interval (the plugin answers `TimeElapsed`)

Package: `com.imanunator.projectivy.livewallpaper`  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`

## 3. Generate wallpapers

In the web UI: **Generate** → Demo (or Jellyfin / Seerr) → optional *Bake parallax / motion VIDEO*.  
Cron lives under **Settings**. Skip/replace matches Jellyfin, TMDB, and IMDb ids.

## Migrating from TV Background Suite

The older plugin (`com.butch708.projectivy.tvbgsuite`) talked to Flask on port **5000**. This suite uses **8787** and a new application id, so both can be installed side by side. Point the new plugin at this server; `/api/wallpaper/status` query params stay compatible.
