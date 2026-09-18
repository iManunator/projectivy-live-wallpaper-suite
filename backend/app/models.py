"""Shared domain models for media, layouts, and wallpaper catalog entries."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class MediaItem(BaseModel):
    """Normalized title from Jellyfin, Seerr, TMDB, or the demo catalog."""

    title: str
    year: int | None = None
    overview: str = ""
    rating: float = 0.0
    genres: list[str] = Field(default_factory=list)
    official_rating: str = ""
    runtime: str = ""
    media_type: Literal["movie", "tv"] = "movie"
    watch_state: str = ""
    library_state: str = ""
    availability: str = ""
    source: str = "demo"
    jellyfin_id: str | None = None
    tmdb_id: str | None = None
    imdb_id: str | None = None
    action_url: str | None = None
    backdrop_url: str | None = None
    logo_url: str | None = None
    poster_url: str | None = None
    backdrop_path: str | None = None


class Layer(BaseModel):
    id: str
    slot: str
    x: float = 80
    y: float = 80
    width: float | None = None
    height: float | None = None
    font_size: int = 28
    color: str = "#ffffff"
    font_weight: str = "regular"
    max_items: int | None = None
    visible: bool = True
    align: str = "left"


class LayoutBackground(BaseModel):
    mode: str = "backdrop"
    color: str = "#050505"
    fade_left: float = 0.42
    fade_right: float = 0.05
    fade_top: float = 0.08
    fade_bottom: float = 0.38
    fade_softness: float = 0.45
    brightness: float = 1.0


class Layout(BaseModel):
    name: str
    canvas_width: int = 1920
    canvas_height: int = 1080
    background: LayoutBackground = Field(default_factory=LayoutBackground)
    layers: list[Layer] = Field(default_factory=list)
    preset: bool = False
    preset_id: str | None = None
    description: str = ""


class WallpaperRecord(BaseModel):
    id: str
    layout: str
    filename: str
    title: str
    year: int | None = None
    rating: float = 0.0
    genres: list[str] = Field(default_factory=list)
    official_rating: str = ""
    watch_state: str = ""
    library_state: str = ""
    availability: str = ""
    source: str = ""
    jellyfin_id: str | None = None
    tmdb_id: str | None = None
    imdb_id: str | None = None
    action_url: str | None = None
    overview: str = ""
    mtime: float = 0.0
    has_video: bool = False
    parallax_style: str | None = None

    def media_ids(self) -> set[str]:
        return {
            value.lower()
            for value in (self.jellyfin_id, self.tmdb_id, self.imdb_id)
            if value
        }


class WallpaperStatus(BaseModel):
    imageUrl: str | None = None
    videoUrl: str | None = None
    mediaType: str = "image"
    actionUrl: str | None = None
    title: str | None = None
    path: str | None = None
    sort: str | None = None
    pool: str | None = None
    layout: str | None = None
    parallaxStyle: str | None = None
    motionDuration: float | None = None


class GenerateRequest(BaseModel):
    layout: str = "Netflix Hero"
    source: str = "demo"
    limit: int = 8
    skip_existing: bool = True
    replace_existing: bool = False
    cleanup: bool = False
    motion: bool = False
    ids: list[str] = Field(default_factory=list)
    skip_ids: list[str] = Field(default_factory=list)


class AppSettings(BaseModel):
    public_base_url: str = "http://127.0.0.1:8787"
    timezone: str = "UTC"
    motion_wallpapers: bool = False
    motion_quality: str = "light"
    motion_style: str = "parallax"
    motion_intensity: float = 0.55
    motion_duration: float | None = None
    motion_fps: int = 24
    overwrite_existing: bool = False
    editor_theme: str = "cinema"
    jellyfin: dict[str, Any] = Field(default_factory=dict)
    jellyseerr: dict[str, Any] = Field(default_factory=dict)
    tmdb: dict[str, Any] = Field(default_factory=dict)
    cron_jobs: list[dict[str, Any]] = Field(default_factory=list)
