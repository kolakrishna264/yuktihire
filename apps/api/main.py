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
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(150)",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS description TEXT",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS work_type VARCHAR(50)",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS experience_level VARCHAR(50)",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS industry VARCHAR(100)",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS skills_json TEXT",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS external_job_id VARCHAR",
                    "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS posted_at VARCHAR",
                    "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS reminder_type VARCHAR(50)",
                    "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ",
                    "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE",
                    # SaaS: User roles and admin
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
                    # SaaS: AI answer usage tracking
                    "ALTER TABLE usage_limits ADD COLUMN IF NOT EXISTS ai_answers_used INTEGER DEFAULT 0",
                    "ALTER TABLE usage_limits ADD COLUMN IF NOT EXISTS ai_answers_max INTEGER DEFAULT 10",
                    # Answer memory extra columns
                    "ALTER TABLE answer_memory ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'ai'",
                    "ALTER TABLE answer_memory ADD COLUMN IF NOT EXISTS category VARCHAR(50)",
                    "ALTER TABLE answer_memory ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1",
                ]:
                    try:
                        await conn.execute(sql_text(col_sql))
                    except Exception:
                        pass

                # SaaS tables
                saas_tables = [
                    """CREATE TABLE IF NOT EXISTS promo_codes (
                        id VARCHAR PRIMARY KEY,
                        code VARCHAR(50) UNIQUE NOT NULL,
                        unlocks_plan VARCHAR(20) DEFAULT 'PROMO',
                        max_uses INTEGER DEFAULT 100,
                        uses_consumed INTEGER DEFAULT 0,
                        is_active BOOLEAN DEFAULT TRUE,
                        expires_at TIMESTAMPTZ,
                        features_json TEXT,
                        note TEXT,
                        created_by VARCHAR REFERENCES users(id),
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )""",
                    """CREATE TABLE IF NOT EXISTS promo_redemptions (
                        id VARCHAR PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(id),
                        code_id VARCHAR NOT NULL REFERENCES promo_codes(id),
                        redeemed_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(user_id, code_id)
                    )""",
                    """CREATE TABLE IF NOT EXISTS audit_log (
                        id VARCHAR PRIMARY KEY,
                        admin_id VARCHAR NOT NULL REFERENCES users(id),
                        action VARCHAR(100) NOT NULL,
                        target_id VARCHAR,
                        details TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )""",
                    """CREATE TABLE IF NOT EXISTS feature_flags (
                        name VARCHAR(100) PRIMARY KEY,
                        enabled BOOLEAN DEFAULT TRUE,
                        description TEXT,
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )""",
                    """CREATE TABLE IF NOT EXISTS curated_jobs (
                        id VARCHAR PRIMARY KEY,
                        title VARCHAR(500) NOT NULL,
                        company VARCHAR(255) NOT NULL,
                        location VARCHAR(255),
                        url VARCHAR(1000),
                        description TEXT,
                        work_type VARCHAR(50),
                        employment_type VARCHAR(50),
                        experience_level VARCHAR(50),
                        salary_range VARCHAR(200),
                        skills TEXT,
                        tags TEXT,
                        job_family VARCHAR(100),
                        seniority VARCHAR(50),
                        is_active BOOLEAN DEFAULT TRUE,
                        source_type VARCHAR(50) DEFAULT 'manual',
                        created_by VARCHAR REFERENCES users(id),
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )""",
                    """CREATE TABLE IF NOT EXISTS answer_memory (
                        id VARCHAR PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(id),
                        question_hash VARCHAR(100) NOT NULL,
                        question_text TEXT,
                        answer TEXT NOT NULL,
                        source VARCHAR(20) DEFAULT 'ai',
                        category VARCHAR(50),
                        use_count INTEGER DEFAULT 1,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(user_id, question_hash)
                    )""",
                    """CREATE TABLE IF NOT EXISTS autofill_sessions (
                        id VARCHAR PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(id),
                        portal_domain VARCHAR(255),
                        job_title VARCHAR(500),
                        company VARCHAR(255),
                        fields_total INTEGER DEFAULT 0,
                        fields_filled INTEGER DEFAULT 0,
                        fields_review INTEGER DEFAULT 0,
                        fields_failed INTEGER DEFAULT 0,
                        fields_ai INTEGER DEFAULT 0,
                        fields_memory INTEGER DEFAULT 0,
                        readiness_score INTEGER DEFAULT 0,
                        duration_ms INTEGER DEFAULT 0,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )""",
                ]
                for table_sql in saas_tables:
                    try:
                        await conn.execute(sql_text(table_sql))
                    except Exception:
                        pass

                # Insert default feature flags
                default_flags = [
                    ("job_discovery", True, "Show Discover tab with job listings"),
                    ("ai_answers", True, "Enable AI answer generation"),
                    ("cover_letter", True, "Enable cover letter generation"),
                    ("interview_prep", True, "Enable interview prep feature"),
                    ("company_intel", True, "Enable company research feature"),
                    ("autofill", True, "Enable extension autofill"),
                    ("promo_codes", True, "Enable promo code redemption"),
                ]
                for name, enabled, desc in default_flags:
                    try:
                        await conn.execute(sql_text(
                            "INSERT INTO feature_flags (name, enabled, description) VALUES (:n, :e, :d) ON CONFLICT (name) DO NOTHING"
                        ), {"n": name, "e": enabled, "d": desc})
                    except Exception:
                        pass

            print("[DB] Columns + SaaS tables migrated")

            # Auto-set admin role for platform owner
            try:
                from app.core.permissions import ensure_admin_role, ADMIN_EMAIL
                from app.core.database import AsyncSessionLocal
                async with AsyncSessionLocal() as session:
                    await ensure_admin_role(session)
                    print(f"[Admin] {ADMIN_EMAIL} → admin role ensured")
            except Exception as e:
                print(f"[Admin] Role setup skipped: {e}")

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
from app.routers.answers import router as answers_router
from app.routers.intelligence import router as intelligence_router
from app.routers.admin import router as admin_router
from app.routers.promo import router as promo_router

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
app.include_router(answers_router, prefix=API_PREFIX)
app.include_router(intelligence_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(promo_router, prefix=API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "env": settings.app_env}


@app.get("/debug-jobs")
async def debug_jobs(db: AsyncSession = Depends(get_db)):
    """Debug: show all jobs with user_ids to diagnose ownership."""
    from sqlalchemy import text
    try:
        result = await db.execute(text("SELECT COUNT(*) FROM job_applications"))
        total = result.scalar() or 0
        result2 = await db.execute(text("SELECT id, user_id, role, company, status, source, created_at, LENGTH(notes) as notes_len FROM job_applications ORDER BY created_at DESC LIMIT 10"))
        rows = [dict(r) for r in result2.mappings().all()]
        # Also get distinct user_ids
        result3 = await db.execute(text("SELECT DISTINCT user_id FROM job_applications"))
        user_ids = [r[0] for r in result3.all()]
        # Get all users
        result4 = await db.execute(text("SELECT id, email FROM users LIMIT 10"))
        users = [dict(r) for r in result4.mappings().all()]
        return {"totalApplications": total, "recent": rows, "distinctUserIds": user_ids, "users": users}
    except Exception as e:
        return {"error": str(e)}


@app.post("/sync-now")
async def sync_now(background_tasks: BackgroundTasks):
    """Public sync trigger — forces immediate job ingestion."""
    async def _run():
        try:
            from app.services.sources.scheduler import run_sync_cycle
            await run_sync_cycle()
        except Exception as e:
            print(f"[sync-now] Error: {e}")
            import traceback
            traceback.print_exc()
    background_tasks.add_task(_run)
    return {"status": "sync_started"}


@app.get("/test-greenhouse")
async def test_greenhouse():
    """Test Greenhouse adapter directly and return result or error."""
    try:
        from app.services.sources.greenhouse import GreenhouseAdapter
        adapter = GreenhouseAdapter()
        jobs = await adapter.fetch_jobs()
        us_jobs = [j for j in jobs if "remote" in (j.location or "").lower() or "us" in (j.location or "").lower()]
        return {
            "status": "ok",
            "totalFetched": len(jobs),
            "usJobs": len(us_jobs),
            "sample": [{"title": j.title, "company": j.company, "location": j.location} for j in jobs[:5]],
        }
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}


@app.get("/test-lever")
async def test_lever():
    """Test Lever adapter directly."""
    try:
        from app.services.sources.lever import LeverAdapter
        adapter = LeverAdapter()
        jobs = await adapter.fetch_jobs()
        return {
            "status": "ok",
            "totalFetched": len(jobs),
            "sample": [{"title": j.title, "company": j.company, "location": j.location} for j in jobs[:5]],
        }
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}


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


@app.get(API_PREFIX + "/permissions")
async def get_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all feature permissions for the current user — used by frontend to show/hide features."""
    from app.core.permissions import get_user_permissions
    return await get_user_permissions(current_user, db)
