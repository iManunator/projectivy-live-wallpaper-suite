# Wallpaper HTTP API

Compatible with the Projectivy TV Background Suite plugin (`/api/wallpaper/status` + list endpoints). All list endpoints return JSON arrays of strings.

## `GET /api/layouts/list`

Saved + bundled layout names.

## `GET /api/layouts/with-images`

Layout names that currently have generated JPEGs. The plugin prefers this when choosing a folder.

## `GET /api/genres/list` · `GET /api/ages/list` · `GET /api/year/list`

Distinct values harvested from the wallpaper catalog (not live Jellyfin). Rebuild/generate so filters stay current.

## `GET /api/wallpaper/status`

| Query | Notes |
| --- | --- |
| `layout` | Collection folder / layout name |
| `genre` | Comma-separated; substring match |
| `age_rating` / `age` | Comma-separated; alphanumeric-normalized (`PG-13` ≡ `pg13`) |
| `min_year` / `max_year` | Inclusive |
| `min_rating` / `max_rating` | Inclusive, 0–10 |
| `sort` | `random` (default), `latest`/`newest`, `oldest`, `rating`/`rating_high`, `rating_asc`/`rating_low`, `year`/`year_desc`, `year_asc`/`year_old` |
| `pool` | `unwatched`, `partial`/`continue_watching`, `watched`, `in_library`, `seerr_only`/`not_in_library`, `requestable`, `available`, `pinned`, `newly_added`, `taste:<profile>`, `source:jellyfin`, `source:jellyseerr`/`source:seerr`, `source:plex` |
| `exclude` | Comma-separated paths/filenames recently shown (no-repeat bag) |
| `queue` | Smart queue id (`unwatched`, `continue_watching`, `newly_added`, `seerr_trending`, `requestable`, `pinned`) — maps to pool/sort |
| `profile` | Taste profile (`tonight`, `unwatched_heavy`, `cinephile`, `discovery`) |

If a pool/filter would empty the set, the server **falls back** to the unfiltered layout (same as the legacy WebGUI). If every item is excluded and only one remains, exclude is ignored.

Response:

```json
{
  "imageUrl": "http://host:8787/api/wallpaper/image/Netflix%20Hero/northlight-demo.jpg",
  "videoUrl": "http://host:8787/api/wallpaper/image/Netflix%20Hero/northlight-demo.mp4",
  "mediaType": "video",
  "actionUrl": "jellyfin://items/…",
  "title": "Northlight",
  "path": "northlight-demo.jpg",
  "sort": "random",
  "pool": "unwatched",
  "layout": "Netflix Hero",
  "parallaxStyle": "parallax",
  "motionDuration": 6.0,
  "queue": "unwatched",
  "pinned": false
}
```

Compatibility: `imageUrl`, `actionUrl`, and `path` are unchanged from tvbgsuite. `mediaType` / `videoUrl` were already optional. `parallaxStyle`, `motionDuration`, `queue`, and `pinned` are **additive**. Hidden (`never-show`) titles are omitted from selection. The `pinned` pool does **not** fall back to the whole layout if empty. The plugin decides IMAGE vs VIDEO; see [MOTION.md](MOTION.md).

`GET /api/options` lists pick modes, pools, motion styles/presets, taste profiles, queues, and preferred clients.

## Editor / ops endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness (`ok`, `service`, `version`) |
| GET/POST | `/api/layouts/save`, `/api/layouts/load/{name}` | Layout JSON |
| GET | `/api/gallery` | Catalog |
| POST | `/api/gallery/{id}/flag` | `{ "pinned": true }` / `{ "hidden": true }` never-show |
| GET | `/api/media` | Live items from `source` (`demo`, `jellyfin`, `jellyseerr`). Query `limit`. |
| GET | `/api/media/artwork/{item_id}` | Demo stills (NASA/NARA/LoC + CC BY-SA Kew) or Jellyfin Backdrop/Primary. Query `kind=backdrop` (default) or `kind=poster`. Sniffs magic bytes; 404 if Jellyfin is unset and the id is not a demo still. |
| GET | `/api/demo/catalog` | License, artist, Commons URL for each demo still. |
| GET | `/api/demo/attribution` | Markdown attribution file. |
| GET | `/api/queues` | Smart-queue counts for a layout |
| GET | `/api/tonight` | Taste pick + queues + motion snapshot for the Tonight UI |
| GET | `/api/dashboard` | Health: gallery size, last cron/generate, provider config |
| POST | `/api/generate` | Batch generate (`skip_existing`, `replace_existing`, `cleanup`, `motion`, `ids`, `skip_ids`) |
| POST | `/api/wallpaper/generate-motion` | Re-bake parallax/Ken Burns MP4s for a layout |
| GET/POST | `/api/settings` | Providers, cron, motion style/preset/intensity/duration/light-leak, taste profile, overlay flags, editor theme |
| POST | `/api/settings/test/{jellyfin\|jellyseerr\|tmdb}` | Connectivity |

`POST /api/settings/test/{jellyfin|jellyseerr|tmdb|demo}` returns `{ ok, server?, error?, provider, message }` where `message` is toast copy (“Connected to Jellyfin (Living Room)” / “Could not reach Jellyfin: …”).

`POST /api/generate` downloads artwork before compositing. For Jellyfin that is **Backdrop**, then **Primary** poster, using the same MediaBrowser token as the library call. Non-image bodies are skipped. If neither image is reachable, demo titles use bundled stills; other titles fall back to the synthetic gradient. Unconfigured Jellyfin/Seerr uses the demo catalog and sets `warnings`. The JSON also includes `message`, `failed`, and `warnings` for the web UI toasts. `ids` search pulls at least 40 titles so a requested id is not missed because it sat past `limit`.

The editor does not go fullscreen: it loads `/api/media/artwork/{item_id}` onto the in-page 16:9 stage (demo catalog or Jellyfin). Layout JSON now persists `gradient_type`, `gradient_angle`, `gradient_opacity`, `gradient_stops`, `vignette`, `overlay_color`, and `overlay_opacity` in addition to the original edge fades. Gallery stills open in a lightbox.
