"""Bundled cinematic layout presets and layout store."""

from __future__ import annotations

import json
from pathlib import Path

from app.config import LAYOUTS_DIR, ensure_dirs
from app.models import Layout, LayoutBackground, Layer


def _layers(*rows: dict) -> list[Layer]:
    return [Layer.model_validate(row) for row in rows]


PRESETS: dict[str, Layout] = {
    "Netflix Hero": Layout(
        name="Netflix Hero",
        preset=True,
        preset_id="netflix_hero",
        description="Left-stacked hero chrome over a heavy left fade.",
        background=LayoutBackground(fade_left=0.48, fade_bottom=0.42, fade_top=0.1, fade_right=0.04),
        layers=_layers(
            {"id": "title", "slot": "title", "x": 80, "y": 70, "width": 860, "height": 130, "font_size": 72, "font_weight": "bold"},
            {"id": "year", "slot": "year", "x": 80, "y": 220, "font_size": 26},
            {"id": "genres", "slot": "genres", "x": 200, "y": 220, "font_size": 26, "max_items": 3},
            {"id": "runtime", "slot": "runtime", "x": 560, "y": 220, "font_size": 26},
            {"id": "rating", "slot": "rating", "x": 80, "y": 268, "font_size": 32, "font_weight": "bold"},
            {"id": "watch", "slot": "watch_status", "x": 80, "y": 318, "font_size": 24},
            {"id": "overview", "slot": "overview", "x": 80, "y": 390, "width": 720, "height": 140, "font_size": 26},
        ),
    ),
    "Prime Cinematic": Layout(
        name="Prime Cinematic",
        preset=True,
        preset_id="prime_cinematic",
        description="Low title card with a deep bottom gradient.",
        background=LayoutBackground(fade_left=0.18, fade_bottom=0.58, fade_top=0.05, fade_right=0.18, color="#0b1018"),
        layers=_layers(
            {"id": "title", "slot": "title", "x": 96, "y": 640, "width": 1100, "font_size": 64, "font_weight": "bold"},
            {"id": "meta", "slot": "year", "x": 96, "y": 730, "font_size": 24},
            {"id": "genres", "slot": "genres", "x": 210, "y": 730, "font_size": 24, "max_items": 4},
            {"id": "rating", "slot": "rating", "x": 96, "y": 776, "font_size": 28, "font_weight": "bold"},
            {"id": "overview", "slot": "overview", "x": 96, "y": 830, "width": 980, "font_size": 24},
        ),
    ),
    "Google TV Clean": Layout(
        name="Google TV Clean",
        preset=True,
        preset_id="google_tv_clean",
        description="Minimal left metadata, lots of artwork breathing room.",
        background=LayoutBackground(fade_left=0.36, fade_bottom=0.22, fade_top=0.12, fade_right=0.02, fade_softness=0.6),
        layers=_layers(
            {"id": "title", "slot": "title", "x": 72, "y": 120, "width": 700, "font_size": 56, "font_weight": "bold"},
            {"id": "year", "slot": "year", "x": 72, "y": 210, "font_size": 22, "color": "#d0d0d0"},
            {"id": "genres", "slot": "genres", "x": 180, "y": 210, "font_size": 22, "color": "#d0d0d0"},
            {"id": "overview", "slot": "overview", "x": 72, "y": 270, "width": 640, "font_size": 22, "color": "#e8e8e8"},
        ),
    ),
    "Status Focus": Layout(
        name="Status Focus",
        preset=True,
        preset_id="status_focus",
        description="Watch-state and library badges front and center.",
        background=LayoutBackground(fade_left=0.55, fade_bottom=0.2, fade_top=0.2, color="#120808"),
        layers=_layers(
            {"id": "watch", "slot": "watch_status", "x": 80, "y": 80, "font_size": 28, "color": "#ffcc66", "font_weight": "bold"},
            {"id": "source", "slot": "source", "x": 80, "y": 130, "font_size": 22},
            {"id": "title", "slot": "title", "x": 80, "y": 220, "width": 900, "font_size": 68, "font_weight": "bold"},
            {"id": "rating", "slot": "rating", "x": 80, "y": 330, "font_size": 36, "font_weight": "bold"},
            {"id": "age", "slot": "age", "x": 200, "y": 338, "font_size": 24},
        ),
    ),
    "Jellyfin Dense": Layout(
        name="Jellyfin Dense",
        preset=True,
        preset_id="jellyfin_dense",
        description="Packed left chrome for library browsing wallpapers.",
        background=LayoutBackground(fade_left=0.52, fade_bottom=0.3, fade_top=0.08),
        layers=_layers(
            {"id": "title", "slot": "title", "x": 64, "y": 56, "width": 820, "font_size": 58, "font_weight": "bold"},
            {"id": "year", "slot": "year", "x": 64, "y": 150, "font_size": 22},
            {"id": "age", "slot": "age", "x": 150, "y": 150, "font_size": 22},
            {"id": "runtime", "slot": "runtime", "x": 240, "y": 150, "font_size": 22},
            {"id": "genres", "slot": "genres", "x": 64, "y": 196, "font_size": 22, "max_items": 5},
            {"id": "rating", "slot": "rating", "x": 64, "y": 246, "font_size": 30, "font_weight": "bold"},
            {"id": "watch", "slot": "watch_status", "x": 160, "y": 250, "font_size": 22},
            {"id": "source", "slot": "source", "x": 360, "y": 250, "font_size": 22},
            {"id": "overview", "slot": "overview", "x": 64, "y": 320, "width": 760, "font_size": 22},
        ),
    ),
    "Projectivy Dock": Layout(
        name="Projectivy Dock",
        preset=True,
        preset_id="projectivy_dock",
        description="Safe-zone chrome: below the clock, above the Projectivy row dock.",
        background=LayoutBackground(fade_left=0.4, fade_bottom=0.48, fade_top=0.16, fade_right=0.08, fade_softness=0.5),
        layers=_layers(
            {"id": "title", "slot": "title", "x": 88, "y": 140, "width": 900, "font_size": 64, "font_weight": "bold"},
            {"id": "year", "slot": "year", "x": 88, "y": 230, "font_size": 24},
            {"id": "genres", "slot": "genres", "x": 200, "y": 230, "font_size": 24, "max_items": 3},
            {"id": "rating", "slot": "rating", "x": 88, "y": 280, "font_size": 30, "font_weight": "bold"},
            {"id": "overview", "slot": "overview", "x": 88, "y": 360, "width": 760, "font_size": 24},
        ),
    ),
}


def seed_presets(force: bool = False) -> None:
    ensure_dirs()
    for layout in PRESETS.values():
        path = LAYOUTS_DIR / f"{layout.name}.json"
        if path.exists() and not force:
            continue
        path.write_text(layout.model_dump_json(indent=2), encoding="utf-8")


def list_layouts() -> list[str]:
    seed_presets()
    names = {p.stem for p in LAYOUTS_DIR.glob("*.json")}
    names.update(PRESETS.keys())
    return sorted(names, key=str.lower)


def load_layout(name: str) -> Layout | None:
    seed_presets()
    path = LAYOUTS_DIR / f"{name}.json"
    if path.is_file():
        return Layout.model_validate(json.loads(path.read_text(encoding="utf-8")))
    return PRESETS.get(name)


def save_layout(layout: Layout) -> Layout:
    ensure_dirs()
    path = LAYOUTS_DIR / f"{layout.name}.json"
    path.write_text(layout.model_dump_json(indent=2), encoding="utf-8")
    return layout


def delete_layout(name: str) -> bool:
    if name in PRESETS:
        return False
    path = LAYOUTS_DIR / f"{name}.json"
    if path.is_file():
        path.unlink()
        return True
    return False
