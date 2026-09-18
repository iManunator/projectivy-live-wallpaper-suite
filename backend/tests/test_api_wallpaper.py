from __future__ import annotations


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["service"] == "wallpaparr"


def test_layouts_list_includes_presets(client):
    names = client.get("/api/layouts/list").json()
    assert "Netflix Hero" in names
    assert "Prime Cinematic" in names
    assert "Google TV Clean" in names


def test_layouts_with_images_only_generated(client):
    names = client.get("/api/layouts/with-images").json()
    assert set(names) == {"Netflix Hero", "Prime Cinematic"}


def test_genres_ages_years_lists(client):
    genres = client.get("/api/genres/list").json()
    ages = client.get("/api/ages/list").json()
    years = client.get("/api/year/list").json()
    assert "Sci-Fi" in genres
    assert "PG-13" in ages
    assert "2024" in years


def test_wallpaper_status_random_has_contract_fields(client):
    body = client.get("/api/wallpaper/status", params={"layout": "Netflix Hero", "sort": "latest"}).json()
    assert body["imageUrl"]
    assert body["imageUrl"].endswith("/northlight.jpg") or "northlight.jpg" in body["imageUrl"]
    assert body["title"] == "Northlight"
    assert body["path"] == "northlight.jpg"
    assert body["actionUrl"] == "jellyfin://items/demo-jf-1"
    assert body["mediaType"] in ("image", "video")
    assert body["sort"] == "latest"
    assert body["layout"] == "Netflix Hero"


def test_wallpaper_status_genre_filter(client):
    body = client.get(
        "/api/wallpaper/status",
        params={"layout": "Netflix Hero", "genre": "Drama", "sort": "rating"},
    ).json()
    assert body["title"] in {"Harbor Season", "Glass Orchard"}


def test_wallpaper_status_pool_unwatched(client):
    body = client.get(
        "/api/wallpaper/status",
        params={"layout": "Netflix Hero", "pool": "unwatched", "sort": "random"},
    ).json()
    assert body["title"] == "Northlight"


def test_wallpaper_status_pool_seerr_only(client):
    body = client.get(
        "/api/wallpaper/status",
        params={"layout": "Prime Cinematic", "pool": "seerr_only"},
    ).json()
    assert body["title"] == "Signal Country"


def test_wallpaper_status_exclude(client):
    body = client.get(
        "/api/wallpaper/status",
        params={"layout": "Netflix Hero", "sort": "rating", "exclude": "northlight.jpg"},
    ).json()
    assert body["title"] != "Northlight"
    assert body["path"]


def test_wallpaper_status_year_and_rating_filters(client):
    body = client.get(
        "/api/wallpaper/status",
        params={
            "layout": "Prime Cinematic",
            "min_year": "2020",
            "max_year": "2025",
            "min_rating": "8.0",
            "sort": "rating",
        },
    ).json()
    assert body["title"] == "Night Relay"


def test_options_lists_pick_modes_and_motion(client):
    body = client.get("/api/options").json()
    assert "unwatched" in body["pools"]
    assert "parallax" in body["motion_styles"]
    assert "layout_round_robin" in body["pick_modes"]


def test_wallpaper_status_video_includes_parallax_fields(client):
    body = client.get(
        "/api/wallpaper/status",
        params={"layout": "Prime Cinematic", "sort": "rating"},
    ).json()
    assert body["title"] == "Night Relay"
    assert body["mediaType"] == "video"
    assert body["videoUrl"]
    assert body["imageUrl"]
    assert body["parallaxStyle"] in {"parallax", "kenburns", "drift"}
    assert body["motionDuration"] >= 2


def test_wallpaper_status_missing_layout(client):
    body = client.get("/api/wallpaper/status", params={"layout": "Does Not Exist"}).json()
    assert body["imageUrl"] is None
    assert body["path"] is None


def test_wallpaper_image_served(client):
    response = client.get("/api/wallpaper/image/Netflix Hero/northlight.jpg")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")


def test_generate_demo_skip_and_replace(client):
    first = client.post(
        "/api/generate",
        json={"layout": "Google TV Clean", "source": "demo", "limit": 2, "skip_existing": False},
    ).json()
    assert first["count"] == 2
    skipped = client.post(
        "/api/generate",
        json={"layout": "Google TV Clean", "source": "demo", "limit": 2, "skip_existing": True},
    ).json()
    assert skipped["count"] == 0
    assert len(skipped["skipped"]) == 2
    replaced = client.post(
        "/api/generate",
        json={
            "layout": "Google TV Clean",
            "source": "demo",
            "limit": 2,
            "skip_existing": False,
            "replace_existing": True,
        },
    ).json()
    assert replaced["count"] == 2


def test_gallery_and_settings_roundtrip(client):
    gallery = client.get("/api/gallery", params={"layout": "Netflix Hero"}).json()
    assert len(gallery) == 3
    settings = client.get("/api/settings").json()
    settings["public_base_url"] = "http://tv.local:8787"
    saved = client.post("/api/settings", json=settings)
    assert saved.status_code == 200
    assert client.get("/api/settings").json()["public_base_url"] == "http://tv.local:8787"


def test_wallpaper_status_watched_pool(client):
    body = client.get(
        "/api/wallpaper/status",
        params={"layout": "Netflix Hero", "pool": "watched", "sort": "rating"},
    ).json()
    assert body["title"] == "Glass Orchard"


def test_generate_ids_and_skip_ids(client):
    only = client.post(
        "/api/generate",
        json={
            "layout": "Status Focus",
            "source": "demo",
            "limit": 20,
            "skip_existing": False,
            "ids": ["demo-jf-1"],
        },
    ).json()
    assert only["count"] == 1
    assert only["created"] == ["Northlight"]
    skipped = client.post(
        "/api/generate",
        json={
            "layout": "Status Focus",
            "source": "demo",
            "limit": 20,
            "skip_existing": False,
            "skip_ids": ["demo-jf-1", "90001", "tt9000001"],
            "ids": ["demo-jf-1"],
        },
    ).json()
    assert skipped["count"] == 0


def test_health_includes_version(client):
    body = client.get("/api/health").json()
    assert body["version"]


def test_settings_roundtrip_motion_options(client):
    settings = client.get("/api/settings").json()
    settings["motion_style"] = "parallax"
    settings["motion_intensity"] = 0.8
    settings["motion_duration"] = 7
    settings["editor_theme"] = "high-contrast"
    assert client.post("/api/settings", json=settings).status_code == 200
    saved = client.get("/api/settings").json()
    assert saved["motion_style"] == "parallax"
    assert saved["motion_intensity"] == 0.8
    assert saved["editor_theme"] == "high-contrast"
