"""Parallax / Ken Burns / drift VIDEO loops for Projectivy.

Projectivy wallpaper plugins return either:
  - IMAGE (JPEG URL) — static, or
  - VIDEO (H.264 MP4 URL) — looping live wallpaper.

This module bakes the VIDEO as **layers**:

* **Background** — artwork plate. Subtle pan / zoom / drift (intensity presets).
  Optional parallax light-leak is a padded wash on this layer only.
* **Foreground / target** — logo or title, watch badges, Seerr/requestable chips,
  metadata chrome, **and static atmosphere** (vignette, letterbox shadows, edge
  gradients). Overlay is pinned at layout DNA coordinates (``overlay=x=0:y=0``).
  Chrome never Ken-Burns with the plate.

Do not zoompan a flat JPEG that already has text or vignette burned in — that
makes title and shadows swim. Animate the plate (and optional leak), then overlay
the static chrome PNG each frame.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.fsutil import promote_temp

STYLES = ("parallax", "kenburns", "drift")
QUALITIES = ("light", "standard", "cinematic")
# Distinct enough that Subtle / Cinematic / Bold change the baked loop at a glance.
INTENSITY_PRESETS = {"subtle": 0.16, "cinematic": 0.55, "bold": 0.96}

_BITRATE = {"light": "2800k", "standard": "4000k", "cinematic": "5500k"}
_DEFAULT_DURATION = {"light": 8.0, "standard": 12.0, "cinematic": 16.0}
_PRESET_DURATION = {"subtle": 16.0, "cinematic": 12.0, "bold": 10.0}
_X264_PRESET = {"light": "fast", "standard": "medium", "cinematic": "slow"}
# 30fps 1080p Main@L4.0 is Android TV safe and closer to the CSS preview.
_DEFAULT_FPS = 30
_SUPER_SAMPLE = 2


def intensity_from_preset(name: str | None) -> float:
    return INTENSITY_PRESETS.get((name or "cinematic").strip().lower(), 0.55)


@dataclass(frozen=True)
class MotionProfile:
    style: str = "parallax"
    quality: str = "light"
    intensity: float = 0.55
    duration: float = 12.0
    fps: int = 30
    width: int = 1920
    height: int = 1080
    light_leak: bool = True

    @property
    def frames(self) -> int:
        return max(int(round(self.duration * self.fps)), 2)

    @property
    def bitrate(self) -> str:
        return _BITRATE.get(self.quality, "2800k")

    @property
    def zoom_from(self) -> float:
        """Always ≥ 1 — CSS ``--motion-zoom-from`` never zooms out past the cover crop."""
        return {"parallax": 1.04, "kenburns": 1.015, "drift": 1.015}.get(self.normalized_style(), 1.015)

    @property
    def zoom_to(self) -> float:
        """CSS ``--motion-zoom-to`` (web/src/lib/motion.ts)."""
        i = self.intensity
        style = self.normalized_style()
        if style == "kenburns":
            return round(1 + i * 0.22, 4)
        if style == "drift":
            return round(1 + i * 0.08, 4)
        return round(1 + i * 0.18, 4)

    @property
    def bg_zoom_amp(self) -> float:
        # Floor keeps Subtle parallax zooming *in* when CSS to < from.
        return round(max(0.008, self.zoom_to - self.zoom_from), 4)

    @property
    def bg_pan(self) -> float:
        """CSS ``--motion-x`` as output pixels (drift 7.4%, else 4.8%)."""
        pct = 7.4 if self.normalized_style() == "drift" else 4.8
        return round(self.width * (pct / 100.0) * self.intensity, 2)

    @property
    def fg_pan(self) -> float:
        """Foreground chrome is pinned. Intensity never pans or zooms metadata."""
        return 0.0

    @property
    def super_sample(self) -> int:
        return _SUPER_SAMPLE

    @property
    def x264_preset(self) -> str:
        return _X264_PRESET.get(self.quality, "medium")

    def normalized_style(self) -> str:
        style = (self.style or "parallax").strip().lower()
        return style if style in STYLES else "parallax"


def profile_from_settings(settings) -> MotionProfile:
    quality = str(getattr(settings, "motion_quality", None) or "light").strip().lower()
    if quality not in QUALITIES:
        quality = "light"
    preset = str(getattr(settings, "motion_preset", None) or "cinematic").strip().lower()
    if preset not in INTENSITY_PRESETS:
        preset = "cinematic"
    intensity = intensity_from_preset(preset)
    raw_intensity = getattr(settings, "motion_intensity", None)
    if raw_intensity is not None:
        raw_f = min(1.0, max(0.0, float(raw_intensity)))
        # Honor a custom slider when it diverges from the named preset.
        if abs(raw_f - intensity) > 0.02 and preset == "cinematic" and abs(raw_f - 0.55) > 0.02:
            intensity = raw_f
        elif abs(raw_f - intensity) <= 0.02:
            intensity = raw_f
    intensity = min(1.0, max(0.0, intensity))
    duration = getattr(settings, "motion_duration", None)
    if duration:
        duration_f = float(duration)
    else:
        duration_f = max(_DEFAULT_DURATION[quality], _PRESET_DURATION.get(preset, 12.0))
    duration_f = min(24.0, max(2.0, duration_f))
    fps = int(getattr(settings, "motion_fps", None) or _DEFAULT_FPS)
    fps = min(30, max(12, fps))
    style = str(getattr(settings, "motion_style", None) or "parallax")
    leak = bool(getattr(settings, "light_leak", True))
    return MotionProfile(
        style=style,
        quality=quality,
        intensity=intensity,
        duration=duration_f,
        fps=fps,
        light_leak=leak,
    )


def pingpong_ease(frames: int, clock: str = "n") -> str:
    """0 at loop ends, 1 at midpoint — CSS ease-in-out 0% / 50% / 100%.

    ``sin(2*PI*t)`` zooms *out* for half the clip. Squared half-angle sine does not.
    No commas (ffmpeg filtergraph).
    """
    return f"sin(PI*{clock}/{frames})*sin(PI*{clock}/{frames})"


def zoompan_expr(
    amp: float,
    pan: float,
    frames: int,
    width: int,
    height: int,
    fps: int,
    z0: float = 1.04,
) -> str:
    """Ken-Burns zoompan. Ping-pong ease; no commas inside z/x/y (ffmpeg filtergraph).

    ffmpeg 6 zoompan has no interpolator (nearest-neighbour). Callers should
    run it at 2× and lanczos-down so the path is not stair-stepped.
    """
    ease = pingpong_ease(frames, "on")
    # 0.14 ≈ CSS --motion-y / --motion-x (panY*0.4 vs panX).
    return (
        f"zoompan=z='{z0}+{amp}*{ease}':"
        f"x='iw/2-(iw/zoom/2)+({pan})*{ease}':"
        f"y='ih/2-(ih/zoom/2)+({round(pan * 0.14, 2)})*{ease}':"
        f"d=1:s={width}x{height}:fps={fps}"
    )


def plate_kenburns_filters(profile: MotionProfile) -> str:
    """Cover-crop, lanczos 2×, ping-pong zoompan at 2×, lanczos down (CSS-like)."""
    p = MotionProfile(
        style=profile.normalized_style(),
        quality=profile.quality,
        intensity=profile.intensity,
        duration=profile.duration,
        fps=profile.fps,
        width=profile.width,
        height=profile.height,
        light_leak=profile.light_leak,
    )
    w, h, fps, frames = p.width, p.height, p.fps, p.frames
    ss = max(int(p.super_sample), 1)
    sw, sh = w * ss, h * ss
    # Pan is in zoompan-input pixels; 2× super-sample must scale CSS travel.
    pan = round(p.bg_pan * ss, 2)
    zp = zoompan_expr(p.bg_zoom_amp, pan, frames, sw, sh, fps, z0=p.zoom_from)
    return (
        f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,"
        f"crop={w}:{h},"
        f"scale={sw}:{sh}:flags=lanczos,"
        f"{zp},"
        f"scale={w}:{h}:flags=lanczos"
    )


def leak_geometry(profile: MotionProfile) -> tuple[str, str, int, int]:
    """Oversized light-leak canvas that still covers the frame while it drifts.

    A WxH wash overlaid at a moving x,y uncovers the opposite edge — that reads as
    a vignette / letterbox crawling with the Ken Burns. Pad like CSS ``inset: -18%``
    so the leak stays under chrome and never scrapes the frame.
    """
    w, h, frames = profile.width, profile.height, profile.frames
    pan_x = int(w * 0.12)
    pan_y = int(h * 0.04)
    mx = max(int(w * 0.18), pan_x + 8)
    my = max(int(h * 0.18), pan_y + 8)
    ease = pingpong_ease(frames, "n")
    x = f"{-mx}+{pan_x}*{ease}"
    y = f"{-my}+{pan_y}*{ease}"
    return x, y, w + 2 * mx, h + 2 * my


def max_motion_frame(frames: int) -> int:
    """Frame index where ping-pong ease is at 1 (peak zoom / pan, CSS 50%)."""
    return max(1, int(frames) // 2)


def build_filtergraph(profile: MotionProfile, has_chrome: bool) -> str:
    """Return an ffmpeg -filter_complex (parallax) or -vf (single layer) graph."""
    p = MotionProfile(
        style=profile.normalized_style(),
        quality=profile.quality,
        intensity=profile.intensity,
        duration=profile.duration,
        fps=profile.fps,
        width=profile.width,
        height=profile.height,
        light_leak=profile.light_leak,
    )
    w, h = p.width, p.height
    ken = plate_kenburns_filters(p)
    leak = bool(p.light_leak) and has_chrome and p.style == "parallax"
    if has_chrome:
        # Plate (and optional leak) move. Chrome — including vignette / letterbox —
        # is pinned in layout-DNA pixels and always composited last.
        if leak:
            leak_x, leak_y, _, _ = leak_geometry(p)
            return (
                f"[0:v]{ken}[bg];"
                f"[2:v]format=rgba,colorchannelmixer=aa=0.16[leak];"
                f"[bg][leak]overlay=x='{leak_x}':y='{leak_y}':shortest=1[lit];"
                f"[1:v]scale={w}:{h}:flags=lanczos,format=rgba[fg];"
                f"[lit][fg]overlay=x=0:y=0:shortest=1,format=yuv420p"
            )
        return (
            f"[0:v]{ken}[bg];"
            f"[1:v]scale={w}:{h}:flags=lanczos,format=rgba[fg];"
            f"[bg][fg]overlay=x=0:y=0:shortest=1,format=yuv420p"
        )
    # Artwork-only: never Ken-Burns a text-burned JPEG.
    return f"{ken},format=yuv420p"


def ffmpeg_bin() -> str | None:
    return shutil.which("ffmpeg")


def mp4_path_for(jpg: Path) -> Path:
    return jpg.with_suffix(".mp4")


def has_motion(jpg: Path) -> bool:
    mp4 = mp4_path_for(jpg)
    try:
        return jpg.is_file() and mp4.is_file() and mp4.stat().st_size > 1000
    except OSError:
        return False


def generate_motion(
    jpg: Path,
    *,
    profile: MotionProfile | None = None,
    quality: str | None = None,
    force: bool = False,
    plate: Path | None = None,
    chrome: Path | None = None,
) -> tuple[bool, str]:
    if not jpg.is_file():
        return False, "jpeg missing"
    if not force and has_motion(jpg):
        return True, "already exists"
    ff = ffmpeg_bin()
    if not ff:
        return False, "ffmpeg not found"
    if profile is None:
        quality_n = (quality or "light").strip().lower()
        if quality_n not in QUALITIES:
            quality_n = "light"
        profile = MotionProfile(
            quality=quality_n,
            duration=_DEFAULT_DURATION[quality_n],
            style="kenburns" if not chrome else "parallax",
        )
    use_chrome = bool(chrome and Path(chrome).is_file())
    graph = build_filtergraph(profile, has_chrome=use_chrome)
    # Prefer the artwork plate. Never Ken-Burns the composited JPEG when a plate exists.
    src = plate if plate and Path(plate).is_file() else jpg
    mp4 = mp4_path_for(jpg)
    use_leak = use_chrome and profile.light_leak and "[2:v]" in graph
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        cmd = [
            ff, "-y", "-sws_flags", "lanczos",
            "-loop", "1", "-framerate", str(profile.fps), "-i", str(src),
        ]
        if use_chrome:
            cmd += ["-loop", "1", "-framerate", str(profile.fps), "-i", str(chrome)]
        if use_leak:
            _, _, leak_w, leak_h = leak_geometry(profile)
            cmd += ["-f", "lavfi", "-i", f"color=c=0xff7a3a:s={leak_w}x{leak_h}:r={profile.fps}"]
        if use_chrome:
            cmd += ["-filter_complex", graph]
        else:
            cmd += ["-vf", graph]
        gop = max(profile.fps * 2, 24)
        cmd += [
            "-t", str(profile.duration),
            "-r", str(profile.fps),
            "-c:v", "libx264",
            "-preset", profile.x264_preset,
            "-pix_fmt", "yuv420p",
            "-profile:v", "main",
            "-level", "4.0",
            "-b:v", profile.bitrate,
            "-maxrate", profile.bitrate,
            "-bufsize", "4M",
            "-g", str(gop),
            "-movflags", "+faststart",
            "-an",
            str(tmp_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=480)
        if result.returncode != 0 or not tmp_path.is_file() or tmp_path.stat().st_size < 1000:
            tail = (result.stderr or result.stdout or "ffmpeg failed").strip().splitlines()[-8:]
            return False, " | ".join(tail) or "ffmpeg failed"
        promote_temp(tmp_path, mp4)
        return True, str(mp4)
    except subprocess.TimeoutExpired:
        return False, "ffmpeg timeout"
    finally:
        if tmp_path.exists() and tmp_path != mp4:
            tmp_path.unlink(missing_ok=True)


def choose_delivery(
    *,
    image_url: str | None,
    video_url: str | None,
    prefer_video: bool,
    fallback_still: bool = True,
    media_type: str | None = None,
) -> tuple[str | None, str]:
    """Pick IMAGE vs VIDEO for a client. Always keeps image_url available for fallback."""
    has_video = bool(video_url) and (
        (media_type or "").lower() == "video" or str(video_url).lower().endswith(".mp4")
    )
    if prefer_video and has_video:
        return video_url, "video"
    if image_url:
        return image_url, "image"
    if fallback_still is False and has_video:
        return video_url, "video"
    return None, "image"
