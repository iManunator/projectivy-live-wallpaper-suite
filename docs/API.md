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
| `pool` | `unwatched`, `partial`, `watched`, `in_library`, `seerr_only`/`not_in_library`, `requestable`, `available`, `source:jellyfin`, `source:jellyseerr`/`source:seerr`, `source:plex` |
| `exclude` | Comma-separated paths/filenames recently shown (no-repeat bag) |

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
  "layout": "Netflix Hero"
}
```

`mediaType` is `"video"` when a sibling MP4 exists; the plugin decides whether to prefer it.

## Editor / ops endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| GET/POST | `/api/layouts/save`, `/api/layouts/load/{name}` | Layout JSON |
| GET | `/api/gallery` | Catalog |
| POST | `/api/generate` | Batch generate (`skip_existing`, `replace_existing`, `cleanup`, `motion`) |
| GET/POST | `/api/settings` | Providers, cron, motion |
| POST | `/api/settings/test/{jellyfin\|jellyseerr\|tmdb}` | Connectivity |

Generate skip/replace matches **Jellyfin / TMDB / IMDb ids** (then title+year).
