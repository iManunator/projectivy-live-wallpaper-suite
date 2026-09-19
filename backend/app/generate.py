"""Generate stills (and optional motion) from provider media lists."""

from __future__ import annotations

import time
import uuid
from pathlib import Path

from app import catalog as catalog_store
from app.config import load_settings
from app.layouts import load_layout
from app.models import GenerateRequest, MediaItem, WallpaperRecord
from app.motion import generate_motion, has_motion, profile_from_settings
from app.providers import HttpClient
from app.providers.demo import DemoProvider
from app.providers.jellyfin import JellyfinProvider
from app.providers.seerr import SeerrProvider
from app.providers.tmdb import TmdbProvider
from app.render import render_chrome, render_plate, render_still, save_jpeg, save_png
from app.skip import matching_records, media_ids_of, records_to_cleanup, should_skip


def _providers_from_settings():
    settings = load_settings()
    jf = settings.jellyfin or {}
    se = settings.jellyseerr or {}
    tm = settings.tmdb or {}
    return {
        "demo": DemoProvider(),
        "jellyfin": JellyfinProvider(url=jf.get("url") or "", api_key=jf.get("api_key") or "", user_id=jf.get("user_id") or ""),
        "jellyseerr": SeerrProvider(url=se.get("url") or "", api_key=se.get("api_key") or "", trending_window=se.get("trending_window") or "week"),
        "tmdb": TmdbProvider(api_key=tm.get("api_key") or "", language=tm.get("language") or "en-US"),
    }


def collect_items(source: str, limit: int) -> list[MediaItem]:
    providers = _providers_from_settings()
    key = (source or "demo").lower()
    if key in ("seerr", "jellyseerr"):
        key = "jellyseerr"
    if key == "all":
        items: list[MediaItem] = []
        for name in ("jellyfin", "jellyseerr", "demo"):
            try:
                items.extend(providers[name].list_items(limit=limit))
            except Exception:
                continue
        return _dedupe(items)[:limit]
    provider = providers.get(key) or providers["demo"]
    try:
        items = provider.list_items(limit=limit)
    except Exception:
        items = []
    if not items and key != "demo":
        items = providers["demo"].list_items(limit=limit)
    tmdb = providers["tmdb"]
    if tmdb.is_configured():
        items = [tmdb.enrich(item) for item in items]
    return items


def _dedupe(items: list[MediaItem]) -> list[MediaItem]:
    seen: set[str] = set()
    out = []
    for item in items:
        key = item.jellyfin_id or item.tmdb_id or item.imdb_id or f"{item.title}|{item.year}"
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _filename_for(item: MediaItem) -> str:
    slug = "".join(ch if ch.isalnum() else "-" for ch in item.title.lower()).strip("-")
    suffix = item.jellyfin_id or item.tmdb_id or item.imdb_id or uuid.uuid4().hex[:8]
    return f"{slug[:40]}-{suffix}.jpg"


def _artwork_urls(item: MediaItem) -> list[str]:
    """Backdrop first; poster fills in when Jellyfin has no wide art."""
    seen: set[str] = set()
    urls: list[str] = []
    for url in (item.backdrop_url, item.poster_url):
        if url and url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def _headers_for_url(url: str) -> dict[str, str] | None:
    settings = load_settings()
    jf = settings.jellyfin or {}
    base = (jf.get("url") or "").rstrip("/")
    key = jf.get("api_key") or ""
    if base and key and url.startswith(base):
        return JellyfinProvider(url=base, api_key=key, user_id=jf.get("user_id") or "")._headers()
    return None


def _looks_like_image(data: bytes) -> bool:
    return bool(data) and (
        data[:3] == b"\xff\xd8\xff"
        or data[:8] == b"\x89PNG\r\n\x1a\n"
        or data[:6] in (b"GIF87a", b"GIF89a")
        or data[:4] == b"RIFF"
        or data[:4] == b"\x00\x00\x00\x0c"
    )


def _default_http_get(url: str) -> bytes:
    data = HttpClient(timeout=30.0).get_bytes(url, headers=_headers_for_url(url))
    if not _looks_like_image(data):
        raise ValueError(f"Not an image: {url}")
    return data


def _fetch_artwork(item: MediaItem, http_get=None) -> bytes | None:
    getter = http_get or _default_http_get
    for url in _artwork_urls(item):
        try:
            data = getter(url)
        except Exception:
            continue
        if data:
            return data
    return None


def generate_one(
    item: MediaItem,
    layout_name: str,
    motion: bool = False,
    replace: bool = False,
    http_get=None,
) -> WallpaperRecord | None:
    layout = load_layout(layout_name)
    if layout is None:
        raise ValueError(f"Unknown layout: {layout_name}")
    catalog = catalog_store.load_catalog()
    previous = matching_records(catalog, item, layout_name)
    keep_pinned = any(rec.pinned for rec in previous)
    keep_hidden = any(rec.hidden for rec in previous)
    if replace:
        doomed = previous
        if doomed:
            catalog_store.remove_records({rec.id for rec in doomed})
    backdrop_bytes = _fetch_artwork(item, http_get=http_get)
    settings = load_settings()
    from app.overlays import apply_overlays

    image = apply_overlays(render_still(item, layout, backdrop_bytes=backdrop_bytes), settings)
    filename = _filename_for(item)
    dest: Path = catalog_store.layout_dir(layout_name) / filename
    save_jpeg(image, dest)
    want_motion = motion or settings.motion_wallpapers
    video = False
    style = None
    if want_motion:
        profile = profile_from_settings(settings)
        plate_path = dest.with_name(dest.stem + "_plate.jpg")
        chrome_path = dest.with_name(dest.stem + "_chrome.png")
        save_jpeg(render_plate(item, layout, backdrop_bytes=backdrop_bytes), plate_path)
        save_png(apply_overlays(render_chrome(item, layout), settings), chrome_path)
        ok, _ = generate_motion(
            dest,
            profile=profile,
            force=True,
            plate=plate_path,
            chrome=chrome_path,
        )
        plate_path.unlink(missing_ok=True)
        chrome_path.unlink(missing_ok=True)
        video = ok and has_motion(dest)
        if video:
            style = profile.normalized_style()
    record = WallpaperRecord(
        id=uuid.uuid4().hex,
        layout=layout_name,
        filename=filename,
        title=item.title,
        year=item.year,
        rating=item.rating,
        genres=item.genres,
        official_rating=item.official_rating,
        watch_state=item.watch_state,
        library_state=item.library_state,
        availability=item.availability,
        source=item.source,
        jellyfin_id=item.jellyfin_id,
        tmdb_id=item.tmdb_id,
        imdb_id=item.imdb_id,
        action_url=item.action_url,
        overview=item.overview,
        mtime=time.time(),
        has_video=video,
        parallax_style=style,
        pinned=keep_pinned,
        hidden=keep_hidden,
    )
    catalog_store.upsert(record)
    return record


def run_generate(request: GenerateRequest, http_get=None) -> dict:
    items = collect_items(request.source, request.limit)
    if request.ids:
        wanted = {i.lower() for i in request.ids}
        items = [
            item
            for item in items
            if (item.jellyfin_id or "").lower() in wanted
            or (item.tmdb_id or "").lower() in wanted
            or (item.imdb_id or "").lower() in wanted
        ]
    if request.skip_ids:
        banned = {i.lower() for i in request.skip_ids}
        items = [item for item in items if not (media_ids_of(item) & banned)]
    catalog = catalog_store.load_catalog()
    created: list[str] = []
    skipped: list[str] = []
    replaced: list[str] = []
    for item in items:
        if should_skip(catalog, item, request.layout, request.skip_existing and not request.replace_existing):
            skipped.append(item.title)
            continue
        if request.replace_existing and matching_records(catalog, item, request.layout):
            replaced.append(item.title)
        record = generate_one(
            item,
            request.layout,
            motion=request.motion,
            replace=request.replace_existing,
            http_get=http_get,
        )
        if record:
            created.append(record.title)
            catalog = catalog_store.load_catalog()
    cleaned: list[str] = []
    if request.cleanup:
        doomed = records_to_cleanup(catalog_store.load_catalog(), items, request.layout)
        cleaned = [rec.title for rec in doomed]
        catalog_store.remove_records({rec.id for rec in doomed})
    return {
        "created": created,
        "skipped": skipped,
        "replaced": replaced,
        "cleaned": cleaned,
        "count": len(created),
    }


def seed_demo_catalog(layout: str = "Netflix Hero", limit: int = 6) -> dict:
    """First-boot demo seed.

    Titles are generated last-to-first so ``sort=latest`` is the first demo
    title (Northlight), matching VERIFY.md.
    """
    items = list(reversed(collect_items("demo", limit)))
    created: list[str] = []
    for item in items:
        record = generate_one(item, layout, motion=False, replace=False)
        if record:
            created.append(record.title)
    return {"created": created, "count": len(created)}
