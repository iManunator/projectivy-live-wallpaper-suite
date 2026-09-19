"""Jellyseerr / Seerr discover + request status."""

from __future__ import annotations

import httpx

from app.models import MediaItem
from app.providers import HttpClient
from app.providers.tmdb import TMDB_IMAGE, logo_image_url, select_logo_path

# Discover payloads expose TMDB genreIds, not names. Map both movie + TV ids.
TMDB_GENRE_NAMES: dict[int, str] = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
}


def genres_from_seerr(raw: dict) -> list[str]:
    """Resolve genre names from ``genres`` objects/strings or ``genreIds``."""
    out: list[str] = []
    seen: set[str] = set()

    def add(name: str) -> None:
        cleaned = name.strip()
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            out.append(cleaned)

    genres = raw.get("genres")
    if isinstance(genres, list):
        for entry in genres:
            if isinstance(entry, str):
                add(entry)
            elif isinstance(entry, dict):
                name = entry.get("name") or entry.get("Name")
                if name:
                    add(str(name))
    if out:
        return out
    for gid in raw.get("genreIds") or []:
        try:
            key = int(gid)
        except (TypeError, ValueError):
            continue
        name = TMDB_GENRE_NAMES.get(key)
        if name:
            add(name)
    return out


class SeerrProvider:
    name = "jellyseerr"

    def __init__(self, url: str = "", api_key: str = "", trending_window: str = "week", client: HttpClient | None = None):
        self.url = (url or "").rstrip("/")
        # Strip whitespace / accidental "Bearer " paste from Settings.
        key = (api_key or "").strip()
        if key.lower().startswith("bearer "):
            key = key[7:].strip()
        self.api_key = key
        self.trending_window = trending_window or "week"
        self.client = client or HttpClient()

    def is_configured(self) -> bool:
        return bool(self.url and self.api_key)

    def _headers(self) -> dict[str, str]:
        # Seerr / Jellyseerr accept X-Api-Key; some proxies and forks also want Bearer.
        return {
            "X-Api-Key": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    @staticmethod
    def _auth_error(exc: Exception) -> str | None:
        if isinstance(exc, httpx.HTTPStatusError):
            code = exc.response.status_code
            if code in (401, 403):
                return (
                    "Seerr rejected the API key (HTTP "
                    f"{code}). Open Seerr → Settings → General → API Key, "
                    "paste a fresh key, Save settings, then Test again."
                )
        text = str(exc)
        if "401" in text or "403" in text:
            return (
                "Seerr rejected the API key. Open Seerr → Settings → General → API Key, "
                "paste a fresh key, Save settings, then Test again."
            )
        return None

    def test(self) -> dict:
        """Validate the API key against an authenticated route.

        ``/api/v1/status`` is public on Seerr 3.x and returns 200 even with a
        bad or missing key, so it must not be used for connection tests.
        ``/api/v1/auth/me`` requires a valid X-Api-Key (same as discover).
        """
        if not self.is_configured():
            return {"ok": False, "error": "Seerr URL and API key are required"}
        try:
            me = self.client.get_json(f"{self.url}/api/v1/auth/me", headers=self._headers())
        except Exception as exc:
            auth_msg = self._auth_error(exc)
            if auth_msg:
                return {"ok": False, "error": auth_msg}
            return {"ok": False, "error": str(exc)}
        server = "Seerr"
        try:
            status = self.client.get_json(f"{self.url}/api/v1/status", headers=self._headers())
            if isinstance(status, dict) and status.get("version"):
                server = str(status["version"])
        except Exception:
            if isinstance(me, dict) and me.get("displayName"):
                server = str(me.get("displayName"))
        return {"ok": True, "server": server}

    def list_items(self, limit: int = 40) -> list[MediaItem]:
        if not self.is_configured():
            return []
        try:
            payload = self.client.get_json(
                f"{self.url}/api/v1/discover/trending",
                headers=self._headers(),
                params={"page": 1, "language": "en"},
            )
        except Exception as exc:
            auth_msg = self._auth_error(exc)
            if auth_msg:
                raise RuntimeError(auth_msg) from exc
            raise
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
        backdrop = raw.get("backdropPath") or raw.get("backdrop_path")
        poster = raw.get("posterPath") or raw.get("poster_path")
        logo_url = None
        try:
            images = raw.get("images") if isinstance(raw.get("images"), dict) else {}
            path = select_logo_path(images, "en-US") if images else None
            logo_url = logo_image_url(path) or (
                f"{TMDB_IMAGE}/original{raw['logoPath']}" if raw.get("logoPath") else None
            )
        except Exception:
            logo_url = None
        return MediaItem(
            title=str(title),
            year=year,
            overview=str(raw.get("overview") or ""),
            rating=float(raw.get("voteAverage") or 0),
            genres=genres_from_seerr(raw),
            official_rating=str(raw.get("contentRating") or raw.get("certification") or ""),
            media_type=media_type,
            watch_state="unwatched",
            library_state=library_state,
            availability=availability,
            source="jellyseerr",
            jellyfin_id=jellyfin_id,
            tmdb_id=tmdb,
            action_url=(
                f"jellyfin://items/{jellyfin_id}"
                if jellyfin_id
                else (f"{self.url}/{media_type}/{tmdb}" if self.url else None)
            ),
            backdrop_url=f"{TMDB_IMAGE}/w1280{backdrop}" if backdrop else None,
            poster_url=f"{TMDB_IMAGE}/w500{poster}" if poster else None,
            logo_url=logo_url,
        )
