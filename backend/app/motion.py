"""Optional Ken Burns MP4 loops for Projectivy VIDEO wallpapers."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

QUALITY = {
    "light": {"w": 1920, "h": 1080, "fps": 24, "duration": 3.0, "bitrate": "1800k", "zoom": 1.035},
    "standard": {"w": 1920, "h": 1080, "fps": 25, "duration": 4.0, "bitrate": "2800k", "zoom": 1.045},
}


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


def generate_motion(jpg: Path, quality: str = "light", force: bool = False) -> tuple[bool, str]:
    if not jpg.is_file():
        return False, "jpeg missing"
    if not force and has_motion(jpg):
        return True, "already exists"
    ff = ffmpeg_bin()
    if not ff:
        return False, "ffmpeg not found"
    preset = QUALITY.get(quality) or QUALITY["light"]
    w, h = preset["w"], preset["h"]
    fps = int(preset["fps"])
    duration = float(preset["duration"])
    bitrate = preset["bitrate"]
    amp = float(preset["zoom"]) - 1.0
    frames = max(int(round(duration * fps)), 2)
    zoompan = (
        f"zoompan=z='1+{amp}*sin(2*PI*on/{frames})':"
        f"x='iw/2-(iw/zoom/2)':"
        f"y='ih/2-(ih/zoom/2)+({amp}*20)*sin(2*PI*on/{frames})':"
        f"d=1:s={w}x{h}:fps={fps}"
    )
    vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},{zoompan}"
    mp4 = mp4_path_for(jpg)
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        cmd = [
            ff, "-y", "-loop", "1", "-i", str(jpg),
            "-vf", vf, "-t", str(duration), "-r", str(fps),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "main",
            "-level", "4.0", "-b:v", bitrate, "-maxrate", bitrate,
            "-bufsize", "4M", "-movflags", "+faststart", "-an", str(tmp_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
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
