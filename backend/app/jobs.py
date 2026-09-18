"""In-process cron scheduler for wallpaper generation."""

from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import load_settings
from app.generate import run_generate
from app.models import GenerateRequest

_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler and _scheduler.running:
        reload_jobs()
        return _scheduler
    _scheduler = BackgroundScheduler()
    _scheduler.start()
    reload_jobs()
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def reload_jobs() -> None:
    if _scheduler is None:
        return
    _scheduler.remove_all_jobs()
    settings = load_settings()
    for index, job in enumerate(settings.cron_jobs or []):
        if not job.get("enabled", True):
            continue
        expr = job.get("cron") or job.get("schedule") or "0 4 * * *"
        layout = job.get("layout") or "Netflix Hero"
        source = job.get("source") or "demo"
        try:
            trigger = CronTrigger.from_crontab(expr)
        except Exception:
            continue
        ids = job.get("ids") or []
        skip_ids = job.get("skip_ids") or []
        if isinstance(ids, str):
            ids = [part.strip() for part in ids.split(",") if part.strip()]
        if isinstance(skip_ids, str):
            skip_ids = [part.strip() for part in skip_ids.split(",") if part.strip()]
        _scheduler.add_job(
            _run_job,
            trigger=trigger,
            id=f"cron-{index}",
            replace_existing=True,
            kwargs={
                "layout": layout,
                "source": source,
                "skip_existing": bool(job.get("skip_existing", True)),
                "replace_existing": bool(job.get("replace_existing", False)),
                "cleanup": bool(job.get("cleanup", False)),
                "motion": bool(job.get("motion", False)),
                "limit": int(job.get("limit") or 20),
                "ids": list(ids),
                "skip_ids": list(skip_ids),
            },
        )


def _run_job(**kwargs) -> None:
    request = GenerateRequest(**kwargs)
    run_generate(request)
