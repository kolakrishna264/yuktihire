"""
YuktiHire API — Main Entry Point
FastAPI application with all routers mounted.
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, BackgroundTasks
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
    """Startup — must complete within 30s for Railway healthcheck."""
    print(f"YuktiHire API starting in {settings.app_env} mode")

    # DB setup in background — don't block startup
    async def _db_setup():
        try:
            from app.core.database import Base
            from sqlalchemy import text as sql_text
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("[DB] Tables created")
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
                        await conn.execute(sql_text(col_sql))
                    except Exception:
                        pass
            print("[DB] Columns migrated")
        except Exception as e:
            print(f"[DB] Setup error: {e}")

        # Start scheduler after DB is ready
        try:
            from app.services.sources.scheduler import start_scheduler
            await start_scheduler()
        except Exception as e:
            print(f"[Scheduler] Error: {e}")

    # Launch DB setup + scheduler as a background task — don't block lifespan
    asyncio.create_task(_db_setup())
    print("[Startup] Background tasks launched — app ready")

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

# CORS — allow all origins (auth via Bearer tokens, not cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — ensures CORS headers on 500 errors
from fastapi.responses import JSONResponse
from starlette.requests import Request as StarletteRequest

@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    print(f"[ERROR] {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
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


@app.post("/sync-now")
async def sync_now(background_tasks: BackgroundTasks):
    """Public sync trigger — forces immediate job ingestion from all sources."""
    from fastapi import BackgroundTasks as BT
    async def _run():
        try:
            from app.services.sources.scheduler import run_sync_cycle
            await run_sync_cycle()
        except Exception as e:
            print(f"[sync-now] Error: {e}")
            import traceback
            traceback.print_exc()
    background_tasks.add_task(_run)
    return {"status": "sync_started", "message": "Check /api/v1/discover/debug in 60 seconds"}


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
