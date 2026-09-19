"""Generate stills (and optional motion) from provider media lists."""

from __future__ import annotations

import time
import uuid
from pathlib import Path

from app import catalog as catalog_store
from app.config import load_settings
from app.demo_art import logo_bytes_for_item, still_path_for_item
from app.images import looks_like_image
from app.layouts import load_layout
from app.messages import generate_message
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


def collect_items(source: str, limit: int, warnings: list[str] | None = None) -> list[MediaItem]:
    providers = _providers_from_settings()
    key = (source or "demo").lower()
    if key in ("seerr", "jellyseerr"):
        key = "jellyseerr"
    notes = warnings if warnings is not None else []

    def warn(message: str) -> None:
        notes.append(message)

    if key == "all":
        items: list[MediaItem] = []
        for name in ("jellyfin", "jellyseerr", "demo"):
            provider = providers[name]
            if name != "demo" and not provider.is_configured():
                continue
            try:
                items.extend(provider.list_items(limit=limit))
            except Exception as exc:
                warn(f"{name}: {exc}")
                continue
        if not items:
            warn("No configured libraries returned titles; using the demo catalog.")
            items = providers["demo"].list_items(limit=limit)
        return _dedupe(items)[:limit]
    provider = providers.get(key) or providers["demo"]
    items = []
    used_fallback = False
    if key != "demo" and not provider.is_configured():
        label = "Jellyfin" if key == "jellyfin" else "Jellyseerr / Seerr" if key == "jellyseerr" else key
        warn(f"{label} is not configured. Using the demo catalog.")
        used_fallback = True
        items = providers["demo"].list_items(limit=limit)
    else:
        try:
            items = provider.list_items(limit=limit)
        except Exception as exc:
            label = "Jellyfin" if key == "jellyfin" else "Jellyseerr / Seerr" if key == "jellyseerr" else key
            warn(f"{label} request failed: {exc}. Using the demo catalog.")
            used_fallback = True
            items = []
        if not items and key != "demo":
            if not used_fallback:
                label = "Jellyfin" if key == "jellyfin" else "Jellyseerr / Seerr" if key == "jellyseerr" else key
                warn(f"{label} returned no movies or series. Using the demo catalog.")
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
        return JellyfinProvider(url=base, api_key=key, user_id=jf.get("user_id") or "").auth_headers()
    return None


def _looks_like_image(data: bytes) -> bool:
    return looks_like_image(data)


def _default_http_get(url: str) -> bytes:
    data = HttpClient(timeout=30.0).get_bytes(url, headers=_headers_for_url(url))
    if not _looks_like_image(data):
        raise ValueError(f"Not an image: {url}")
    return data


def _logo_urls(item: MediaItem) -> list[str]:
    urls: list[str] = []
    for url in (item.logo_url,):
        if url and url not in urls and url.startswith(("http://", "https://")):
            urls.append(url)
    return urls


def _fetch_logo(item: MediaItem, http_get=None) -> bytes | None:
    bundled = logo_bytes_for_item(item)
    if bundled:
        return bundled
    getter = http_get or _default_http_get
    for url in _logo_urls(item):
        try:
            data = getter(url)
        except Exception:
            continue
        if data and looks_like_image(data):
            return data
    tmdb_url = _tmdb_logo_url(item)
    if tmdb_url:
        try:
            data = getter(tmdb_url)
        except Exception:
            return None
        if data and looks_like_image(data):
            return data
    return None


def _tmdb_logo_url(item: MediaItem) -> str | None:
    if item.logo_url and item.logo_url.startswith(("http://", "https://")):
        return None
    settings = load_settings()
    tm = settings.tmdb or {}
    key = tm.get("api_key") or ""
    if not key or not item.tmdb_id:
        return None
    try:
        return TmdbProvider(api_key=key, language=tm.get("language") or "en-US").fetch_logo_url(
            item.tmdb_id, item.media_type
        )
    except Exception:
        return None


def resolve_logo_bytes(
    item_id: str,
    tmdb_id: str | None = None,
    media_type: str = "movie",
    http_get=None,
) -> bytes | None:
    """Demo fixture, then Jellyfin Logo, then TMDB logos. Never raises."""
    from app.demo_art import logo_bytes

    try:
        bundled = logo_bytes(item_id) or (logo_bytes(tmdb_id) if tmdb_id else None)
        if bundled:
            return bundled
        kind = "tv" if media_type == "tv" else "movie"
        settings = load_settings()
        jf = settings.jellyfin or {}
        base = (jf.get("url") or "").rstrip("/")
        key = jf.get("api_key") or ""
        logo_url = f"{base}/Items/{item_id}/Images/Logo" if base and key and item_id else None
        item = MediaItem(
            title="",
            media_type=kind,
            jellyfin_id=item_id or None,
            tmdb_id=tmdb_id or None,
            logo_url=logo_url,
            source="jellyfin" if logo_url else "tmdb",
        )
        return _fetch_logo(item, http_get=http_get)
    except Exception:
        return None


def _fetch_artwork(item: MediaItem, http_get=None) -> bytes | None:
    getter = http_get or _default_http_get
    for url in _artwork_urls(item):
        try:
            data = getter(url)
        except Exception:
            continue
        if data and looks_like_image(data):
            return data
    local = still_path_for_item(item)
    if local and local.is_file():
        return local.read_bytes()
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
    logo_bytes = _fetch_logo(item, http_get=http_get)
    settings = load_settings()
    from app.overlays import apply_overlays

    image = apply_overlays(render_still(item, layout, backdrop_bytes=backdrop_bytes, logo_bytes=logo_bytes), settings)
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
        save_png(apply_overlays(render_chrome(item, layout, logo_bytes=logo_bytes), settings), chrome_path)
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
    warnings: list[str] = []
    failed: list[str] = []
    pull = request.limit
    if request.ids:
        pull = max(request.limit, 40)
    items = collect_items(request.source, pull, warnings=warnings)
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
        try:
            record = generate_one(
                item,
                request.layout,
                motion=request.motion,
                replace=request.replace_existing,
                http_get=http_get,
            )
        except ValueError:
            raise
        except Exception as exc:
            failed.append(item.title)
            warnings.append(f"{item.title}: could not render ({exc})")
            continue
        if record:
            created.append(record.title)
            catalog = catalog_store.load_catalog()
    cleaned: list[str] = []
    if request.cleanup:
        doomed = records_to_cleanup(catalog_store.load_catalog(), items, request.layout)
        cleaned = [rec.title for rec in doomed]
        catalog_store.remove_records({rec.id for rec in doomed})
    result = {
        "created": created,
        "skipped": skipped,
        "replaced": replaced,
        "cleaned": cleaned,
        "failed": failed,
        "warnings": warnings,
        "count": len(created),
    }
    result["message"] = generate_message(request.layout, result)
    return result


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
