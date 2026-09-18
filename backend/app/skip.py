"""Skip / replace / cleanup generated wallpapers by media id."""

from __future__ import annotations

from app.models import MediaItem, WallpaperRecord


def media_ids_of(item: MediaItem) -> set[str]:
    return {
        value.lower()
        for value in (item.jellyfin_id, item.tmdb_id, item.imdb_id)
        if value
    }


def matching_records(catalog: list[WallpaperRecord], item: MediaItem, layout: str | None = None) -> list[WallpaperRecord]:
    ids = media_ids_of(item)
    if not ids:
        title_key = item.title.strip().lower()
        year = item.year
        return [
            rec
            for rec in catalog
            if rec.title.strip().lower() == title_key
            and (year is None or rec.year == year)
            and (layout is None or rec.layout.lower() == layout.lower())
        ]
    return [
        rec
        for rec in catalog
        if rec.media_ids() & ids and (layout is None or rec.layout.lower() == layout.lower())
    ]


def should_skip(catalog: list[WallpaperRecord], item: MediaItem, layout: str, skip_existing: bool) -> bool:
    if not skip_existing:
        return False
    return bool(matching_records(catalog, item, layout))


def records_to_cleanup(
    catalog: list[WallpaperRecord],
    current_items: list[MediaItem],
    layout: str,
) -> list[WallpaperRecord]:
    keep: set[str] = set()
    for item in current_items:
        keep |= media_ids_of(item)
        keep.add(f"{item.title.strip().lower()}|{item.year or ''}")
    doomed = []
    for rec in catalog:
        if rec.layout.lower() != layout.lower():
            continue
        rec_ids = rec.media_ids()
        title_key = f"{rec.title.strip().lower()}|{rec.year or ''}"
        if rec_ids and rec_ids & keep:
            continue
        if not rec_ids and title_key in keep:
            continue
        doomed.append(rec)
    return doomed
