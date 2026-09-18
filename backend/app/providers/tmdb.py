"""Optional TMDB enrichment (title search + images)."""

from __future__ import annotations

from app.models import MediaItem
from app.providers import HttpClient


class TmdbProvider:
    name = "tmdb"

    def __init__(self, api_key: str = "", language: str = "en-US", client: HttpClient | None = None):
        self.api_key = api_key or ""
        self.language = language or "en-US"
        self.client = client or HttpClient()

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def test(self) -> dict:
        if not self.is_configured():
            return {"ok": False, "error": "TMDB API key is required"}
        try:
            self.client.get_json(
                "https://api.themoviedb.org/3/configuration",
                params={"api_key": self.api_key},
            )
            return {"ok": True, "server": "TMDB"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def enrich(self, item: MediaItem) -> MediaItem:
        if not self.is_configured():
            return item
        try:
            kind = "tv" if item.media_type == "tv" else "movie"
            if item.tmdb_id:
                detail = self.client.get_json(
                    f"https://api.themoviedb.org/3/{kind}/{item.tmdb_id}",
                    params={"api_key": self.api_key, "language": self.language},
                )
            else:
                search = self.client.get_json(
                    f"https://api.themoviedb.org/3/search/{kind}",
                    params={"api_key": self.api_key, "query": item.title, "year": item.year or ""},
                )
                results = search.get("results") or []
                if not results:
                    return item
                detail = results[0]
            genres = [g["name"] if isinstance(g, dict) else str(g) for g in detail.get("genres") or []]
            backdrop = detail.get("backdrop_path")
            poster = detail.get("poster_path")
            updates = {
                "overview": item.overview or detail.get("overview") or "",
                "rating": item.rating or float(detail.get("vote_average") or 0),
                "tmdb_id": item.tmdb_id or str(detail.get("id") or "") or None,
            }
            if genres and not item.genres:
                updates["genres"] = genres
            if backdrop and not item.backdrop_url:
                updates["backdrop_url"] = f"https://image.tmdb.org/t/p/w1280{backdrop}"
            if poster and not item.poster_url:
                updates["poster_url"] = f"https://image.tmdb.org/t/p/w500{poster}"
            return item.model_copy(update=updates)
        except Exception:
            return item
