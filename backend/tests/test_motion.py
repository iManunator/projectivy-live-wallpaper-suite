from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from PIL import Image

from app.layouts import PRESETS
from app.motion import (
    MotionProfile,
    build_filtergraph,
    choose_delivery,
    ffmpeg_bin,
    generate_motion,
    has_motion,
    intensity_from_preset,
    leak_geometry,
    max_motion_frame,
    pingpong_ease,
    plate_kenburns_filters,
    profile_from_settings,
    zoompan_expr,
)
from app.models import AppSettings, Layout, LayoutBackground, MediaItem
from app.render import render_chrome, render_plate, render_still, save_jpeg, save_png


def _grab_frame(mp4: Path, frame: int, dest: Path) -> Image.Image:
    result = subprocess.run(
        [
            ffmpeg_bin(),
            "-y",
            "-i",
            str(mp4),
            "-vf",
            f"select=eq(n\\,{frame})",
            "-vframes",
            "1",
            str(dest),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr[-500:]
    return Image.open(dest).convert("RGB")


def _channel_delta(a: tuple[int, ...], b: tuple[int, ...]) -> int:
    return max(abs(x - y) for x, y in zip(a, b))


def test_leak_geometry_pads_beyond_pan():
    profile = MotionProfile(style="parallax", duration=6, fps=24, width=1920, height=1080, light_leak=True)
    x, y, lw, lh = leak_geometry(profile)
    assert lw > profile.width
    assert lh > profile.height
    assert x.startswith("-")
    assert y.startswith("-")
    assert "," not in x and "," not in y


def test_max_motion_frame_is_peak_sine():
    assert max_motion_frame(12) == 6
    assert max_motion_frame(24) == 12


def test_choose_delivery_prefers_video_when_asked():
    uri, kind = choose_delivery(
        image_url="http://x/a.jpg",
        video_url="http://x/a.mp4",
        prefer_video=True,
        media_type="video",
    )
    assert kind == "video"
    assert uri.endswith(".mp4")


def test_choose_delivery_falls_back_to_still():
    uri, kind = choose_delivery(
        image_url="http://x/a.jpg",
        video_url=None,
        prefer_video=True,
        fallback_still=True,
    )
    assert kind == "image"
    assert uri.endswith(".jpg")


def test_choose_delivery_without_fallback_and_no_video():
    uri, kind = choose_delivery(
        image_url=None,
        video_url=None,
        prefer_video=True,
        fallback_still=True,
    )
    assert uri is None
    assert kind == "image"


def test_profile_scales_with_intensity():
    low = MotionProfile(style="parallax", intensity=0.1)
    high = MotionProfile(style="parallax", intensity=1.0)
    assert high.bg_zoom_amp > low.bg_zoom_amp
    assert high.bg_pan > low.bg_pan
    assert high.fg_pan == 0
    assert low.fg_pan == 0


def test_unknown_style_normalizes_to_parallax():
    assert MotionProfile(style="parallelx").normalized_style() == "parallax"


def test_choose_delivery_video_without_fallback():
    uri, kind = choose_delivery(
        image_url=None,
        video_url="http://x/a.mp4",
        prefer_video=False,
        fallback_still=False,
        media_type="video",
    )
    assert kind == "video"
    assert uri.endswith(".mp4")


def test_profile_from_settings_defaults():
    profile = profile_from_settings(AppSettings(motion_style="drift", motion_quality="cinematic"))
    assert profile.normalized_style() == "drift"
    assert profile.duration >= 12.0
    assert profile.quality == "cinematic"


def test_parallax_filtergraph_has_two_layers():
    graph = build_filtergraph(
        MotionProfile(style="parallax", intensity=0.6, duration=6, light_leak=False),
        has_chrome=True,
    )
    assert "[0:v]" in graph
    assert "[1:v]" in graph
    assert "[2:v]" not in graph
    assert "overlay=x=0:y=0" in graph
    assert "zoompan=" in graph
    assert "flags=lanczos" in graph
    assert "eval=frame" not in graph
    assert "[mid],format" not in graph
    assert "overlay=x='" not in graph
    z_expr = zoompan_expr(0.05, 20, 48, 1920, 1080, 30).split("z=")[1].split(":")[0]
    assert "," not in z_expr
    assert "sin(2*PI" not in z_expr
    assert "sin(PI*on/" in z_expr


def test_kenburns_and_drift_lock_chrome_when_layered():
    for style in ("kenburns", "drift", "parallax"):
        graph = build_filtergraph(
            MotionProfile(style=style, intensity=0.8, duration=6, light_leak=False),
            has_chrome=True,
        )
        assert "[1:v]" in graph
        assert "overlay=x=0:y=0" in graph
        assert "zoompan=" in graph
        assert "sin(2*PI" not in graph


def test_parallax_light_leak_sits_under_locked_chrome():
    graph = build_filtergraph(
        MotionProfile(style="parallax", intensity=0.6, duration=6, light_leak=True),
        has_chrome=True,
    )
    assert "[2:v]" in graph
    assert "colorchannelmixer" in graph
    assert "[lit]" in graph
    assert "[mid]" not in graph
    leak_overlay = graph.find("overlay=x='")
    chrome_overlay = graph.rfind("overlay=x=0:y=0")
    assert 0 <= graph.find("[2:v]") < leak_overlay < chrome_overlay
    # Padded leak must start at a negative origin so a pan cannot uncover the frame.
    assert "overlay=x='-" in graph


def test_intensity_presets():
    assert intensity_from_preset("subtle") == 0.16
    assert intensity_from_preset("bold") == 0.96
    assert intensity_from_preset("nope") == 0.55
    profile = profile_from_settings(AppSettings(motion_preset="bold", motion_intensity=0.55))
    assert profile.intensity == 0.96
    assert profile.light_leak is True


def test_intensity_presets_change_output_clearly():
    subtle = MotionProfile(style="parallax", intensity=0.16)
    cinematic = MotionProfile(style="parallax", intensity=0.55)
    bold = MotionProfile(style="parallax", intensity=0.96)
    assert cinematic.bg_zoom_amp > subtle.bg_zoom_amp * 1.4
    assert bold.bg_zoom_amp > cinematic.bg_zoom_amp * 1.25
    assert bold.bg_pan > subtle.bg_pan * 2


def test_kenburns_without_chrome_is_single_layer():
    graph = build_filtergraph(MotionProfile(style="kenburns"), has_chrome=False)
    assert "[0:v]" not in graph
    assert "overlay=" not in graph
    assert "zoompan=" in graph
    assert "flags=lanczos" in graph


def test_kenburns_path_matches_css_pingpong():
    """Bake must zoom *in* and rest at the loop join — not a bipolar sine zoom-out."""
    profile = MotionProfile(style="parallax", intensity=0.55, duration=12, fps=30)
    graph = plate_kenburns_filters(profile)
    assert "zoompan=" in graph
    assert "flags=lanczos" in graph
    assert pingpong_ease(profile.frames, "on") in graph
    assert "sin(2*PI" not in graph
    assert profile.zoom_from >= 1.0
    assert f"z='{profile.zoom_from}+" in graph
    sw, sh = profile.width * 2, profile.height * 2
    assert f"scale={sw}:{sh}:flags=lanczos" in graph
    # zoompan is nearest-neighbour: Ken Burns at 2× then lanczos down.
    assert f"s={sw}x{sh}" in graph
    after_zp = graph.split("zoompan=", 1)[1]
    assert f"scale={profile.width}:{profile.height}:flags=lanczos" in after_zp


def test_bake_amplitude_tracks_css_preview():
    """web/src/lib/motion.ts --motion-zoom-* / --motion-x (cinematic 0.55)."""
    p = MotionProfile(style="parallax", intensity=0.55, width=1920, height=1080)
    assert p.zoom_from == 1.04
    assert abs(p.zoom_from + p.bg_zoom_amp - (1 + 0.55 * 0.18)) < 0.002
    assert abs(p.bg_pan - 1920 * 0.048 * 0.55) < 0.05
    k = MotionProfile(style="kenburns", intensity=0.55, width=1920, height=1080)
    assert k.zoom_from == 1.015
    assert abs(k.zoom_from + k.bg_zoom_amp - (1 + 0.55 * 0.22)) < 0.002
    d = MotionProfile(style="drift", intensity=0.55, width=1920, height=1080)
    assert d.zoom_from == 1.015
    assert abs(d.bg_pan - 1920 * 0.074 * 0.55) < 0.05


def test_profile_defaults_are_tv_smooth():
    profile = profile_from_settings(AppSettings())
    assert profile.fps == 30
    assert profile.x264_preset == "fast"
    assert profile.bitrate == "2800k"
    cinematic = profile_from_settings(AppSettings(motion_quality="cinematic"))
    assert cinematic.fps == 30
    assert cinematic.x264_preset == "slow"
    assert cinematic.duration >= 12.0
    assert cinematic.bitrate == "5500k"
    assert MotionProfile(quality="standard").x264_preset == "medium"


def test_chrome_is_transparent_rgba():
    item = MediaItem(title="Depth", year=2024, overview="Parallax", rating=8.2, genres=["Sci-Fi"])
    chrome = render_chrome(item, PRESETS["Netflix Hero"])
    assert chrome.mode == "RGBA"
    assert chrome.size == (1920, 1080)
    # Some pixels remain fully transparent (artwork shows through).
    extrema = chrome.getextrema()
    assert extrema[3][0] == 0


def test_plate_has_no_alpha():
    item = MediaItem(title="Depth", year=2024)
    plate = render_plate(item, PRESETS["Netflix Hero"])
    assert plate.mode == "RGB"


@pytest.mark.skipif(ffmpeg_bin() is None, reason="ffmpeg not installed")
def test_ffmpeg_bakes_small_parallax_loop(tmp_path: Path):
    item = MediaItem(title="Loop", year=2021, overview="Motion", rating=7.5, genres=["Drama"])
    layout = PRESETS["Status Focus"]
    still = render_still(item, layout)
    jpg = tmp_path / "loop.jpg"
    plate = tmp_path / "loop_plate.jpg"
    chrome = tmp_path / "loop_chrome.png"
    save_jpeg(still, jpg)
    save_jpeg(render_plate(item, layout), plate)
    save_png(render_chrome(item, layout), chrome)
    # Tiny encode for CI speed: 320x180, 1s.
    profile = MotionProfile(
        style="parallax",
        quality="light",
        intensity=0.5,
        duration=1.0,
        fps=12,
        width=320,
        height=180,
        light_leak=False,
    )
    ok, msg = generate_motion(jpg, profile=profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg
    assert has_motion(jpg)
    assert jpg.with_suffix(".mp4").stat().st_size > 1000
    leak_profile = MotionProfile(
        style="parallax",
        quality="light",
        intensity=0.5,
        duration=1.0,
        fps=12,
        width=320,
        height=180,
        light_leak=True,
    )
    ok, msg = generate_motion(jpg, profile=leak_profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg


@pytest.mark.skipif(ffmpeg_bin() is None, reason="ffmpeg not installed")
def test_ffmpeg_keeps_chrome_pinned_on_kenburns(tmp_path: Path):
    from PIL import ImageDraw

    width, height = 320, 180
    plate_img = Image.new("RGB", (width, height), (200, 24, 24))
    chrome_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(chrome_img).rectangle([0, 0, 56, 32], fill=(250, 250, 250, 255))
    jpg = tmp_path / "locked.jpg"
    plate = tmp_path / "locked_plate.jpg"
    chrome = tmp_path / "locked_chrome.png"
    save_jpeg(plate_img, jpg)
    save_jpeg(plate_img, plate)
    save_png(chrome_img, chrome)
    profile = MotionProfile(
        style="kenburns",
        quality="light",
        intensity=0.96,
        duration=1.0,
        fps=12,
        width=width,
        height=height,
        light_leak=False,
    )
    ok, msg = generate_motion(jpg, profile=profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg
    mp4 = jpg.with_suffix(".mp4")
    peak = max_motion_frame(profile.frames)
    first = _grab_frame(mp4, 0, tmp_path / "f0.png")
    moved = _grab_frame(mp4, peak, tmp_path / "fpeak.png")
    p0 = first.getpixel((10, 8))
    p1 = moved.getpixel((10, 8))
    assert min(p0) > 180, p0
    assert min(p1) > 180, p1
    assert _channel_delta(p0, p1) <= 6, (p0, p1)


@pytest.mark.skipif(ffmpeg_bin() is None, reason="ffmpeg not installed")
def test_ffmpeg_keeps_vignette_and_letterbox_locked_while_plate_moves(tmp_path: Path):
    """Atmosphere stays pinned; only the art plate Ken-Burns.

    Default parallax bakes a light-leak under chrome. A same-size leak that pans
    uncovers the frame edge and looks like a moving vignette — that must not happen.
    """
    from PIL import ImageDraw

    width, height = 320, 180
    plate_img = Image.new("RGB", (width, height))
    px = plate_img.load()
    for y in range(height):
        for x in range(width):
            px[x, y] = (int(255 * x / (width - 1)), int(255 * y / (height - 1)), 40)

    item = MediaItem(title="Probe")
    layout = Layout(
        name="Locked atmosphere",
        canvas_width=width,
        canvas_height=height,
        background=LayoutBackground(
            fade_left=0.0,
            fade_right=0.0,
            fade_top=0.22,
            fade_bottom=0.22,
            fade_softness=0.2,
            vignette=0.9,
            overlay_opacity=0,
            gradient_opacity=0,
        ),
        layers=[],
    )
    chrome_img = render_chrome(item, layout)
    # Guarantee an opaque letterbox sample even if the fade falloff is soft.
    ImageDraw.Draw(chrome_img).rectangle([0, 0, width, 16], fill=(8, 8, 8, 255))
    ImageDraw.Draw(chrome_img).rectangle([0, height - 16, width, height], fill=(8, 8, 8, 255))
    assert chrome_img.getpixel((8, 8))[3] == 255
    assert chrome_img.getpixel((2, 2))[3] >= 200

    jpg = tmp_path / "atm.jpg"
    plate = tmp_path / "atm_plate.jpg"
    chrome = tmp_path / "atm_chrome.png"
    save_jpeg(plate_img, jpg)
    save_jpeg(plate_img, plate)
    save_png(chrome_img, chrome)
    profile = MotionProfile(
        style="parallax",
        quality="light",
        intensity=0.96,
        duration=1.0,
        fps=12,
        width=width,
        height=height,
        light_leak=True,
    )
    ok, msg = generate_motion(jpg, profile=profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg
    mp4 = jpg.with_suffix(".mp4")
    peak = max_motion_frame(profile.frames)
    first = _grab_frame(mp4, 0, tmp_path / "atm0.png")
    moved = _grab_frame(mp4, peak, tmp_path / "atm_peak.png")

    # Locked letterbox / corner atmosphere.
    for sample in ((8, 6), (width // 2, 6), (width - 8, 6), (8, height - 6), (2, 2)):
        assert _channel_delta(first.getpixel(sample), moved.getpixel(sample)) <= 6, sample

    # Plate still Ken-Burns in the open center.
    center_delta = _channel_delta(first.getpixel((width // 2, height // 2)), moved.getpixel((width // 2, height // 2)))
    assert center_delta >= 8, center_delta


@pytest.mark.skipif(ffmpeg_bin() is None, reason="ffmpeg not installed")
def test_ffmpeg_uniform_plate_vignette_does_not_zoom(tmp_path: Path):
    """If vignette were burned into the plate, zoom would lighten the corners."""
    width, height = 320, 180
    plate_img = Image.new("RGB", (width, height), (200, 40, 80))
    layout = Layout(
        name="Vignette only",
        canvas_width=width,
        canvas_height=height,
        background=LayoutBackground(
            fade_left=0,
            fade_right=0,
            fade_top=0,
            fade_bottom=0,
            vignette=0.9,
            overlay_opacity=0,
            gradient_opacity=0,
        ),
        layers=[],
    )
    jpg = tmp_path / "vig.jpg"
    plate = tmp_path / "vig_plate.jpg"
    chrome = tmp_path / "vig_chrome.png"
    save_jpeg(plate_img, jpg)
    save_jpeg(plate_img, plate)
    save_png(render_chrome(MediaItem(title="Probe"), layout), chrome)
    profile = MotionProfile(
        style="parallax",
        quality="light",
        intensity=0.96,
        duration=1.0,
        fps=12,
        width=width,
        height=height,
        light_leak=True,
    )
    ok, msg = generate_motion(jpg, profile=profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg
    peak = max_motion_frame(profile.frames)
    first = _grab_frame(jpg.with_suffix(".mp4"), 0, tmp_path / "vig0.png")
    moved = _grab_frame(jpg.with_suffix(".mp4"), peak, tmp_path / "vig_peak.png")
    for sample in ((2, 2), (8, 8), (20, 16), (width - 3, 2), (width // 2, 4)):
        assert _channel_delta(first.getpixel(sample), moved.getpixel(sample)) <= 4, sample


@pytest.mark.skipif(ffmpeg_bin() is None, reason="ffmpeg not installed")
def test_ffmpeg_kenburns_is_temporally_smooth(tmp_path: Path):
    """Adjacent frames move less than the 0→peak travel (CSS-like ping-pong, not choppy jumps)."""
    width, height = 320, 180
    plate_img = Image.new("RGB", (width, height))
    px = plate_img.load()
    for y in range(height):
        for x in range(width):
            px[x, y] = (int(255 * x / (width - 1)), int(255 * y / (height - 1)), 40)
    jpg = tmp_path / "smooth.jpg"
    plate = tmp_path / "smooth_plate.jpg"
    chrome = tmp_path / "smooth_chrome.png"
    save_jpeg(plate_img, jpg)
    save_jpeg(plate_img, plate)
    save_png(Image.new("RGBA", (width, height), (0, 0, 0, 0)), chrome)
    profile = MotionProfile(
        style="kenburns",
        quality="light",
        intensity=0.96,
        duration=1.0,
        fps=12,
        width=width,
        height=height,
        light_leak=False,
    )
    ok, msg = generate_motion(jpg, profile=profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg
    mp4 = jpg.with_suffix(".mp4")
    grabbed = [_grab_frame(mp4, n, tmp_path / f"sm{n}.png") for n in range(profile.frames)]
    sample = (width // 2, height // 2)
    peak = max_motion_frame(profile.frames)
    span = _channel_delta(grabbed[0].getpixel(sample), grabbed[peak].getpixel(sample))
    assert span >= 8, span
    adjacent = [
        _channel_delta(grabbed[i].getpixel(sample), grabbed[i + 1].getpixel(sample))
        for i in range(len(grabbed) - 1)
    ]
    assert max(adjacent) < span
    assert sum(adjacent) / len(adjacent) <= span * 0.55
    # Seamless loop: last frame is closer to the start than to peak travel.
    join = _channel_delta(grabbed[0].getpixel(sample), grabbed[-1].getpixel(sample))
    assert join < span

@pytest.mark.skipif(ffmpeg_bin() is None, reason="ffmpeg not installed")
def test_generate_motion_survives_exdev_promote(tmp_path: Path, monkeypatch):
    """Bake must promote /tmp → gallery even when os.rename raises EXDEV."""
    import errno
    import os

    item = MediaItem(title="EXDEV", year=2024)
    layout = PRESETS["Status Focus"]
    jpg = tmp_path / "gallery" / "exdev.jpg"
    plate = tmp_path / "gallery" / "exdev_plate.jpg"
    chrome = tmp_path / "gallery" / "exdev_chrome.png"
    jpg.parent.mkdir(parents=True)
    save_jpeg(render_still(item, layout), jpg)
    save_jpeg(render_plate(item, layout), plate)
    save_png(render_chrome(item, layout), chrome)
    profile = MotionProfile(
        style="kenburns",
        quality="light",
        intensity=0.5,
        duration=1.0,
        fps=12,
        width=320,
        height=180,
        light_leak=False,
    )

    def rename_exdev(a, b):
        raise OSError(errno.EXDEV, "Invalid cross-device link")

    monkeypatch.setattr(os, "rename", rename_exdev)
    ok, msg = generate_motion(jpg, profile=profile, force=True, plate=plate, chrome=chrome)
    assert ok, msg
    assert has_motion(jpg)
