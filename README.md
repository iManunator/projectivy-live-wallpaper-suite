# Wallpaparr

Cinematic **Projectivy** wallpapers — stills and optional **parallax VIDEO** loops — from Jellyfin and Jellyseerr/Seerr. An *arr-family product: generate, queue, and serve tonight’s home screen.

This GitHub repository may still be named `projectivy-live-wallpaper-suite`; the product is **Wallpaparr**.

**Version:** 1.1.0 — [CHANGELOG.md](CHANGELOG.md) · [Verify (no Jellyfin)](docs/VERIFY.md) · [Install](docs/INSTALL.md) · [Parallax / IMAGE vs VIDEO](docs/MOTION.md) · [Overlay widgets](docs/OVERLAYS.md)

![Tonight’s home screen](docs/screenshots/tonight.svg)
![Gallery with smart-queue badges](docs/screenshots/gallery.svg)
![Health dashboard](docs/screenshots/dashboard.svg)

## Show off in 5 minutes (demo fixtures, no Jellyfin)

1. `./scripts/verify.sh` — builds the Dockerfile (`pull_policy: build`, no GHCR required), waits for health, curls demo wallpaper status.
2. Open http://127.0.0.1:8787 — **Tonight** is the home page. You should see a 16:9 Projectivy chrome overlay (clock / rows / dock) over a demo title.
3. Click **Netflix Hero**, **Prime Cinematic**, **Google TV Clean**, or **Projectivy Dock** to preview layout DNA. **Shuffle tonight** draws another title from the taste mix.
4. **Generate** → source `Demo catalog` → enable *Bake parallax / motion VIDEO* if ffmpeg is in the image → Run batch. Gallery badges show Unwatched / Continue / Requestable / VIDEO.
5. Pin or Never-show a title in the gallery; **Dashboard** shows gallery size, last cron, and provider configuration.

```bash
curl -sf http://127.0.0.1:8787/api/health
# {"ok":true,"service":"wallpaparr","version":"1.1.0"}

curl -sf "http://127.0.0.1:8787/api/wallpaper/status?layout=Netflix%20Hero&profile=tonight"
curl -sf "http://127.0.0.1:8787/api/tonight?layout=Projectivy%20Dock"
curl -sf http://127.0.0.1:8787/api/dashboard
```

Unit tests (no Docker): `./scripts/test.sh` (creates `backend/.venv` on PEP 668 systems).

## Install

### Server

```bash
git clone https://github.com/iManunator/projectivy-live-wallpaper-suite.git
cd projectivy-live-wallpaper-suite
mkdir -p data
cp -n config.example.json data/config.json || true
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

Then Projectivy → Appearance → Wallpaper → **Wallpaparr**. Server URL: `http://YOUR_LAN_IP:8787`. Pick mode **Tonight’s mix** uses the suite taste profile.

Package: `com.imanunator.wallpaparr`  
UUID: `dba9a12f-6252-4172-b5a3-8668d0523afb`

**SeerChannel** (Preview Channel rows) is **not** in this suite. Install [SeerChannel](https://github.com/iManunator/SeerChannel) separately if you want home-screen rows.

## Architecture

| Piece | Path | Role |
| --- | --- | --- |
| Backend | `backend/` | Generate, catalog, smart queues, taste, cron, Projectivy HTTP API |
| Web UI | `web/` | Tonight preview, gallery, layout editor, generate, health, settings |
| Plugin | `plugin/` | Projectivy wallpaper provider (`com.imanunator.wallpaparr`) |

`GET /api/wallpaper/status` stays compatible with the older TV Background Suite plugin (`imageUrl`, `actionUrl`, `path`, optional `mediaType`/`videoUrl`) and adds `parallaxStyle` / `motionDuration` / `queue` / `pinned` when relevant. See [docs/API.md](docs/API.md).

## Options

| Area | What you can set |
| --- | --- |
| Layout DNA | Netflix Hero, Prime Cinematic, Google TV Clean, Projectivy Dock (safe zones), plus custom layouts |
| Smart queues | Unwatched, Continue watching, Newly added, Seerr trending, Requestable, Pinned |
| Taste profiles | tonight / unwatched_heavy / cinephile / discovery, with editable weights |
| Pin / never-show | Gallery flags; hidden titles never enter `/status` |
| No-repeat | Plugin exclude bag (recent paths decay as new ones arrive) |
| Motion | parallax / kenburns / drift · Subtle / Cinematic / Bold · optional light-leak layer · still fallback |
| Overlays | Off by default; optional clock card + HA/news/JSON hooks ([OVERLAYS.md](docs/OVERLAYS.md)) |
| Plugin | Tonight’s mix, continue watching, newly added, Seerr trending, pinned, plus the original sort/pool/mix modes |
| Cron | skip / replace / cleanup / ids / motion |

## Credits

- Projectivy wallpaper plugin contract: [spocky/projectivy-plugin-wallpaper-provider](https://github.com/spocky/projectivy-plugin-wallpaper-provider)
- Prior WebGUI / plugin work: [iManunator/androidtvbackgroundWebGui](https://github.com/iManunator/androidtvbackgroundWebGui), [iManunator/projectivy-tvbgsuite-plugin](https://github.com/iManunator/projectivy-tvbgsuite-plugin)
- Channels (separate): [iManunator/SeerChannel](https://github.com/iManunator/SeerChannel)
