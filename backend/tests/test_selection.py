from __future__ import annotations

from app.models import WallpaperRecord
from app.selection import SelectionQuery, select_wallpaper, unique_values


def _rec(**kwargs) -> WallpaperRecord:
    defaults = dict(
        id="x",
        layout="Netflix Hero",
        filename="x.jpg",
        title="X",
        year=2020,
        rating=7.0,
        genres=["Drama"],
        official_rating="PG",
        watch_state="unwatched",
        library_state="in_library",
        source="jellyfin",
        mtime=1.0,
    )
    defaults.update(kwargs)
    return WallpaperRecord(**defaults)


def test_layout_filter_excludes_other_collections(seeded_catalog):
    picked = select_wallpaper(seeded_catalog, SelectionQuery(layout="Prime Cinematic", sort="rating"))
    assert picked is not None
    assert picked.layout == "Prime Cinematic"
    assert picked.title == "Night Relay"


def test_unknown_layout_returns_none(seeded_catalog):
    assert select_wallpaper(seeded_catalog, SelectionQuery(layout="Missing")) is None


def test_genre_filter(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", genre="Sci-Fi", sort="rating"),
    )
    assert picked is not None
    assert picked.title == "Northlight"


def test_age_rating_normalizes_punctuation(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", age_rating="pg13", sort="year"),
    )
    assert picked is not None
    assert picked.official_rating == "PG-13"


def test_year_range(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", min_year=2020, max_year=2025, sort="year_asc"),
    )
    assert picked is not None
    assert picked.year == 2022


def test_rating_range(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", min_rating=8.2, sort="rating"),
    )
    assert picked is not None
    assert picked.title == "Northlight"


def test_sort_latest_uses_mtime(seeded_catalog):
    picked = select_wallpaper(seeded_catalog, SelectionQuery(layout="Netflix Hero", sort="latest"))
    assert picked is not None
    assert picked.title == "Northlight"


def test_sort_oldest(seeded_catalog):
    picked = select_wallpaper(seeded_catalog, SelectionQuery(layout="Netflix Hero", sort="oldest"))
    assert picked is not None
    assert picked.title == "Glass Orchard"


def test_pool_unwatched(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", pool="unwatched", sort="rating"),
    )
    assert picked is not None
    assert picked.watch_state == "unwatched"


def test_pool_partial(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", pool="partial", sort="random"),
    )
    assert picked is not None
    assert picked.title == "Harbor Season"


def test_pool_seerr_only(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Prime Cinematic", pool="seerr_only", sort="random"),
    )
    assert picked is not None
    assert picked.title == "Signal Country"


def test_pool_source_jellyfin(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", pool="source:jellyfin", sort="year"),
    )
    assert picked is not None
    assert picked.source == "jellyfin"


def test_exclude_skips_recent_filename(seeded_catalog):
    picked = select_wallpaper(
        seeded_catalog,
        SelectionQuery(layout="Netflix Hero", sort="rating", exclude="northlight.jpg"),
    )
    assert picked is not None
    assert picked.title != "Northlight"


def test_exclude_falls_back_when_all_excluded():
    catalog = [_rec(id="only", filename="only.jpg", title="Only")]
    picked = select_wallpaper(catalog, SelectionQuery(layout="Netflix Hero", exclude="only.jpg"))
    assert picked is not None
    assert picked.title == "Only"


def test_unique_genres(seeded_catalog):
    genres = unique_values(seeded_catalog, "genres")
    assert "Sci-Fi" in genres
    assert "Drama" in genres
