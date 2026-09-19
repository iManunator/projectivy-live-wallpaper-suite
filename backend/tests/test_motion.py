from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from PIL import Image

from app.layouts import PRESETS
from app.models import AppSettings, MediaItem
from app.motion import (
    MotionProfile,
    build_filtergraph,
    choose_delivery,
    ffmpeg_bin,
    generate_motion,
    has_motion,
    intensity_from_preset,
    profile_from_settings,
    zoompan_expr,
)
from app.render import render_chrome, render_plate, render_still, save_jpeg, save_png


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
    assert "[mid],format" not in graph
    assert "overlay=x='" not in graph
    assert "," not in zoompan_expr(0.05, 20, 48, 1920, 1080, 24).split("z=")[1].split(":")[0]


def test_kenburns_and_drift_lock_chrome_when_layered():
    for style in ("kenburns", "drift", "parallax"):
        graph = build_filtergraph(
            MotionProfile(style=style, intensity=0.8, duration=6, light_leak=False),
            has_chrome=True,
        )
        assert "[1:v]" in graph
        assert "overlay=x=0:y=0" in graph
        assert "zoompan=" in graph


def test_parallax_light_leak_adds_third_layer():
    graph = build_filtergraph(
        MotionProfile(style="parallax", intensity=0.6, duration=6, light_leak=True),
        has_chrome=True,
    )
    assert "[2:v]" in graph
    assert "colorchannelmixer" in graph
    assert "[mid]" in graph


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

    def grab(frame: int, dest: Path) -> None:
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

    first = tmp_path / "f0.png"
    mid = tmp_path / "f6.png"
    grab(0, first)
    grab(6, mid)
    p0 = Image.open(first).convert("RGB").getpixel((10, 8))
    p6 = Image.open(mid).convert("RGB").getpixel((10, 8))
    assert min(p0) > 180, p0
    assert min(p6) > 180, p6

