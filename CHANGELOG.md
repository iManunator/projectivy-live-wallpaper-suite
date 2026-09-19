# Changelog

## Unreleased

Tonight is a one-pick preview: what Projectivy will show next, with bake / editor / refresh as the only primary actions.

- **Tonight page.** Hero is tonight’s 16:9 pick (moving artwork, locked Projectivy chrome) with a one-line purpose: the wallpaper from Tonight’s mix (`taste:<profile>`), not the gallery. Primary actions are **Bake motion for this pick**, **Open in editor**, and **Refresh pick**. Layout DNA (“Launcher look”) and Subtle/Cinematic/Bold preview intensity sit below the hero. Taste weights and queue counts are a compact mix line (edit in Settings). Bake-for-this-layout stays on Generate and the editor. Watch / Seerr chrome uses the same `ChromePills` as the editor and gallery.
- **Editor seed.** Opening the editor from Tonight loads the layout you were previewing.
- **Smoother baked VIDEO.** Batch MP4 Ken Burns now tracks the in-UI CSS preview: ping-pong ease (no zoom-out half-cycle), zoom/pan amplitude from the same CSS variables, default **30 fps**, quality loops 8 / 12 / 16s. ffmpeg `zoompan` is nearest-neighbour, so the plate Ken-Burns at **2×** then lanczos-down. Quality presets use x264 `fast`/`medium`/`slow` at 2.8 / 4 / 5.5 Mbps. Still H.264 Main @ L4.0 `yuv420p` `+faststart`. Chrome stays locked; stills unchanged.
- **Motion bake locks vignette / letterbox.** Batch create VIDEO and one-tap bake keep shadows, vignette, and edge fades pinned like the CSS preview (`.stage-fg`). Root cause: default parallax composited a same-size light-leak **on top of** chrome and panned it, which uncovered the frame edge and made atmosphere Ken-Burns with the plate. Leak is now padded and drawn **under** locked chrome; fade/vignette outer pixels are opaque. Projectivy `imageUrl` / `videoUrl` contract unchanged.
- **Docker gallery bind-mount (EXDEV).** Motion bake no longer fails with `[Errno 18] Invalid cross-device link` when promoting `/tmp` MP4 output onto `/data/gallery` (bind-mounted volume). Shared `promote_temp` uses `shutil.move` (rename, or copy2 + unlink across devices).
- **Gallery bulk delete.** Toolbar has Select all / Clear selection, a live selected count, **Delete selected**, and **Delete all**. Confirms spell out the count and that the action cannot be undone; success and failure toasts cover mobile and desktop. Delete all **skips pinned** stills by default (with a note) and offers **Delete all including pins** as an explicit danger option — pins are never wiped silently. Pin / never-show stay on each card and in the lightbox. Additive `POST /api/gallery/delete-all` (`include_pins`, optional `layout`); `POST /api/gallery/delete` also accepts `{ "all": true }`. Empty gallery and missing files return clear JSON, not crashes. Wallpaper `status` / list endpoints are unchanged.
- **Gallery lightbox motion.** Opening a still plays the baked sibling MP4 when `has_video` (looping, muted). If there is no clip, the lightbox uses the same layered CSS preview as the editor (artwork plate pans; logo/title/badges stay locked) — not Ken Burns of the flat JPEG. Grid thumbs stay static. Video load failure toasts and falls back to the CSS preview.

Layered parallax: the 16:9 editor stage always fits its panel, CSS/ffmpeg motion pans **artwork only**, and logo/title/badges stay pinned.

- **Editor preview size.** The 16:9 stage uses object-fit:contain sizing (`width: min(100%, calc(max-height * 16/9))`, max-height from remaining viewport). Centered; no page blowout or horizontal scroll from the stage on phone or desktop.
- **Layered motion.** Background plate Ken-Burns / pans / drifts. Foreground chrome (logo, title, watch badges, Seerr/requestable chips, metadata, overlay widgets, **vignette / letterbox / edge fades**) is static in layout DNA coordinates. Subtle / Cinematic / Bold change background amplitude only.
- **Bake pipeline.** VIDEO is `2× lanczos → ping-pong zoompan(plate @2×) → lanczos 1080p [+ padded light-leak under chrome] + overlay(chrome at 0,0)`. Ken Burns and drift no longer zoompan a text-burned JPEG. Vignette, letterbox shadows, and edge fades live on the locked chrome PNG — they do not pan with the plate (a same-size light-leak overlay used to uncover the frame edge and look like a crawling vignette). “Bake motion” re-fetches original artwork instead of using the composited still as the plate. `videoUrl` still only when an MP4 exists. Additive bake fields `layered` / `chrome_locked`.
- **Watch status on the wallpaper.** Unwatched / Continue / Watched paint as fixed chrome on IMAGE stills and VIDEO overlays (not the moving plate). Layout DNA `show_watch_badge` (default on) can hide the pill. Pills use equal padding and a capsule so the label sits centered on 16:9 TV-safe chrome.
- **Seerr / requestable chrome.** Titles that are only on Seerr (not in the library) get an explicit **Seerr only** / **Requestable** / **On Seerr** chip next to the watch pill, on the same locked-chrome layer. Layout DNA `show_seerr_badge` defaults on when status is known. Additive wallpaper status fields: `libraryState`, `availability`, `seerrStatus`, `source`.
- **Generate progress.** Batch / cron / motion bake run as pollable jobs (`POST /api/jobs`, `GET /api/jobs/{id}`, `GET /api/jobs/latest`) with a progress bar, `3/12` count, current title, and success/fail toasts. Sync generate endpoints remain.
- **Gallery delete.** Pin, never-show, and delete are on each card and in the lightbox. Multi-select delete is available. `DELETE /api/gallery/{id}` and `POST /api/gallery/delete` remove the JPEG, companion MP4 / plate / chrome, and catalog row.
- CSS preview (Tonight, Editor, Generate, Settings) mirrors the bake: `.stage-bg` moves, `.stage-fg` does not.
- Docs: [MOTION.md](docs/MOTION.md). Frontend contain tests in `web/src/lib/stage.test.ts`.

## 1.2.0

Flagship editor, motion preview, connection toasts, license-safe cinematic demo catalog, watch-status pills, cron/batch polish, and more cinematic TV-facing motion bake.

- **Generate** downloads backdrop (then poster) by default, with Jellyfin auth headers. HTML/non-image responses are rejected. Unconfigured Jellyfin/Seerr falls back to the demo catalog **with a warning**, instead of failing silently. Ids that sit past the first `limit` titles are still found (id batches pull up to 200).
- Jellyfin items request `ImageTags`. Missing Backdrop uses Primary/Thumb so poster-only titles still render.
- **Editor** is a 16:9 Projectivy stage: linear/radial multi-stop gradients, angle, opacity, vignette, overlay wash, four-edge fades, look DNA chips, draggable metadata, TV chrome / safe-zone guides. Demo or Jellyfin artwork. Save persists the layout JSON.
- **Watch-status badges** (Unwatched / Continue / Watched) on gallery thumbs, lightbox, editor stage/strip, and Tonight when metadata exists. Demo fixtures already carry mixed states. Flagship layouts (Netflix Hero, Prime Cinematic, Google TV Clean, Projectivy Dock) plus Status Focus / Jellyfin Dense paint a pill on the still itself.
- **Streaming layout DNA** chips: Netflix Hero, Prime Cinematic, Google TV Clean, Projectivy Dock, Status Focus, Jellyfin Dense — on Tonight and in the editor.
- **Motion preview** (CSS Ken Burns / parallax / drift) on Tonight, Editor, Generate, and Settings — Subtle / Cinematic / Bold now change zoom, pan, and loop length clearly, with a seamless (non-bounce) CSS loop. Baked ffmpeg VIDEO is still what Projectivy plays.
- **Bake motion UX:** one-tap **Bake motion for tonight’s pick** or **this layout** from Tonight, Generate, and the editor. `POST /api/wallpaper/generate-motion?layout=&path=` bakes one still. `videoUrl` is set only when a real MP4 exists.
- Longer TV loops: quality defaults 8 / 12 / 16s (up to 24s). Intensity presets Subtle `0.16` / Cinematic `0.55` / Bold `0.96` scale zoom and pan so the three looks are distinct on the TV.
- **Toasts** for provider tests, generate, motion bake, and cron run-now: “Connected to Jellyfin (Living Room)” / failure reasons / “Created 6 stills for Netflix Hero” / bake summaries. Success and error notices work on mobile and desktop (44px close target, safe-area insets, Esc / tap-outside / close, contrast above the editor stage).
- **Movie / series logos.** Layout DNA `title_display`: `auto` \| `logo` \| `text`. Jellyfin `Images/Logo` (MediaBrowser token), TMDB/Seerr `logos` (English/null iso, PNG). Smart resize (~1200×450, shorter cap for tall/square marks), luminance contrast, 25px gap before tags, Projectivy clock/dock safe zones. Editor toggles logo vs text live on the 16:9 stage. Stills and parallax chrome both composite the logo. `GET /api/media/logo/{id}` rejects non-images. Demo **Northlight** ships an original clearlogo PNG; other demo titles fall back to the name.
- **Demo catalog** paints NASA / NARA / Library of Congress public-domain stills (plus one CC BY-SA Kew photograph) instead of synthetic-only gradients. Attribution: `backend/app/demo_stills/ATTRIBUTION.md`, `GET /api/demo/catalog`.
- **Gallery** (and the generated strip under the editor) opens stills in a full-screen lightbox (arrows / Esc).
- `GET /api/media/artwork/{item_id}` serves demo stills, then proxies Jellyfin Primary/Backdrop (image sniffing, correct content-type).
- **Cron / batch polish:** layout dropdown, skip vs replace (replace wins), cleanup and id-field copy, **Run now** (`POST /api/cron/run`) with the same generate toast.
- Additive status field `watchState` (`unwatched` / `partial` / `watched` aliases from Jellyfin). Existing `imageUrl` / `videoUrl` / `mediaType` / `path` contract is unchanged.
- Plugin versionName **1.2.0** (`versionCode` 2). Image `ghcr.io/imanunator/wallpaparr:v1.2.0` / `:1.2.0` / `:latest` from the `v1.2.0` tag. Do not retag `v1.1.0`.

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
- Packaging: CI on `main` publishes `ghcr.io/imanunator/wallpaparr:latest` (`packages: write`); `v*` tags attach `wallpaparr-plugin-release.apk` to a GitHub Release

Local verify: demo `sort=latest` is **Northlight**; `./scripts/test.sh` uses `backend/.venv`; `./scripts/verify.sh` falls back to `docker build`/`docker run` without Compose v2.

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
