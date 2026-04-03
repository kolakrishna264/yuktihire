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
    try:
        from app.core.database import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[Startup] Tables created/verified")
        # Add new columns to existing tables (create_all won't do this)
        from sqlalchemy import text
        async with engine.begin() as conn:
            for col_sql in [
                "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country VARCHAR(20)",
                "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS extra_data JSON",
                "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(20)",
                "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS job_id VARCHAR",
                "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0",
                "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
                "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS next_action_date TIMESTAMPTZ",
                "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_version_id VARCHAR",
                "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS reminder_type VARCHAR(50)",
                "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ",
                "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE",
            ]:
                try:
                    await conn.execute(text(col_sql))
                except Exception:
                    pass  # Column already exists or table doesn't exist
        print("[Startup] Column migrations applied")
    except Exception as e:
        print(f"[Startup] Table creation warning: {e}")
    # Start background job ingestion scheduler (non-fatal if it fails)
    try:
        from app.services.sources.scheduler import start_scheduler
        asyncio.create_task(start_scheduler())
        print("[Startup] Scheduler started")
    except Exception as e:
        print(f"[Startup] Scheduler failed to start: {e}")

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
    allow_origins=["*"],
    allow_credentials=False,
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
from app.routers.extension import router as extension_router

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
app.include_router(extension_router, prefix=API_PREFIX)


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
