"""Batch generate must download provider artwork, not only paint metadata."""

from __future__ import annotations

import io

from PIL import Image

from app.models import GenerateRequest, MediaItem


def _jpeg(color: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (320, 180), color).save(buf, "JPEG", quality=95)
    return buf.getvalue()


def test_generate_one_paints_downloaded_backdrop(suite_dirs):
    from app.generate import generate_one

    jpeg = _jpeg((220, 30, 30))
    called: list[str] = []

    def http_get(url: str) -> bytes:
        called.append(url)
        return jpeg

    item = MediaItem(
        title="Red Planet",
        year=2024,
        overview="Dust.",
        genres=["Sci-Fi"],
        backdrop_url="http://jf:8096/Items/1/Images/Backdrop?maxWidth=1920",
        jellyfin_id="1",
        source="jellyfin",
    )
    record = generate_one(item, "Netflix Hero", http_get=http_get)
    assert record is not None
    assert called == [item.backdrop_url]
    path = suite_dirs["gallery"] / "Netflix Hero" / record.filename
    pixel = Image.open(path).getpixel((1500, 420))
    assert pixel[0] > 80
    assert pixel[0] > pixel[2]


def test_generate_one_falls_back_to_poster(suite_dirs):
    from app.generate import generate_one

    jpeg = _jpeg((20, 180, 40))
    called: list[str] = []

    def http_get(url: str) -> bytes:
        called.append(url)
        if "Backdrop" in url:
            raise RuntimeError("no backdrop")
        return jpeg

    item = MediaItem(
        title="Green Room",
        backdrop_url="http://jf:8096/Items/2/Images/Backdrop?maxWidth=1920",
        poster_url="http://jf:8096/Items/2/Images/Primary?maxHeight=600",
        jellyfin_id="2",
        source="jellyfin",
    )
    record = generate_one(item, "Netflix Hero", http_get=http_get)
    assert record is not None
    assert called == [item.backdrop_url, item.poster_url]
    pixel = Image.open(suite_dirs["gallery"] / "Netflix Hero" / record.filename).getpixel((1500, 420))
    assert pixel[1] > 70


def test_run_generate_downloads_without_injected_client(suite_dirs, monkeypatch):
    from app import generate as generate_mod
    from app.models import MediaItem as Item

    jpeg = _jpeg((30, 40, 210))
    monkeypatch.setattr(generate_mod, "_default_http_get", lambda url: jpeg)
    monkeypatch.setattr(
        generate_mod,
        "collect_items",
        lambda source, limit, warnings=None: [
            Item(
                title="Silo",
                year=2023,
                backdrop_url="http://jf:8096/Items/silo/Images/Backdrop",
                jellyfin_id="silo",
                source="jellyfin",
            )
        ],
    )
    out = generate_mod.run_generate(GenerateRequest(source="jellyfin", layout="Netflix Hero", limit=1, skip_existing=False))
    assert out["count"] == 1
    assert out["created"] == ["Silo"]
    files = list((suite_dirs["gallery"] / "Netflix Hero").glob("silo-*.jpg"))
    assert files
    pixel = Image.open(files[0]).getpixel((1500, 420))
    assert pixel[2] > 80


def _png_logo(color=(255, 220, 40, 255)) -> bytes:
    buf = io.BytesIO()
    image = Image.new("RGBA", (640, 160), (0, 0, 0, 0))
    image.paste(color, (8, 8, 632, 152))
    image.save(buf, "PNG")
    return buf.getvalue()


def test_generate_one_composites_logo_instead_of_title(suite_dirs):
    from app.generate import generate_one

    jpeg = _jpeg((12, 14, 18))
    png = _png_logo()

    def http_get(url: str) -> bytes:
        if "Logo" in url:
            return png
        return jpeg

    item = MediaItem(
        title="UNIQUE_TITLE_GLYPH",
        year=2024,
        genres=["Drama"],
        backdrop_url="http://jf:8096/Items/9/Images/Backdrop?maxWidth=1920",
        logo_url="http://jf:8096/Items/9/Images/Logo",
        jellyfin_id="9",
        source="jellyfin",
    )
    record = generate_one(item, "Netflix Hero", http_get=http_get)
    assert record is not None
    pixel = Image.open(suite_dirs["gallery"] / "Netflix Hero" / record.filename).getpixel((120, 100))
    assert pixel[0] > 180
    assert pixel[1] > 140
    assert pixel[0] > pixel[2]


def test_default_http_get_sends_jellyfin_auth(suite_dirs, monkeypatch):
    from app.config import save_settings
    from app.generate import _default_http_get
    from app.models import AppSettings

    save_settings(AppSettings(jellyfin={"url": "http://jf:8096", "api_key": "secret", "user_id": "u"}))
    seen: dict = {}

    class Client:
        def __init__(self, timeout: float = 15.0):
            self.timeout = timeout

        def get_bytes(self, url, headers=None):
            seen["url"] = url
            seen["headers"] = headers
            return b"\xff\xd8\xff" + b"\x00" * 16

    monkeypatch.setattr("app.generate.HttpClient", Client)
    data = _default_http_get("http://jf:8096/Items/1/Images/Backdrop")
    assert data.startswith(b"\xff\xd8\xff")
    assert seen["headers"]["Authorization"].startswith("MediaBrowser")
    assert "secret" in seen["headers"]["Authorization"]
    assert seen["headers"]["X-Emby-Token"] == "secret"


def test_fetch_artwork_rejects_html(suite_dirs):
    from app.generate import _fetch_artwork
    from app.models import MediaItem

    item = MediaItem(
        title="From",
        backdrop_url="http://jf:8096/Items/x/Images/Backdrop",
        jellyfin_id="real-1",
        source="jellyfin",
    )
    data = _fetch_artwork(item, http_get=lambda url: b"<!DOCTYPE html><html>nope</html>")
    assert data is None


def test_jellyfin_unconfigured_generate_warns_and_uses_demo(suite_dirs):
    from app.generate import run_generate
    from app.models import GenerateRequest

    out = run_generate(GenerateRequest(source="jellyfin", layout="Netflix Hero", limit=1, skip_existing=False))
    assert out["count"] == 1
    assert out["created"]
    assert any("Jellyfin is not configured" in w for w in out["warnings"])
    assert "Created 1 still" in out["message"]


def test_generate_one_uses_bundled_demo_still(suite_dirs):
    from app.generate import generate_one
    from app.providers.demo import DemoProvider
    from app.render import synthetic_backdrop
    from PIL import Image

    item = DemoProvider().list_items()[0]
    record = generate_one(item, "Netflix Hero")
    path = suite_dirs["gallery"] / "Netflix Hero" / record.filename
    painted = Image.open(path)
    synth = synthetic_backdrop(item.title, painted.size)
    assert painted.getpixel((1500, 360)) != synth.getpixel((1500, 360))
