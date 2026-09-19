# Install Wallpaparr

SeerChannel (Preview Channel rows) is **not** part of this suite. Wallpaparr ships the **wallpaper server** + **Projectivy wallpaper plugin APK**. For home-screen rows, install [SeerChannel](https://github.com/iManunator/SeerChannel) separately.

The GitHub repository may still be named `projectivy-live-wallpaper-suite`. The product, image, and APK are **Wallpaparr**.

## Downloads

| Artifact | Where |
| --- | --- |
| **Plugin APK** | [`wallpaparr-plugin-release.apk`](https://github.com/iManunator/projectivy-live-wallpaper-suite/releases/latest/download/wallpaparr-plugin-release.apk) on the [GitHub Release](https://github.com/iManunator/projectivy-live-wallpaper-suite/releases/latest) |
| **Container** | [`ghcr.io/imanunator/wallpaparr`](https://github.com/iManunator/projectivy-live-wallpaper-suite/pkgs/container/wallpaparr) (`:latest` from `main`, `:1.1.0` from tag `v1.1.0`) |

Packaging, `packages: write`, and the exact tag command: **[RELEASE.md](RELEASE.md)**.

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

### Tag a GitHub Release (GHCR + APKs)

**`v1.1.0` is already tagged.** [Release](https://github.com/iManunator/projectivy-live-wallpaper-suite/releases/tag/v1.1.0) has **`wallpaparr-plugin-release.apk`**; GHCR has `:v1.1.0` / `:1.1.0` / `:latest`. Do not retag `v1.1.0`.

`.github/workflows/release.yml` runs on future `v*` tags: pushes `ghcr.io/imanunator/wallpaparr:<tag>` and `:latest` (`packages: write`), then attaches **`wallpaparr-plugin-release.apk`** (and debug) to a GitHub Release (`contents: write`). Details: [RELEASE.md](RELEASE.md).

```bash
git checkout main
git pull origin main
git tag -a v1.1.1 -m "Wallpaparr 1.1.1"   # next version only
git push origin v1.1.1
```

Merges to **main** also run CI, which pushes GHCR `:latest` when the event is not a pull request.

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

Download **one** of (prefer the Release — Actions artifacts expire):

- GitHub **Release** asset (primary): [`wallpaparr-plugin-release.apk`](https://github.com/iManunator/projectivy-live-wallpaper-suite/releases/latest/download/wallpaparr-plugin-release.apk)
- GitHub **Actions** artifact **`wallpaparr-plugin-apk`** (same filenames; ephemeral)
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
Jellyfin batches download **Backdrop**, then **Primary**, so titles get real library art instead of a gradient with metadata only. Use **Replace existing** to rebuild stills that were generated before that fetch existed.

**Editor** stays an in-page 16:9 stage. With Jellyfin connected, pick a title under **Jellyfin preview** to place layers on the real backdrop. Click a generated still in **Gallery** (or the strip under the editor) for a full-screen view.

Cron lives under **Settings**. Skip/replace matches Jellyfin, TMDB, and IMDb ids.

## Migrating from TV Background Suite

The older plugin (`com.butch708.projectivy.tvbgsuite`) talked to Flask on port **5000**. Wallpaparr uses **8787** and `com.imanunator.wallpaparr`, so both can be installed side by side. `/api/wallpaper/status` query params stay compatible.
