# Parallax / live VIDEO wallpapers

Projectivy wallpaper plugins return **one** wallpaper at a time. The AIDL type is either:

| Type | Constant | What this suite serves |
| --- | --- | --- |
| **IMAGE** | `0` | JPEG still (`imageUrl` → `/api/wallpaper/image/{layout}/{file}.jpg`) |
| **VIDEO** | `4` | Looping H.264 MP4 (`videoUrl` → same path with `.mp4`) |

Projectivy does **not** composite depth layers itself. A “parallax wallpaper” is therefore a **baked VIDEO**: ffmpeg animates an artwork plate under nearly-still metadata chrome, muxed as `yuv420p` + `+faststart` so Android TV can loop it.

## IMAGE vs VIDEO in this suite

1. **Generate always writes a JPEG.** Stills remain first-class. The gallery, in-page editor preview, and `imageUrl` never go away. Jellyfin stills composite over downloaded Backdrop (then Primary) art.
2. **Motion is optional.** Enable *Generate VIDEO loops* in Settings, check *Bake parallax / motion VIDEO* on a batch, or `POST /api/wallpaper/generate-motion`.
3. **`GET /api/wallpaper/status`** (tvbgsuite-compatible) always returns `imageUrl` + `actionUrl` + `path` when a title is selected. When a sibling MP4 exists:
   - `videoUrl` is set
   - `mediaType` is `"video"`
   - extra fields: `parallaxStyle` (`parallax` \| `kenburns` \| `drift`), `motionDuration` (seconds)
4. **The plugin chooses.** *Prefer parallax / motion VIDEO* uses `videoUrl` when present. *Fallback to still JPEG* uses `imageUrl` if the MP4 is missing. Projectivy then plays IMAGE or VIDEO accordingly.

```
status ──imageUrl──► JPEG  ──► WallpaperType.IMAGE
      └─videoUrl──► MP4   ──► WallpaperType.VIDEO   (if prefer-motion)
```

## Styles

| Style | Look |
| --- | --- |
| **parallax** (default) | Artwork Ken-Burns on a plate; chrome (vignette + title/meta) overlays with a much smaller pan → depth |
| **kenburns** | Single composite still, classic slow zoom/pan |
| **drift** | Same as Ken Burns with a larger pan and tiny zoom |

Intensity presets **Subtle / Cinematic / Bold** (0.28 / 0.55 / 0.88), duration (2–20s), fps (12–30), and quality (`light` / `standard` / `cinematic`) are Settings fields. Parallax may add a third **light-leak** lavfi layer. Unknown styles (including the typo “parrallelx”) normalize to **parallax**.

## Bake pipeline

```
render_plate (RGB art)     ─┐
                            ├─ ffmpeg zoompan + overlay ─► title.mp4
render_chrome (RGBA text)  ─┘
render_still  ─► title.jpg     (always)
```

Requires `ffmpeg` in the image (`libx264`). If ffmpeg is missing, generation still succeeds with the JPEG.

## Plugin / TV notes

- Set Projectivy’s wallpaper interval; the plugin answers `TimeElapsed` and optional idle-exit refresh.
- `PUBLIC_BASE_URL` must be a LAN URL the TV can reach. The plugin rewrites `127.0.0.1` / `localhost` image URLs to the configured server.
- Video loops are 1080p H.264 Main @ L4.0, no audio, faststart — aimed at Android TV / Google TV.
