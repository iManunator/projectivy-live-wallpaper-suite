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


def test_unconfigured_providers_do_not_call_network():
    assert JellyfinProvider().test()["ok"] is False
    assert SeerrProvider().test()["ok"] is False
    assert TmdbProvider().test()["ok"] is False
    assert JellyfinProvider().list_items() == []
    assert SeerrProvider().list_items() == []
    assert DemoProvider().test()["ok"] is True


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
