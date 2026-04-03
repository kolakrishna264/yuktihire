"""
YuktiHire API — Main Entry Point
FastAPI application with all routers mounted.
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import engine, get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.billing import UsageLimit
from app.models import user, profile, resume, tailoring, billing, jobs, discover, tracker, v2  # register models

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print(f"YuktiHire API starting in {settings.app_env} mode")
    # Auto-create tables (safe — uses IF NOT EXISTS)
    from app.core.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Schedule initial job sync (non-blocking)
    async def _initial_sync():
        try:
            await asyncio.sleep(2)  # Let app fully start
            from app.core.database import SessionLocal
            from app.services.sources.remotive import RemotiveAdapter
            from app.services.sources.arbeitnow import ArbeitnowAdapter
            from app.services.sources.ingestor import JobIngestor
            async with SessionLocal() as session:
                ingestor = JobIngestor(session)
                for adapter in [RemotiveAdapter(), ArbeitnowAdapter()]:
                    try:
                        jobs = await adapter.fetch_jobs()
                        new, updated = await ingestor.ingest_batch(jobs, adapter.slug)
                        print(f"[Startup] {adapter.name}: {new} new, {updated} updated")
                    except Exception as e:
                        print(f"[Startup] {adapter.name} sync failed: {e}")
        except Exception as e:
            print(f"[Startup] Initial sync failed: {e}")

    asyncio.create_task(_initial_sync())

    yield
    await engine.dispose()


app = FastAPI(
    title="YuktiHire API",
    description="AI-powered resume tailoring and ATS optimization",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yuktihire.com",
        "https://www.yuktihire.com",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers
from app.routers.profiles import router as profiles_router
from app.routers.resumes import router as resumes_router
from app.routers.jobs import router as applications_router, saved_router
from app.routers.tailor import router as tailor_router
from app.routers.exports import router as exports_router
from app.routers.billing import router as billing_router
from app.routers.job_board import router as job_board_router
from app.routers.discover import router as discover_router
from app.routers.tracker import router as tracker_router
from app.routers.contacts import router as contacts_router
from app.routers.reminders import router as reminders_router
from app.routers.preferences import router as preferences_router
from app.routers.insights import router as insights_router

API_PREFIX = "/api/v1"

app.include_router(profiles_router, prefix=API_PREFIX)
app.include_router(resumes_router, prefix=API_PREFIX)
app.include_router(applications_router, prefix=API_PREFIX)
app.include_router(saved_router, prefix=API_PREFIX)
app.include_router(tailor_router, prefix=API_PREFIX)
app.include_router(exports_router, prefix=API_PREFIX)
app.include_router(billing_router, prefix=API_PREFIX)
app.include_router(job_board_router, prefix=API_PREFIX)
app.include_router(discover_router, prefix=API_PREFIX)
app.include_router(tracker_router, prefix=API_PREFIX)
app.include_router(contacts_router, prefix=API_PREFIX)
app.include_router(reminders_router, prefix=API_PREFIX)
app.include_router(preferences_router, prefix=API_PREFIX)
app.include_router(insights_router, prefix=API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "env": settings.app_env}


@app.get(API_PREFIX + "/usage")
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UsageLimit).where(UsageLimit.user_id == current_user.id))
    usage = result.scalar_one_or_none()
    return {
        "plan": current_user.plan,
        "tailoring": {"used": usage.tailoring_used if usage else 0, "max": usage.tailoring_max if usage else 3},
        "atsScans": {"used": usage.ats_scans_used if usage else 0, "max": usage.ats_scans_max if usage else 5},
        "exports": {"used": usage.exports_used if usage else 0, "max": usage.exports_max if usage else 2},
        "resumesMax": usage.resumes_max if usage else 1,
        "periodEnd": usage.period_end if usage else None,
    }
