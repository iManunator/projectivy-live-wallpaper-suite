from __future__ import annotations

import time

from app.models import Layout, LayoutBackground, MediaItem
from app.progress import reset_for_tests
from app.render import render_chrome


def test_gallery_delete_removes_still_video_and_catalog(client, suite_dirs):
    catalog_mod = suite_dirs["catalog_mod"]
    gallery = suite_dirs["gallery"]
    rec = next(r for r in catalog_mod.load_catalog() if r.has_video)
    jpg = gallery / rec.layout / rec.filename
    mp4 = jpg.with_suffix(".mp4")
    plate = jpg.with_name(jpg.stem + "_plate.jpg")
    chrome = jpg.with_name(jpg.stem + "_chrome.png")
    plate.write_bytes(b"plate")
    chrome.write_bytes(b"chrome")
    assert jpg.is_file() and mp4.is_file()

    out = client.delete(f"/api/gallery/{rec.id}").json()
    assert rec.id in out["deleted"]
    assert rec.title in out["titles"]
    assert out["count"] == 1
    assert not jpg.exists()
    assert not mp4.exists()
    assert not plate.exists()
    assert not chrome.exists()
    leftover = client.get("/api/gallery").json()
    assert all(item["id"] != rec.id for item in leftover)


def test_gallery_delete_post_and_bulk(client, suite_dirs):
    catalog_mod = suite_dirs["catalog_mod"]
    records = catalog_mod.load_catalog()
    first, second = records[0], records[1]
    one = client.post(f"/api/gallery/delete/{first.id}").json()
    assert first.id in one["deleted"]
    bulk = client.post("/api/gallery/delete", json={"ids": [second.id, "missing-id"]}).json()
    assert second.id in bulk["deleted"]
    assert "missing-id" in bulk["missing"]
    assert client.delete("/api/gallery/missing-id").status_code == 404
    assert client.post("/api/gallery/delete", json={"ids": []}).status_code == 400


def test_jobs_generate_reports_progress(client):
    reset_for_tests()
    start = client.post(
        "/api/jobs",
        json={
            "kind": "generate",
            "layout": "Netflix Hero",
            "source": "demo",
            "limit": 1,
            "skip_existing": False,
            "replace_existing": True,
            "ids": ["demo-jf-1"],
        },
    )
    assert start.status_code == 200
    job = start.json()
    assert job["id"]
    assert job["kind"] == "generate"
    assert job["status"] in {"queued", "running", "done"}
    body = job
    for _ in range(200):
        body = client.get(f"/api/jobs/{job['id']}").json()
        if body["status"] in {"done", "error"}:
            break
        time.sleep(0.05)
    assert body["status"] == "done", body
    assert body["percent"] == 100
    assert body["total"] >= 1
    assert body["result"]["count"] == 1
    latest = client.get("/api/jobs/latest").json()
    assert latest["id"] == job["id"]


def test_jobs_latest_idle_and_unknown_kind(client):
    reset_for_tests()
    idle = client.get("/api/jobs/latest").json()
    assert idle["status"] == "idle"
    assert client.get("/api/jobs/nope").status_code == 404
    assert client.post("/api/jobs", json={"kind": "explode"}).status_code == 400


def test_jobs_conflict_when_running(client, monkeypatch):
    from app import progress

    fake = progress.JobState(id="busy", kind="generate", status="running")
    monkeypatch.setattr(progress, "running_job", lambda: fake)
    res = client.post("/api/jobs", json={"kind": "cron", "layout": "Netflix Hero", "source": "demo", "limit": 1})
    assert res.status_code == 409


def test_jobs_motion_kind(client):
    reset_for_tests()
    start = client.post(
        "/api/jobs",
        json={"kind": "motion", "layout": "Prime Cinematic", "path": "relay.jpg"},
    )
    assert start.status_code == 200
    job = start.json()
    body = job
    for _ in range(200):
        body = client.get(f"/api/jobs/{job['id']}").json()
        if body["status"] in {"done", "error"}:
            break
        time.sleep(0.05)
    assert body["status"] == "done", body
    assert body["result"]["layered"] is True
    assert body["result"]["chrome_locked"] is True


def test_watch_badge_injected_and_hideable():
    layout = Layout(
        name="Bare",
        canvas_width=1920,
        canvas_height=1080,
        background=LayoutBackground(
            fade_left=0,
            fade_right=0,
            fade_top=0,
            fade_bottom=0,
            vignette=0,
            overlay_opacity=0,
            gradient_opacity=0,
        ),
        layers=[],
        show_watch_badge=True,
    )
    watched = MediaItem(title="Probe", year=2024, watch_state="unwatched")
    blank = MediaItem(title="Probe", year=2024, watch_state="")
    with_badge = render_chrome(watched, layout)
    without = render_chrome(blank, layout)
    assert with_badge.tobytes() != without.tobytes()
    hidden = layout.model_copy(update={"show_watch_badge": False})
    assert render_chrome(watched, hidden).tobytes() == without.tobytes()
