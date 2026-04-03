"""Background job ingestion scheduler — bulk every 15 min, targeted every hour."""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal as SessionLocal
from app.models.discover import JobSource
from .remotive import RemotiveAdapter
from .arbeitnow import ArbeitnowAdapter
from .remoteok import RemoteOKAdapter
from .jobicy import JobicyAdapter
from .greenhouse import GreenhouseAdapter
from .lever import LeverAdapter
from .themuse import TheMuseAdapter
from .ingestor import JobIngestor
from .title_strategy import run_targeted_ingestion

# All source adapters — ordered by US job volume
ADAPTERS = [
    GreenhouseAdapter(),   # 50 top tech company boards — 2000+ US jobs
    LeverAdapter(),        # 30 tech companies — 500+ US jobs
    TheMuseAdapter(),      # US-focused with category filter
    RemotiveAdapter(),     # Remote-first, many US-eligible
    RemoteOKAdapter(),     # Remote tech jobs
    JobicyAdapter(),       # Remote jobs with salary data
]

BULK_INTERVAL = 900  # 15 minutes
TARGETED_INTERVAL = 3600  # 1 hour

_last_targeted_at: datetime | None = None


async def _ensure_sources():
    """Ensure all adapter sources exist in the DB."""
    all_adapters = ADAPTERS + [ArbeitnowAdapter()]  # Include for DB seeding
    async with SessionLocal() as session:
        for adapter in all_adapters:
            result = await session.execute(
                select(JobSource).where(JobSource.slug == adapter.slug)
            )
            if not result.scalar_one_or_none():
                source = JobSource(slug=adapter.slug, name=adapter.name, is_active=True)
                session.add(source)
        await session.commit()


async def run_bulk_sync():
    """Run bulk fetch from all adapters."""
    async with SessionLocal() as session:
        ingestor = JobIngestor(session)
        total_new = 0
        total_updated = 0
        for adapter in ADAPTERS:
            try:
                jobs = await adapter.fetch_jobs()
                new, updated = await ingestor.ingest_batch(jobs, adapter.slug)
                total_new += new
                total_updated += updated
                print(f"[Bulk] {adapter.name}: {new} new, {updated} updated ({len(jobs)} fetched)")
            except Exception as e:
                print(f"[Bulk] {adapter.name} failed: {e}")
        print(f"[Bulk] Complete: {total_new} new, {total_updated} updated")
        return total_new, total_updated


async def run_targeted_sync():
    """Run targeted keyword-based fetch."""
    global _last_targeted_at
    async with SessionLocal() as session:
        ingestor = JobIngestor(session)
        stats = await run_targeted_ingestion(ingestor)
        _last_targeted_at = datetime.now(timezone.utc)
        return stats


async def run_sync_cycle():
    """Run one sync cycle — bulk always, targeted if due."""
    global _last_targeted_at
    await run_bulk_sync()

    now = datetime.now(timezone.utc)
    if _last_targeted_at is None or (now - _last_targeted_at).total_seconds() >= TARGETED_INTERVAL:
        print("[Scheduler] Running targeted ingestion...")
        await run_targeted_sync()


async def start_scheduler():
    """Start the background sync loop."""
    try:
        await _ensure_sources()
    except Exception as e:
        print(f"[Scheduler] Failed to seed sources: {e}")

    await asyncio.sleep(3)
    print("[Scheduler] Starting initial sync...")
    try:
        await run_sync_cycle()
    except Exception as e:
        print(f"[Scheduler] Initial sync failed: {e}")

    while True:
        await asyncio.sleep(BULK_INTERVAL)
        try:
            await run_sync_cycle()
        except Exception as e:
            print(f"[Scheduler] Cycle error: {e}")
