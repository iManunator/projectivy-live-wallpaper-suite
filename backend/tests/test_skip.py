from __future__ import annotations

from app.models import MediaItem, WallpaperRecord
from app.skip import matching_records, records_to_cleanup, should_skip


def test_skip_by_jellyfin_id():
    catalog = [
        WallpaperRecord(id="1", layout="Netflix Hero", filename="a.jpg", title="Northlight", jellyfin_id="demo-jf-1")
    ]
    item = MediaItem(title="Northlight Recut", jellyfin_id="demo-jf-1")
    assert should_skip(catalog, item, "Netflix Hero", True)
    assert not should_skip(catalog, item, "Netflix Hero", False)


def test_skip_by_tmdb_id_across_title_changes():
    catalog = [
        WallpaperRecord(id="1", layout="Netflix Hero", filename="a.jpg", title="Old", tmdb_id="90004")
    ]
    item = MediaItem(title="New Name", tmdb_id="90004")
    assert matching_records(catalog, item, "Netflix Hero")[0].id == "1"


def test_cleanup_drops_titles_not_in_current_list():
    catalog = [
        WallpaperRecord(id="keep", layout="A", filename="a.jpg", title="Keep", jellyfin_id="1"),
        WallpaperRecord(id="drop", layout="A", filename="b.jpg", title="Drop", jellyfin_id="2"),
        WallpaperRecord(id="other", layout="B", filename="c.jpg", title="Other", jellyfin_id="2"),
    ]
    current = [MediaItem(title="Keep", jellyfin_id="1")]
    doomed = records_to_cleanup(catalog, current, "A")
    assert [d.id for d in doomed] == ["drop"]
