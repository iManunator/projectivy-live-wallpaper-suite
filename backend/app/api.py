"""Projectivy wallpaper HTTP API + editor/gallery/settings routes."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from app import catalog as catalog_store
from app.config import load_settings, public_base_url, save_settings
from app.generate import collect_items, run_generate
from app.jobs import reload_jobs
from app.layouts import delete_layout, list_layouts, load_layout, save_layout, seed_presets
from app.models import AppSettings, GenerateRequest, Layout, WallpaperStatus
from app.providers.demo import DemoProvider
from app.providers.jellyfin import JellyfinProvider
from app.providers.seerr import SeerrProvider
from app.providers.tmdb import TmdbProvider
from app.selection import SelectionQuery, select_wallpaper, unique_values

router = APIRouter()


def _int_or_none(value: str | None) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _float_or_none(value: str | None) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _public_url(request: Request, layout: str, filename: str) -> str:
    settings = load_settings()
    base = public_base_url(settings)
    # Prefer configured public URL; fall back to the incoming request host.
    if not base or "127.0.0.1" in base or "localhost" in base:
        base = str(request.base_url).rstrip("/")
    encoded_layout = quote(layout, safe="")
    encoded_file = quote(filename)
    return f"{base}/api/wallpaper/image/{encoded_layout}/{encoded_file}"


@router.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "projectivy-live-wallpaper-suite"}


@router.get("/api/layouts/list")
def layouts_list() -> list[str]:
    seed_presets()
    return list_layouts()


@router.get("/api/layouts/with-images")
def layouts_with_images() -> list[str]:
    names = catalog_store.layouts_with_images()
    return names


@router.get("/api/layouts")
def layouts_detail() -> list[dict[str, Any]]:
    seed_presets()
    out = []
    for name in list_layouts():
        layout = load_layout(name)
        if layout:
            out.append(layout.model_dump())
    return out


@router.get("/api/layouts/load/{name:path}")
def layouts_load(name: str) -> dict[str, Any]:
    layout = load_layout(name)
    if not layout:
        raise HTTPException(404, "Layout not found")
    return layout.model_dump()


@router.post("/api/layouts/save")
def layouts_save(layout: Layout) -> dict[str, Any]:
    saved = save_layout(layout)
    return {"status": "ok", "layout": saved.model_dump()}


@router.post("/api/layouts/delete/{name:path}")
def layouts_delete(name: str) -> dict[str, Any]:
    if not delete_layout(name):
        raise HTTPException(400, "Cannot delete a bundled preset (save a copy first)")
    return {"status": "ok"}


@router.get("/api/genres/list")
def genres_list() -> list[str]:
    return unique_values(catalog_store.load_catalog(), "genres")


@router.get("/api/ages/list")
def ages_list() -> list[str]:
    return unique_values(catalog_store.load_catalog(), "official_rating")


@router.get("/api/year/list")
def year_list() -> list[str]:
    years = unique_values(catalog_store.load_catalog(), "year")
    return sorted(years, reverse=True)


@router.get("/api/wallpaper/status", response_model=WallpaperStatus)
def wallpaper_status(
    request: Request,
    layout: str = Query("Default"),
    genre: str | None = None,
    age_rating: str | None = Query(None),
    age: str | None = None,
    min_year: str | None = None,
    max_year: str | None = None,
    min_rating: str | None = None,
    max_rating: str | None = None,
    sort: str = "random",
    pool: str | None = None,
    exclude: str | None = None,
    exclude_path: str | None = None,
) -> WallpaperStatus:
    catalog = catalog_store.load_catalog()
    query = SelectionQuery(
        layout=layout,
        genre=genre,
        age_rating=age_rating or age,
        min_year=_int_or_none(min_year),
        max_year=_int_or_none(max_year),
        min_rating=_float_or_none(min_rating),
        max_rating=_float_or_none(max_rating),
        sort=sort or "random",
        pool=pool,
        exclude=exclude or exclude_path,
    )
    selected = select_wallpaper(catalog, query)
    status = WallpaperStatus(sort=query.sort, pool=query.pool or None, layout=layout)
    if not selected:
        return status
    jpg = catalog_store.wallpaper_file(selected.layout, selected.filename)
    if not jpg:
        return status
    status.imageUrl = _public_url(request, selected.layout, selected.filename)
    status.actionUrl = selected.action_url
    status.title = selected.title
    status.path = selected.filename
    mp4 = jpg.with_suffix(".mp4")
    if selected.has_video or (mp4.is_file() and mp4.stat().st_size > 1000):
        status.videoUrl = _public_url(request, selected.layout, mp4.name)
        status.mediaType = "video"
    return status


@router.get("/api/wallpaper/image/{layout}/{filename:path}")
def wallpaper_image(layout: str, filename: str):
    path = catalog_store.wallpaper_file(layout, filename)
    if not path:
        raise HTTPException(404, "File not found")
    media = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "video/mp4"
    return FileResponse(path, media_type=media)


@router.get("/api/gallery")
def gallery(layout: str | None = None) -> list[dict[str, Any]]:
    records = catalog_store.load_catalog()
    if layout:
        records = [r for r in records if r.layout.lower() == layout.lower()]
    records.sort(key=lambda r: r.mtime, reverse=True)
    return [r.model_dump() for r in records]


@router.post("/api/gallery/delete/{record_id}")
def gallery_delete(record_id: str) -> dict[str, Any]:
    catalog_store.remove_records({record_id})
    return {"status": "ok"}


@router.get("/api/settings")
def get_settings() -> dict[str, Any]:
    return load_settings().model_dump()


@router.post("/api/settings")
def post_settings(settings: AppSettings) -> dict[str, Any]:
    save_settings(settings)
    reload_jobs()
    return {"status": "ok", "settings": settings.model_dump()}


@router.post("/api/settings/test/{provider}")
def test_provider(provider: str) -> dict[str, Any]:
    settings = load_settings()
    key = provider.lower()
    if key == "jellyfin":
        cfg = settings.jellyfin or {}
        return JellyfinProvider(url=cfg.get("url") or "", api_key=cfg.get("api_key") or "", user_id=cfg.get("user_id") or "").test()
    if key in ("seerr", "jellyseerr"):
        cfg = settings.jellyseerr or {}
        return SeerrProvider(url=cfg.get("url") or "", api_key=cfg.get("api_key") or "").test()
    if key == "tmdb":
        cfg = settings.tmdb or {}
        return TmdbProvider(api_key=cfg.get("api_key") or "").test()
    if key == "demo":
        return DemoProvider().test()
    raise HTTPException(404, "Unknown provider")


@router.get("/api/media")
def media_preview(source: str = "demo", limit: int = 12) -> list[dict[str, Any]]:
    return [item.model_dump() for item in collect_items(source, limit)]


@router.post("/api/generate")
def generate(request: GenerateRequest) -> dict[str, Any]:
    return run_generate(request)


@router.post("/api/wallpaper/generate-motion")
def generate_motion_batch(layout: str = "Netflix Hero") -> dict[str, Any]:
    from app.motion import generate_motion

    settings = load_settings()
    done = []
    for rec in catalog_store.load_catalog():
        if rec.layout.lower() != layout.lower():
            continue
        jpg = catalog_store.wallpaper_file(rec.layout, rec.filename)
        if not jpg:
            continue
        ok, msg = generate_motion(jpg, quality=settings.motion_quality)
        if ok:
            rec.has_video = True
            catalog_store.upsert(rec)
            done.append(rec.filename)
    return {"status": "ok", "generated": done}
