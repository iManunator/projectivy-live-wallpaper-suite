"""Jellyseerr / Seerr discover + request status."""

from __future__ import annotations

from app.models import MediaItem
from app.providers import HttpClient


class SeerrProvider:
    name = "jellyseerr"

    def __init__(self, url: str = "", api_key: str = "", trending_window: str = "week", client: HttpClient | None = None):
        self.url = (url or "").rstrip("/")
        self.api_key = api_key or ""
        self.trending_window = trending_window or "week"
        self.client = client or HttpClient()

    def is_configured(self) -> bool:
        return bool(self.url and self.api_key)

    def _headers(self) -> dict[str, str]:
        return {"X-Api-Key": self.api_key}

    def test(self) -> dict:
        if not self.is_configured():
            return {"ok": False, "error": "Seerr URL and API key are required"}
        try:
            status = self.client.get_json(f"{self.url}/api/v1/status", headers=self._headers())
            return {"ok": True, "server": status.get("version") or "Seerr"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def list_items(self, limit: int = 40) -> list[MediaItem]:
        if not self.is_configured():
            return []
        payload = self.client.get_json(
            f"{self.url}/api/v1/discover/trending",
            headers=self._headers(),
            params={"page": 1, "language": "en"},
        )
        results = payload.get("results") if isinstance(payload, dict) else payload
        out: list[MediaItem] = []
        for raw in (results or [])[:limit]:
            parsed = self._parse(raw)
            if parsed:
                out.append(parsed)
        return out

    def _parse(self, raw: dict) -> MediaItem | None:
        media_info = raw.get("mediaInfo") or {}
        tmdb = str(raw.get("id") or media_info.get("tmdbId") or "")
        if not tmdb:
            return None
        media_type = "tv" if (raw.get("mediaType") or raw.get("type")) in ("tv", "show") else "movie"
        title = raw.get("title") or raw.get("name") or "Untitled"
        date = raw.get("releaseDate") or raw.get("firstAirDate") or ""
        year = int(date[:4]) if date[:4].isdigit() else None
        status = str(media_info.get("status") or "")
        jellyfin_id = str(media_info.get("jellyfinMediaId") or media_info.get("mediaId") or "") or None
        in_library = bool(jellyfin_id) or status.lower() in ("available", "partially_available")
        availability = "available" if in_library else "requestable"
        library_state = "in_library" if in_library else "seerr_only"
        backdrop = raw.get("backdropPath")
        poster = raw.get("posterPath")
        tmdb_img = "https://image.tmdb.org/t/p"
        return MediaItem(
            title=str(title),
            year=year,
            overview=str(raw.get("overview") or ""),
            rating=float(raw.get("voteAverage") or 0),
            genres=[],
            official_rating="",
            media_type=media_type,
            watch_state="unwatched",
            library_state=library_state,
            availability=availability,
            source="jellyseerr",
            jellyfin_id=jellyfin_id,
            tmdb_id=tmdb,
            action_url=f"{self.url}/{media_type}/{tmdb}" if self.url else None,
            backdrop_url=f"{tmdb_img}/w1280{backdrop}" if backdrop else None,
            poster_url=f"{tmdb_img}/w500{poster}" if poster else None,
        )
