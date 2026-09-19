from __future__ import annotations

from app.layouts import PRESETS
from app.models import GradientStop, Layout, LayoutBackground, MediaItem
from app.providers.demo import DemoProvider
from app.render import linear_gradient_rgba, render_chrome, render_plate, render_still, synthetic_backdrop


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


def test_seerr_only_chrome_renders_on_flagship_layout():
    item = MediaItem(
        title="Signal Country",
        year=2023,
        watch_state="unwatched",
        library_state="seerr_only",
        availability="requestable",
        source="jellyseerr",
        overview="A radio host in the desert starts receiving tomorrow's news.",
        rating=7.6,
    )
    in_library = item.model_copy(update={"library_state": "in_library", "availability": "available", "source": "jellyfin"})
    layout = PRESETS["Netflix Hero"]
    seerr_chrome = render_chrome(item, layout)
    library_chrome = render_chrome(in_library, layout)
    assert seerr_chrome.tobytes() != library_chrome.tobytes()
    hidden = layout.model_copy(update={"show_seerr_badge": False})
    assert render_chrome(item, hidden).tobytes() == library_chrome.tobytes()


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
    assert corner >= 200


def test_letterbox_fade_edges_are_opaque():
    layout = Layout(
        name="Letterbox",
        canvas_width=80,
        canvas_height=45,
        background=LayoutBackground(
            fade_left=0.48,
            fade_right=0.04,
            fade_top=0.1,
            fade_bottom=0.42,
            vignette=0,
            overlay_opacity=0,
            gradient_opacity=0,
        ),
        layers=[],
    )
    chrome = render_chrome(MediaItem(title="Probe"), layout)
    assert chrome.getpixel((0, 22))[3] == 255
    assert chrome.getpixel((0, 0))[3] == 255
    assert chrome.getpixel((40, 44))[3] == 255
    assert chrome.getpixel((1, 1))[3] == 255
    assert chrome.getpixel((70, 22))[3] < 80


def test_plate_excludes_vignette_and_letterbox():
    layout = Layout(
        name="Atmosphere",
        canvas_width=64,
        canvas_height=36,
        background=LayoutBackground(
            fade_left=0.5,
            fade_bottom=0.4,
            fade_top=0.2,
            vignette=0.9,
            overlay_opacity=0,
            gradient_opacity=0,
        ),
        layers=[],
    )
    item = MediaItem(title="Probe")
    from PIL import Image
    import io

    art = Image.new("RGB", (64, 36), (200, 80, 40))
    buf = io.BytesIO()
    art.save(buf, "JPEG")
    plate = render_plate(item, layout, backdrop_bytes=buf.getvalue())
    chrome = render_chrome(item, layout)
    still = render_still(item, layout, backdrop_bytes=buf.getvalue())
    assert plate.getpixel((2, 2))[0] > 150
    assert still.getpixel((2, 2))[0] < plate.getpixel((2, 2))[0]
    assert chrome.getpixel((2, 2))[3] > 100


def test_demo_still_is_not_the_synthetic_fallback():
    item = DemoProvider().list_items()[0]
    layout = PRESETS["Netflix Hero"]
    painted = render_still(item, layout)
    synth = synthetic_backdrop(item.title, painted.size)
    assert painted.getpixel((1500, 360)) != synth.getpixel((1500, 360))
