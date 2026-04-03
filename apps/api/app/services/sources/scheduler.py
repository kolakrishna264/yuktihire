"""Background job ingestion scheduler — runs adapters every 15 minutes."""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.discover import JobSource
from .remotive import RemotiveAdapter
from .arbeitnow import ArbeitnowAdapter
from .remoteok import RemoteOKAdapter
from .ingestor import JobIngestor

ADAPTERS = [
    RemotiveAdapter(),
    ArbeitnowAdapter(),
    RemoteOKAdapter(),
]

SYNC_INTERVAL_SECONDS = 900  # 15 minutes


async def _ensure_sources():
    """Ensure all adapter sources exist in the DB."""
    async with SessionLocal() as session:
        for adapter in ADAPTERS:
            result = await session.execute(
                select(JobSource).where(JobSource.slug == adapter.slug)
            )
            if not result.scalar_one_or_none():
                source = JobSource(slug=adapter.slug, name=adapter.name, is_active=True)
                session.add(source)
        await session.commit()


async def run_sync_cycle():
    """Run one sync cycle across all adapters."""
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
                print(f"[Scheduler] {adapter.name}: {new} new, {updated} updated ({len(jobs)} fetched)")
            except Exception as e:
                print(f"[Scheduler] {adapter.name} failed: {e}")

        print(f"[Scheduler] Cycle complete: {total_new} new, {total_updated} updated")
        return total_new, total_updated


async def start_scheduler():
    """Start the background sync loop."""
    # Ensure sources are seeded
    try:
        await _ensure_sources()
    except Exception as e:
        print(f"[Scheduler] Failed to seed sources: {e}")

    # Initial sync after 3 seconds
    await asyncio.sleep(3)
    print("[Scheduler] Starting initial sync...")
    try:
        await run_sync_cycle()
    except Exception as e:
        print(f"[Scheduler] Initial sync failed: {e}")

    # Then every 15 minutes
    while True:
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)
        try:
            await run_sync_cycle()
        except Exception as e:
            print(f"[Scheduler] Cycle error: {e}")
