"""Parallax / Ken Burns / drift VIDEO loops for Projectivy.

Projectivy wallpaper plugins return either:
  - IMAGE (JPEG URL) — static, or
  - VIDEO (H.264 MP4 URL) — looping live wallpaper.

This module bakes the VIDEO. The ``parallax`` style keeps metadata chrome
nearly still while the artwork layer breathes and drifts (true depth).
``kenburns`` / ``drift`` animate a single composite still.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

STYLES = ("parallax", "kenburns", "drift")
QUALITIES = ("light", "standard", "cinematic")
INTENSITY_PRESETS = {"subtle": 0.28, "cinematic": 0.55, "bold": 0.88}

_BITRATE = {"light": "2200k", "standard": "3500k", "cinematic": "5000k"}
_DEFAULT_DURATION = {"light": 6.0, "standard": 8.0, "cinematic": 10.0}


def intensity_from_preset(name: str | None) -> float:
    return INTENSITY_PRESETS.get((name or "cinematic").strip().lower(), 0.55)


@dataclass(frozen=True)
class MotionProfile:
    style: str = "parallax"
    quality: str = "light"
    intensity: float = 0.55
    duration: float = 6.0
    fps: int = 24
    width: int = 1920
    height: int = 1080
    light_leak: bool = True

    @property
    def frames(self) -> int:
        return max(int(round(self.duration * self.fps)), 2)

    @property
    def bitrate(self) -> str:
        return _BITRATE.get(self.quality, "2200k")

    @property
    def bg_zoom_amp(self) -> float:
        base = {"parallax": 0.07, "kenburns": 0.045, "drift": 0.02}.get(self.style, 0.05)
        return round(base * (0.45 + self.intensity * 1.1), 4)

    @property
    def bg_pan(self) -> float:
        base = {"parallax": 36.0, "kenburns": 18.0, "drift": 42.0}.get(self.style, 24.0)
        return round(base * (0.4 + self.intensity), 2)

    @property
    def fg_pan(self) -> float:
        # Foreground moves less → depth. Zero-ish at low intensity.
        return round(self.bg_pan * 0.22, 2)

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
    duration_f = float(duration) if duration else _DEFAULT_DURATION[quality]
    duration_f = min(20.0, max(2.0, duration_f))
    fps = int(getattr(settings, "motion_fps", None) or 24)
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


def zoompan_expr(amp: float, pan: float, frames: int, width: int, height: int, fps: int) -> str:
    """Ken-Burns zoompan. No commas inside the z/x/y expressions (ffmpeg filtergraph)."""
    return (
        f"zoompan=z='1+{amp}*sin(2*PI*on/{frames})':"
        f"x='iw/2-(iw/zoom/2)+({pan})*sin(2*PI*on/{frames})':"
        f"y='ih/2-(ih/zoom/2)+({pan * 0.45})*cos(2*PI*on/{frames})':"
        f"d=1:s={width}x{height}:fps={fps}"
    )


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
    w, h, fps, frames = p.width, p.height, p.fps, p.frames
    prep = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
    leak = bool(p.light_leak) and has_chrome and p.style == "parallax"
    if has_chrome and p.style == "parallax":
        bg = zoompan_expr(p.bg_zoom_amp, p.bg_pan, frames, w, h, fps)
        fg_x = f"{p.fg_pan}*sin(2*PI*n/{frames})"
        fg_y = f"{p.fg_pan * 0.4}*cos(2*PI*n/{frames})"
        graph = (
            f"[0:v]{prep},{bg}[bg];"
            f"[1:v]scale={w}:{h},format=rgba[fg];"
            f"[bg][fg]overlay=x='{fg_x}':y='{fg_y}':shortest=1"
        )
        if leak:
            leak_x = f"{int(w * 0.12)}*sin(2*PI*n/{frames})"
            leak_y = f"{int(h * 0.04)}*cos(2*PI*n/{frames})"
            graph += (
                f"[mid];[2:v]format=rgba,colorchannelmixer=aa=0.16[leak];"
                f"[mid][leak]overlay=x='{leak_x}':y='{leak_y}':shortest=1,format=yuv420p"
            )
        else:
            graph += ",format=yuv420p"
        return graph
    # Single-layer kenburns / drift (or parallax without a chrome plate)
    zp = zoompan_expr(p.bg_zoom_amp, p.bg_pan, frames, w, h, fps)
    return f"{prep},{zp},format=yuv420p"


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
        profile = MotionProfile(quality=quality or "light", style="kenburns" if not chrome else "parallax")
        if quality == "standard":
            profile = MotionProfile(quality="standard", duration=8.0, style=profile.style)
        elif quality == "cinematic":
            profile = MotionProfile(quality="cinematic", duration=10.0, style=profile.style)
    style = profile.normalized_style()
    use_chrome = bool(chrome and chrome.is_file() and style == "parallax")
    graph = build_filtergraph(profile, has_chrome=use_chrome)
    src = plate if plate and plate.is_file() else jpg
    mp4 = mp4_path_for(jpg)
    use_leak = use_chrome and profile.light_leak and "[2:v]" in graph
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        cmd = [ff, "-y", "-loop", "1", "-i", str(src)]
        if use_chrome:
            cmd += ["-loop", "1", "-i", str(chrome)]
        if use_leak:
            cmd += ["-f", "lavfi", "-i", f"color=c=0xff7a3a:s={profile.width}x{profile.height}:r={profile.fps}"]
        if use_chrome:
            cmd += ["-filter_complex", graph]
        else:
            cmd += ["-vf", graph]
        cmd += [
            "-t", str(profile.duration),
            "-r", str(profile.fps),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-profile:v", "main",
            "-level", "4.0",
            "-b:v", profile.bitrate,
            "-maxrate", profile.bitrate,
            "-bufsize", "4M",
            "-movflags", "+faststart",
            "-an",
            str(tmp_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode != 0 or not tmp_path.is_file() or tmp_path.stat().st_size < 1000:
            tail = (result.stderr or result.stdout or "ffmpeg failed").strip().splitlines()[-8:]
            return False, " | ".join(tail) or "ffmpeg failed"
        tmp_path.replace(mp4)
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
