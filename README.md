# Wallpaparr

Cinematic **Projectivy** wallpapers — stills and optional **parallax VIDEO** loops — from Jellyfin and Jellyseerr/Seerr. *arr-style name, same idea as Sonarr/Radarr.

This GitHub repository may still be named `projectivy-live-wallpaper-suite`; the product is **Wallpaparr**.

**Version:** 1.0.0 — [CHANGELOG.md](CHANGELOG.md) · [Install](docs/INSTALL.md) · [Parallax / IMAGE vs VIDEO](docs/MOTION.md)

## Verify tonight (no Jellyfin)

One command builds the **Dockerfile** (does not need GHCR) and hits the demo catalog:

```bash
./scripts/verify.sh
```

That is `docker compose up --build`, then:

- Health: http://127.0.0.1:8787/api/health → `{"ok":true,"service":"wallpaparr",...}`
- Wallpaper: `curl -sf "http://127.0.0.1:8787/api/wallpaper/status?layout=Netflix%20Hero&sort=latest"`
- UI: http://127.0.0.1:8787

First boot seeds a demo gallery if the catalog is empty. Equivalent:

```bash
mkdir -p data && cp -n config.example.json data/config.json || true
docker compose up --build -d
# wait until healthy, then open the URLs above
```

Unit tests (no Docker): `./scripts/test.sh`

## Install

### Server

```bash
git clone https://github.com/iManunator/projectivy-live-wallpaper-suite.git
cd projectivy-live-wallpaper-suite
cp config.example.json data/config.json   # mkdir -p data first
cp .env.example .env                      # PUBLIC_BASE_URL=http://YOUR_LAN_IP:8787 for the TV
docker compose up --build -d
```

Published image (after `main` / a `v*` tag): `ghcr.io/imanunator/wallpaparr:latest`

```bash
docker pull ghcr.io/imanunator/wallpaparr:latest
docker compose pull && docker compose up -d
```

CI pull requests also upload a loadable **`wallpaparr-image`** artifact (`wallpaparr-image.tar.gz`).

### Plugin APK (Android TV / Projectivy)

Download **`wallpaparr-plugin-apk`** from GitHub Actions (files `wallpaparr-plugin-release.apk` and `wallpaparr-plugin-debug.apk`) or the same names on a GitHub Release.

```bash
adb connect TV_IP
adb install -r wallpaparr-plugin-release.apk
```

Then Projectivy → Appearance → Wallpaper → **Wallpaparr**. Server URL: `http://YOUR_LAN_IP:8787`.

Package: `com.imanunator.wallpaparr`  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`

**SeerChannel** (Preview Channel rows) is **not** in this suite. Install [SeerChannel](https://github.com/iManunator/SeerChannel) separately if you want home-screen rows.

## Architecture

| Piece | Path | Role |
| --- | --- | --- |
| Backend | `backend/` | Generate, catalog, cron, Projectivy HTTP API |
| Web UI | `web/` | Layout editor, gallery, generate, settings |
| Plugin | `plugin/` | Projectivy wallpaper provider (`com.imanunator.wallpaparr`) |

`GET /api/wallpaper/status` stays compatible with the older TV Background Suite plugin (`imageUrl`, `actionUrl`, `path`, optional `mediaType`/`videoUrl`) and adds `parallaxStyle` / `motionDuration` when a clip exists. See [docs/API.md](docs/API.md).

## Options

Web UI and the plugin cover pick modes (random/latest/rating/year, watch/library/Seerr pools, mix/round-robin, no-repeat), filters, parallax motion, providers + tests, cron skip/replace/cleanup/ids, and client deep links (Jellyfin, Moonfin, …).

## Credits

- Projectivy wallpaper plugin contract: [spocky/projectivy-plugin-wallpaper-provider](https://github.com/spocky/projectivy-plugin-wallpaper-provider)
- Prior WebGUI / plugin work: [iManunator/androidtvbackgroundWebGui](https://github.com/iManunator/androidtvbackgroundWebGui), [iManunator/projectivy-tvbgsuite-plugin](https://github.com/iManunator/projectivy-tvbgsuite-plugin)
- Channels (separate): [iManunator/SeerChannel](https://github.com/iManunator/SeerChannel)
