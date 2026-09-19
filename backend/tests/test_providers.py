from __future__ import annotations

from app.models import MediaItem
from app.providers.demo import DemoProvider
from app.providers.jellyfin import JellyfinProvider
from app.providers.seerr import SeerrProvider
from app.providers.tmdb import TmdbProvider


class FakeClient:
    def __init__(self, payload):
        self.payload = payload

    def get_json(self, url, headers=None, params=None):
        return self.payload


def test_jellyfin_parses_watch_state_and_deep_link():
    payload = {
        "Items": [
            {
                "Id": "abc",
                "Name": "Dune",
                "ProductionYear": 2021,
                "Overview": "Sand",
                "CommunityRating": 8.5,
                "Genres": ["Sci-Fi"],
                "OfficialRating": "PG-13",
                "Type": "Movie",
                "RunTimeTicks": 9_000_000_000 * 60 * 155,
                "ProviderIds": {"Tmdb": "438631", "Imdb": "tt1160419"},
                "UserData": {"Played": False, "PlaybackPositionTicks": 0},
            }
        ]
    }
    provider = JellyfinProvider(url="http://jf:8096", api_key="k", user_id="u", client=FakeClient(payload))
    items = provider.list_items()
    assert len(items) == 1
    assert items[0].title == "Dune"
    assert items[0].watch_state == "unwatched"
    assert items[0].action_url == "jellyfin://items/abc"
    assert items[0].tmdb_id == "438631"
    assert items[0].source == "jellyfin"
    assert items[0].backdrop_url == "http://jf:8096/Items/abc/Images/Backdrop?maxWidth=1920"
    assert items[0].poster_url == "http://jf:8096/Items/abc/Images/Primary?maxHeight=600"
    assert items[0].logo_url == "http://jf:8096/Items/abc/Images/Logo"


def test_seerr_marks_requestable_when_not_in_library():
    payload = {
        "results": [
            {
                "id": 55,
                "title": "The Menu",
                "mediaType": "movie",
                "releaseDate": "2022-11-18",
                "overview": "Dinner",
                "voteAverage": 7.2,
                "backdropPath": "/x.jpg",
                "mediaInfo": {"status": "UNKNOWN"},
            }
        ]
    }
    provider = SeerrProvider(url="http://seerr:5055", api_key="k", client=FakeClient(payload))
    items = provider.list_items()
    assert items[0].library_state == "seerr_only"
    assert items[0].availability == "requestable"
    assert items[0].tmdb_id == "55"
    assert items[0].source == "jellyseerr"


def test_seerr_reads_tmdb_shaped_logos():
    payload = {
        "results": [
            {
                "id": 77,
                "title": "Clearmark",
                "mediaType": "movie",
                "releaseDate": "2021-01-01",
                "voteAverage": 8,
                "images": {
                    "logos": [
                        {"file_path": "/fr.png", "iso_639_1": "fr", "vote_average": 9},
                        {"file_path": "/en-logo.png", "iso_639_1": "en", "vote_average": 2},
                    ]
                },
            }
        ]
    }
    item = SeerrProvider(url="http://seerr:5055", api_key="k", client=FakeClient(payload)).list_items()[0]
    assert item.logo_url == "https://image.tmdb.org/t/p/original/en-logo.png"


def test_jellyfin_partial_and_watched():
    payload = {
        "Items": [
            {
                "Id": "p1",
                "Name": "Mid-credit",
                "UserData": {"Played": False, "PlaybackPositionTicks": 50_000_000},
            },
            {
                "Id": "w1",
                "Name": "Finished",
                "UserData": {"Played": True, "PlaybackPositionTicks": 0},
            },
        ]
    }
    items = JellyfinProvider(url="http://jf:8096", api_key="k", user_id="u", client=FakeClient(payload)).list_items()
    states = {item.title: item.watch_state for item in items}
    assert states["Mid-credit"] == "partial"
    assert states["Finished"] == "watched"


def test_demo_items_have_bundled_stills():
    from pathlib import Path

    from app.demo_art import load_catalog, still_path_for_item
    from app.providers.demo import DemoProvider

    catalog = load_catalog()
    assert len(catalog) == 6
    items = DemoProvider().list_items()
    assert len(items) == 6
    for item in items:
        path = still_path_for_item(item)
        assert path is not None, item.title
        assert Path(item.backdrop_path).is_file()
        assert Path(item.backdrop_path).stat().st_size > 20_000
    north = next(item for item in items if item.title == "Northlight")
    assert north.logo_url
    harbor = next(item for item in items if item.title == "Harbor Season")
    assert not harbor.logo_url


def test_looks_like_image_rejects_html_and_wav():
    from app.images import looks_like_image

    assert looks_like_image(b"\xff\xd8\xff" + b"\x00" * 8)
    assert not looks_like_image(b"<!DOCTYPE html>")
    assert not looks_like_image(b"RIFF" + b"\x00" * 4 + b"WAVE")
    assert looks_like_image(b"RIFF" + b"\x00" * 4 + b"WEBP")


def test_unconfigured_providers_do_not_call_network():
    assert JellyfinProvider().test()["ok"] is False
    assert SeerrProvider().test()["ok"] is False
    assert TmdbProvider().test()["ok"] is False
    assert JellyfinProvider().list_items() == []
    assert SeerrProvider().list_items() == []
    assert DemoProvider().test()["ok"] is True


def test_seerr_test_uses_auth_me_not_public_status():
    """``/api/v1/status`` is public; a real key check must hit ``/api/v1/auth/me``."""

    class Client:
        def __init__(self):
            self.urls: list[str] = []

        def get_json(self, url, headers=None, params=None):
            self.urls.append(url)
            assert headers and headers.get("X-Api-Key") == "secret"
            assert headers.get("Authorization") == "Bearer secret"
            if url.endswith("/auth/me"):
                return {"id": 1, "displayName": "Admin", "email": "a@b.c"}
            if url.endswith("/status"):
                return {"version": "3.4.1"}
            raise AssertionError(f"unexpected url {url}")

    client = Client()
    out = SeerrProvider(url="http://seerr:5055", api_key="  Bearer secret  ", client=client).test()
    assert out["ok"] is True
    assert out["server"] == "3.4.1"
    assert any(u.endswith("/auth/me") for u in client.urls)
    assert client.urls[0].endswith("/auth/me")


def test_seerr_test_rejects_bad_api_key():
    import httpx

    class Client:
        def get_json(self, url, headers=None, params=None):
            request = httpx.Request("GET", url)
            response = httpx.Response(403, request=request, json={"error": "forbidden"})
            raise httpx.HTTPStatusError("forbidden", request=request, response=response)

    out = SeerrProvider(url="http://seerr:5055", api_key="bad", client=Client()).test()
    assert out["ok"] is False
    assert "API key" in out["error"]


def test_seerr_strips_bearer_prefix_and_sends_both_headers():
    seen: dict = {}

    class Client:
        def get_json(self, url, headers=None, params=None):
            seen["headers"] = headers
            return {"results": []}

    SeerrProvider(url="http://seerr:5055", api_key="Bearer abc.def", client=Client()).list_items()
    assert seen["headers"]["X-Api-Key"] == "abc.def"
    assert seen["headers"]["Authorization"] == "Bearer abc.def"


def test_tmdb_enrich_fills_missing_artwork():
    class Client:
        def get_json(self, url, headers=None, params=None):
            return {
                "id": 42,
                "overview": "Enriched",
                "vote_average": 8.1,
                "genres": [{"name": "Sci-Fi"}],
                "backdrop_path": "/back.jpg",
                "poster_path": "/poster.jpg",
            }

    item = MediaItem(title="Probe", tmdb_id="42")
    out = TmdbProvider(api_key="k", client=Client()).enrich(item)
    assert out.overview == "Enriched"
    assert out.backdrop_url.endswith("/back.jpg")
    assert out.poster_url.endswith("/poster.jpg")
    skipped = TmdbProvider(api_key="").enrich(item)
    assert skipped.overview == ""


def test_tmdb_selects_english_png_logo():
    from app.providers.tmdb import logo_image_url, select_logo_path

    path = select_logo_path(
        {
            "logos": [
                {"file_path": "/ja.jpg", "iso_639_1": "ja", "vote_average": 9},
                {"file_path": "/en.png", "iso_639_1": "en", "vote_average": 1},
                {"file_path": "/plain.png", "iso_639_1": None, "vote_average": 8},
            ]
        },
        language="en-US",
    )
    assert path == "/en.png"
    assert logo_image_url(path) == "https://image.tmdb.org/t/p/original/en.png"


def test_tmdb_enrich_fetches_logo_from_images_api():
    class Client:
        def get_json(self, url, headers=None, params=None):
            if "/images" in url:
                assert "include_image_language" in (params or {})
                return {"logos": [{"file_path": "/mark.png", "iso_639_1": "en", "vote_average": 5}]}
            return {"id": 42, "overview": "Enriched", "vote_average": 8.1, "genres": [], "backdrop_path": "/b.jpg"}

    out = TmdbProvider(api_key="k", client=Client()).enrich(MediaItem(title="Probe", tmdb_id="42"))
    assert out.logo_url == "https://image.tmdb.org/t/p/original/mark.png"


def test_tmdb_logo_fetch_survives_missing_payload():
    class Client:
        def get_json(self, url, headers=None, params=None):
            raise RuntimeError("nope")

    assert TmdbProvider(api_key="k", client=Client()).fetch_logo_url("1", "movie") is None


def test_jellyfin_uses_primary_when_no_backdrop_tag():
    payload = {
        "Items": [
            {
                "Id": "poster-only",
                "Name": "Still",
                "ImageTags": {"Primary": "aaa"},
                "BackdropImageTags": [],
            }
        ]
    }
    item = JellyfinProvider(url="http://jf:8096", api_key="k", user_id="u", client=FakeClient(payload)).list_items()[0]
    assert item.backdrop_url == "http://jf:8096/Items/poster-only/Images/Primary?maxWidth=1920"
    assert item.poster_url == "http://jf:8096/Items/poster-only/Images/Primary?maxHeight=600"
    assert item.logo_url is None


def test_jellyfin_logo_tag_builds_logo_url():
    payload = {
        "Items": [
            {
                "Id": "with-logo",
                "Name": "Marked",
                "ImageTags": {"Primary": "p", "Logo": "lg"},
                "BackdropImageTags": ["b"],
            }
        ]
    }
    item = JellyfinProvider(url="http://jf:8096", api_key="k", user_id="u", client=FakeClient(payload)).list_items()[0]
    assert item.logo_url == "http://jf:8096/Items/with-logo/Images/Logo"
    assert item.backdrop_url == "http://jf:8096/Items/with-logo/Images/Backdrop?maxWidth=1920"
