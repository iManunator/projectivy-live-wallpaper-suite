from __future__ import annotations

from app.providers.jellyfin import JellyfinProvider
from app.providers.seerr import SeerrProvider


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
