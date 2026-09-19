from __future__ import annotations

from app.layouts import PRESETS
from app.models import GradientStop, Layout, LayoutBackground, MediaItem
from app.providers.demo import DemoProvider
from app.render import linear_gradient_rgba, render_chrome, render_still, synthetic_backdrop


def test_render_still_is_full_hd():
    layout = PRESETS["Netflix Hero"]
    item = DemoProvider().list_items()[0]
    image = render_still(item, layout)
    assert image.size == (1920, 1080)
    assert image.mode == "RGB"


def test_all_presets_render():
    item = MediaItem(title="Probe", year=2024, overview="Test", rating=8.0, genres=["Drama"])
    for name, layout in PRESETS.items():
        image = render_still(item, layout)
        assert image.size[0] == 1920, name


def test_flagship_presets_include_watch_status():
    for name in ("Netflix Hero", "Prime Cinematic", "Google TV Clean", "Projectivy Dock"):
        slots = {layer.slot for layer in PRESETS[name].layers}
        assert "watch_status" in slots, name


def test_watch_status_renders_as_pill():
    item = MediaItem(title="Probe", year=2024, watch_state="partial", overview="Test", rating=8.0)
    image = render_still(item, PRESETS["Status Focus"])
    assert image.size == (1920, 1080)


def test_projectivy_dock_keeps_safe_zone():
    layout = PRESETS["Projectivy Dock"]
    assert layout.background.fade_bottom >= 0.4
    title = next(layer for layer in layout.layers if layer.slot == "title")
    assert title.y >= 120
    assert title.y < 400


def test_linear_gradient_left_to_right():
    bg = LayoutBackground(
        fade_left=0,
        fade_right=0,
        fade_top=0,
        fade_bottom=0,
        gradient_type="linear",
        gradient_angle=90,
        gradient_opacity=1,
        gradient_stops=[
            GradientStop(color="#ff0000", position=0, opacity=1),
            GradientStop(color="#0000ff", position=1, opacity=1),
        ],
    )
    image = linear_gradient_rgba((64, 32), bg)
    left = image.getpixel((2, 16))
    right = image.getpixel((61, 16))
    assert left[0] > left[2]
    assert right[2] > right[0]


def test_chrome_vignette_darkens_corners():
    layout = Layout(
        name="Vignette",
        canvas_width=80,
        canvas_height=45,
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
    chrome = render_chrome(MediaItem(title="Probe"), layout)
    corner = chrome.getpixel((1, 1))[3]
    center = chrome.getpixel((40, 22))[3]
    assert corner > center


def test_demo_still_is_not_the_synthetic_fallback():
    item = DemoProvider().list_items()[0]
    layout = PRESETS["Netflix Hero"]
    painted = render_still(item, layout)
    synth = synthetic_backdrop(item.title, painted.size)
    assert painted.getpixel((1500, 360)) != synth.getpixel((1500, 360))
