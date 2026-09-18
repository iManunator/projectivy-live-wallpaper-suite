"""Jellyfin library client (Movies / Series)."""

from __future__ import annotations

from urllib.parse import urljoin

from app.models import MediaItem
from app.providers import HttpClient


class JellyfinProvider:
    name = "jellyfin"

    def __init__(self, url: str = "", api_key: str = "", user_id: str = "", client: HttpClient | None = None):
        self.url = (url or "").rstrip("/")
        self.api_key = api_key or ""
        self.user_id = user_id or ""
        self.client = client or HttpClient()

    def is_configured(self) -> bool:
        return bool(self.url and self.api_key)

    def _headers(self) -> dict[str, str]:
        auth = (
            'MediaBrowser Client="Wallpaparr", Device="wallpaparr", '
            f'DeviceId="wallpaparr", Version="1.0.0"'
        )
        if self.api_key:
            auth += f', Token="{self.api_key}"'
        return {"Authorization": auth, "X-Emby-Token": self.api_key}

    def test(self) -> dict:
        if not self.is_configured():
            return {"ok": False, "error": "Jellyfin URL and API key are required"}
        try:
            info = self.client.get_json(f"{self.url}/System/Info/Public", headers=self._headers())
            return {"ok": True, "server": info.get("ServerName") or info.get("serverName") or "Jellyfin"}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def list_items(self, limit: int = 40) -> list[MediaItem]:
        if not self.is_configured():
            return []
        user = self.user_id or self._first_user()
        params = {
            "IncludeItemTypes": "Movie,Series",
            "Recursive": "true",
            "Fields": "Overview,Genres,OfficialRating,CommunityRating,ProviderIds,RunTimeTicks,UserData",
            "Limit": str(limit),
            "SortBy": "DateLastContentAdded,SortName",
            "SortOrder": "Descending",
            "ImageTypeLimit": "1",
            "EnableImageTypes": "Backdrop,Logo,Primary",
        }
        path = f"/Users/{user}/Items" if user else "/Items"
        payload = self.client.get_json(urljoin(self.url + "/", path.lstrip("/")), headers=self._headers(), params=params)
        items = payload.get("Items") if isinstance(payload, dict) else payload
        out: list[MediaItem] = []
        for raw in items or []:
            parsed = self._parse(raw, user)
            if parsed:
                out.append(parsed)
        return out

    def _first_user(self) -> str:
        try:
            users = self.client.get_json(f"{self.url}/Users", headers=self._headers())
            if isinstance(users, list) and users:
                return str(users[0].get("Id") or "")
        except Exception:
            return ""
        return ""

    def _parse(self, raw: dict, user: str) -> MediaItem | None:
        item_id = str(raw.get("Id") or "")
        if not item_id:
            return None
        providers = raw.get("ProviderIds") or {}
        userdata = raw.get("UserData") or {}
        played = bool(userdata.get("Played"))
        position = float(userdata.get("PlaybackPositionTicks") or 0)
        runtime_ticks = float(raw.get("RunTimeTicks") or 0)
        if played:
            watch = "watched"
        elif position > 0:
            watch = "partial"
        else:
            watch = "unwatched"
        runtime = ""
        if runtime_ticks:
            minutes = int(runtime_ticks / 10_000_000 / 60)
            hours, mins = divmod(minutes, 60)
            runtime = f"{hours}h {mins}m" if hours else f"{mins}m"
        year = raw.get("ProductionYear")
        return MediaItem(
            title=str(raw.get("Name") or "Untitled"),
            year=int(year) if year else None,
            overview=str(raw.get("Overview") or ""),
            rating=float(raw.get("CommunityRating") or 0),
            genres=list(raw.get("Genres") or []),
            official_rating=str(raw.get("OfficialRating") or ""),
            runtime=runtime,
            media_type="tv" if raw.get("Type") in ("Series", "Season") else "movie",
            watch_state=watch,
            library_state="in_library",
            availability="available",
            source="jellyfin",
            jellyfin_id=item_id,
            tmdb_id=str(providers.get("Tmdb") or "") or None,
            imdb_id=str(providers.get("Imdb") or "") or None,
            action_url=f"jellyfin://items/{item_id}",
            backdrop_url=f"{self.url}/Items/{item_id}/Images/Backdrop?maxWidth=1920" if self.url else None,
            logo_url=f"{self.url}/Items/{item_id}/Images/Logo" if self.url else None,
            poster_url=f"{self.url}/Items/{item_id}/Images/Primary?maxHeight=600" if self.url else None,
        )
