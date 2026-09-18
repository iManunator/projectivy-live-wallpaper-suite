from __future__ import annotations

from app.layouts import PRESETS
from app.models import MediaItem
from app.providers.demo import DemoProvider
from app.render import render_still


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
