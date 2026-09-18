# Install Wallpaparr

SeerChannel (Preview Channel rows) is **not** part of this suite. Wallpaparr ships the **wallpaper server** + **Projectivy wallpaper plugin APK**. For home-screen rows, install [SeerChannel](https://github.com/iManunator/SeerChannel) separately.

The GitHub repository may still be named `projectivy-live-wallpaper-suite`. The product, image, and APK are **Wallpaparr**.

## Local verify (offline demo, no Jellyfin)

Step-by-step for an assistant machine: [VERIFY.md](VERIFY.md)

```bash
./scripts/verify.sh
```

This **builds the Dockerfile** via `docker compose up --build` (`pull_policy: build`; GHCR is not required). Without Compose v2, use `docker build -t wallpaparr:local .` and `docker run` as in [VERIFY.md](VERIFY.md). The script waits for health, then curls:

| Check | URL |
| --- | --- |
| Health | `http://127.0.0.1:8787/api/health` |
| Demo wallpaper | `http://127.0.0.1:8787/api/wallpaper/status?layout=Netflix%20Hero&sort=latest` |
| UI | `http://127.0.0.1:8787` |

Empty data dirs auto-seed a demo catalog.

Unit tests: `./scripts/test.sh` (creates `backend/.venv` if needed).

## 1. Server — Docker Compose

```bash
git clone https://github.com/iManunator/projectivy-live-wallpaper-suite.git
cd projectivy-live-wallpaper-suite
mkdir -p data
cp config.example.json data/config.json
cp .env.example .env                      # PUBLIC_BASE_URL must be a LAN URL the TV can open
docker compose up --build -d
```

Open `http://YOUR_LAN_IP:8787`.

### Pull a published image (after a release / main build)

```bash
docker pull ghcr.io/imanunator/wallpaparr:latest
# or ghcr.io/imanunator/wallpaparr:1.1.0

export PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787
docker compose pull
docker compose up -d
```

Load a CI image artifact (PR / Actions, artifact name **`wallpaparr-image`**):

```bash
gzip -dc wallpaparr-image.tar.gz | docker load
docker run --rm -p 8787:8787 \
  -e PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787 \
  -v "$PWD/data:/data" \
  ghcr.io/imanunator/wallpaparr:ci
```

## 2. Plugin APK (Android TV / Projectivy)

Download **one** of:

- GitHub **Release** assets: `wallpaparr-plugin-release.apk` (sideload-signed) or `wallpaparr-plugin-debug.apk`
- GitHub **Actions** artifact **`wallpaparr-plugin-apk`** (same filenames)
- Local: `cd plugin && ./gradlew :app:assembleRelease` → `plugin/app/build/outputs/apk/release/app-release.apk`

Install on the TV:

```bash
adb connect TV_IP
adb install -r wallpaparr-plugin-release.apk
```

Then:

1. Projectivy → Appearance → Wallpaper → **Wallpaparr**
2. Plugin settings → **Server URL** `http://YOUR_LAN_IP:8787`
3. Pick layout, pick mode, filters, preferred client (Jellyfin / Moonfin / …)
4. Enable **Prefer parallax / motion VIDEO** if you baked MP4s; keep **Fallback to still JPEG** on
5. Set Projectivy’s wallpaper change interval (the plugin answers `TimeElapsed`)

Package: `com.imanunator.wallpaparr`  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`

## 3. Generate wallpapers

In the web UI: **Generate** → Demo (or Jellyfin / Seerr) → optional *Bake parallax / motion VIDEO*.  
Cron lives under **Settings**. Skip/replace matches Jellyfin, TMDB, and IMDb ids.

## Migrating from TV Background Suite

The older plugin (`com.butch708.projectivy.tvbgsuite`) talked to Flask on port **5000**. Wallpaparr uses **8787** and `com.imanunator.wallpaparr`, so both can be installed side by side. `/api/wallpaper/status` query params stay compatible.
