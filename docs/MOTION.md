# Parallax / live VIDEO wallpapers

Projectivy wallpaper plugins return **one** wallpaper at a time. The AIDL type is either:

| Type | Constant | What this suite serves |
| --- | --- | --- |
| **IMAGE** | `0` | JPEG still (`imageUrl` → `/api/wallpaper/image/{layout}/{file}.jpg`) |
| **VIDEO** | `4` | Looping H.264 MP4 (`videoUrl` → same path with `.mp4`) |

Projectivy does **not** composite depth layers itself. A “parallax wallpaper” is therefore a **baked VIDEO**: ffmpeg animates an artwork **plate** under **static** metadata chrome, muxed as `yuv420p` + `+faststart` so Android TV can loop it.

## Layers (the model)

Treat every wallpaper as two layers. Intensity presets only change the **background**.

| Layer | Content | Motion |
| --- | --- | --- |
| **Background** | Backdrop / still art (the plate), optional padded light-leak | Subtle pan / zoom / parallax drift. Subtle / Cinematic / Bold change amplitude and loop length. |
| **Foreground / target** | Logo or title text, watch badges, Seerr/requestable chips, metadata, overlay widgets, **and static atmosphere** (vignette, letterbox shadows, edge gradients) | **Static.** Pinned in layout DNA / safe-zone coordinates. Never Ken-Burns with the plate. |

IMAGE stills can bake chrome into the JPEG (nothing moves). VIDEO **must** keep chrome locked: animate the plate, then overlay the chrome PNG each frame.

Watch status (**Unwatched** / **Continue** / **Watched**) is part of that locked chrome when `watch_state` is known. Layout DNA `show_watch_badge` defaults on; turn it off in the editor to omit the pill from stills and VIDEO. Pills are capsules with equal padding so the label is centered on 16:9 chrome.

Seerr / requestable status uses the same locked layer. When a title is **not in the library**, a chip paints next to the watch pill from existing catalog fields (`library_state`, `availability`, `source`):

| Metadata | Chrome label |
| --- | --- |
| `library_state` `seerr_only` / `not_in_library` | **Seerr only** |
| `availability` `requestable` / `not_available` | **Requestable** |
| Seerr source and not in library | **On Seerr** |

In-library titles skip the chip. Layout DNA `show_seerr_badge` defaults on; turn it off in the editor to hide it from stills and VIDEO. Demo **Signal Country** is the mixed Seerr-only / requestable fixture.

## IMAGE vs VIDEO in this suite

1. **Generate always writes a JPEG.** Stills remain first-class. The gallery, in-page editor preview, and `imageUrl` never go away. Jellyfin stills composite over downloaded Backdrop (then Primary) art.
2. **Motion is optional.** Enable *Generate VIDEO loops* in Settings, check *Bake parallax / motion VIDEO* on a batch, tap **Bake motion for this pick** on Tonight (or **this layout** on Generate / the editor), or `POST /api/wallpaper/generate-motion` (`path=` = one filename).
3. **`GET /api/wallpaper/status`** (tvbgsuite-compatible) always returns `imageUrl` + `actionUrl` + `path` when a title is selected. When a sibling MP4 exists:
   - `videoUrl` is set
   - `mediaType` is `"video"`
   - extra fields: `parallaxStyle` (`parallax` \| `kenburns` \| `drift`), `motionDuration` (seconds)
4. **The plugin chooses.** *Prefer parallax / motion VIDEO* uses `videoUrl` when present. *Fallback to still JPEG* uses `imageUrl` if the MP4 is missing. Projectivy then plays IMAGE or VIDEO accordingly.

```
status ──imageUrl──► JPEG  ──► WallpaperType.IMAGE
      └─videoUrl──► MP4   ──► WallpaperType.VIDEO   (if prefer-motion)
```

`videoUrl` is set only when a real MP4 exists on disk.

## Styles

Styles describe **how the background moves**. Chrome stays locked for every style.

| Style | Background look |
| --- | --- |
| **parallax** (default) | Stronger Ken-Burns on the plate; optional light-leak wash **under** locked chrome. Chrome overlay `x=0,y=0`. |
| **kenburns** | Classic slow zoom/pan of the **artwork plate**, then the same static chrome overlay. Never zoompan a text-burned JPEG. |
| **drift** | Larger pan, tiny zoom of the plate; chrome still pinned. |

Intensity presets **Subtle / Cinematic / Bold** (0.16 / 0.55 / 0.96) change **background** zoom and pan enough to see on a TV (same amplitude as the CSS preview). Duration defaults are longer (quality `light` / `standard` / `cinematic` ≈ 8 / 12 / 16s, clamp 2–24s). Bake uses a **CSS-like ping-pong** (ease in at the start, peak mid-loop, ease out to a seamless join) — it does **not** zoom out past the cover crop. Plate motion is 2× lanczos, `zoompan` at 2× (nearest-neighbour), then lanczos-down, default **30 fps**, H.264 Main @ L4.0 `yuv420p` `+faststart`. Parallax may add a third **light-leak** lavfi layer on the **background** (padded so it cannot uncover the frame edge — not title chrome, not vignette). Unknown styles (including the typo “parrallelx”) normalize to **parallax**.

The web UI plays a **CSS motion preview** of the same layered model on Tonight, the layout editor, Generate, Settings, and the **Gallery lightbox**. Grid thumbs stay static JPEGs. Opening a gallery item plays the baked sibling MP4 when it exists (looping, muted; chrome already in the file). If there is no clip, the lightbox pans the artwork plate and keeps title/logo/badges locked in `.stage-fg` — it does not Ken-Burns the composited JPEG. A failed VIDEO load toasts and falls back to that CSS preview. The CSS loop returns to the start frame (no bounce). That preview is not what Projectivy plays — bake a VIDEO (ffmpeg) for the real loop. Projectivy **IMAGE** is the JPEG; **VIDEO** is only advertised when the sibling MP4 exists (`videoUrl` stays null otherwise).

## Editor preview size

The 16:9 stage is **contained** in its panel (`object-fit: contain` behavior):

- `.stage-frame` is `width: 100%`, centered, `overflow: hidden` so the stage cannot cause horizontal scroll.
- The 16:9 box is `width: min(100%, calc(var(--stage-max-height) * 16 / 9))` with `--stage-max-height: min(68dvh, calc(100dvh - chrome))` (tighter on small screens).
- Artwork inside the stage uses `object-fit: cover`; the **stage** letterboxes in the panel, not the wallpaper inside the stage.

Frontend tests in `web/src/lib/stage.test.ts` lock this contract (no parent overflow, 16:9 aspect, CSS contain rules).

## Bake pipeline

```
render_plate (RGB art, no vignette)  ─┐
                                      ├─ ffmpeg 2× lanczos → ping-pong zoompan @2× → lanczos 1080p
optional light-leak (padded, under)  ─┤     + overlay(chrome @ 0,0) ─► title.mp4
render_chrome (RGBA logo/text/pills   ─┘
              + locked vignette / letterbox / edge fades)
render_still  ─► title.jpg     (always; chrome baked static)
```

Requires `ffmpeg` in the image (`libx264`). If ffmpeg is missing, generation still succeeds with the JPEG.

The Ken Burns path matches the editor CSS loop: zoom **in** only (never below the cover crop), ping-pong ease (`sin(πt)²`, not a bipolar `sin(2πt)` zoom-out), zoom/pan amplitude from the same `--motion-zoom-*` / `--motion-x` numbers as `web/src/lib/motion.ts`, default **30 fps**. ffmpeg `zoompan` has **no interpolator** (nearest-neighbour), so the plate is lanczos-scaled to **2×**, Ken-Burned at 2×, then lanczos-down to 1080p. Quality presets pick an x264 speed (`fast` / `medium` / `slow`) and a higher bitrate (2.8 / 4 / 5.5 Mbps) but always emit **H.264 Main 4.0 yuv420p +faststart** for Projectivy / Android TV. Duration defaults stay 8 / 12 / 16s (quality) so the loop is not shorter than the CSS preview.

**Do not** Ken-Burns the composited JPEG. A later “Bake motion” pass re-fetches the original backdrop (demo still or Jellyfin Backdrop/Primary) as the plate. Additive bake fields: `layered`, `chrome_locked`.

## Plugin / TV notes

- Set Projectivy’s wallpaper interval; the plugin answers `TimeElapsed` and optional idle-exit refresh.
- `PUBLIC_BASE_URL` must be a LAN URL the TV can reach. The plugin rewrites `127.0.0.1` / `localhost` image URLs to the configured server.
- Video loops are 1080p H.264 Main @ L4.0, no audio, faststart — aimed at Android TV / Google TV.
