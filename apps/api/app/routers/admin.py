"""Admin Panel API — User management, platform monitoring, feature flags."""
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.core.permissions import is_admin

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(func):
    """Decorator — all admin endpoints check admin status."""
    async def wrapper(*args, **kwargs):
        current_user = kwargs.get("current_user")
        db = kwargs.get("db")
        if not current_user or not db:
            raise HTTPException(403, "Admin only")
        if not await is_admin(current_user.id, db):
            raise HTTPException(403, "Admin only")
        return await func(*args, **kwargs)
    return wrapper


# ── Dashboard Stats ──────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    stats = {}
    queries = {
        "totalUsers": "SELECT COUNT(*) FROM users",
        "activeToday": "SELECT COUNT(*) FROM users WHERE updated_at > NOW() - INTERVAL '1 day'",
        "activeWeek": "SELECT COUNT(*) FROM users WHERE updated_at > NOW() - INTERVAL '7 days'",
        "totalResumes": "SELECT COUNT(*) FROM resumes",
        "totalApplications": "SELECT COUNT(*) FROM job_applications",
        "totalTailoringSessions": "SELECT COUNT(*) FROM tailoring_sessions",
        "totalJobs": "SELECT COUNT(*) FROM jobs WHERE is_active = true",
        "proUsers": "SELECT COUNT(*) FROM users WHERE plan IN ('PRO', 'PRO_ANNUAL')",
        "freeUsers": "SELECT COUNT(*) FROM users WHERE plan = 'FREE'",
        "promoRedemptions": "SELECT COUNT(*) FROM promo_redemptions",
    }
    for key, sql in queries.items():
        try:
            result = await db.execute(text(sql))
            stats[key] = result.scalar() or 0
        except Exception:
            stats[key] = 0

    # Autofill metrics
    af_queries = {
        "autofillSessions": "SELECT COUNT(*) FROM autofill_sessions",
        "autofillFieldsFilled": "SELECT COALESCE(SUM(fields_filled), 0) FROM autofill_sessions",
        "autofillFieldsFailed": "SELECT COALESCE(SUM(fields_failed), 0) FROM autofill_sessions",
        "autofillAIAnswers": "SELECT COALESCE(SUM(fields_ai), 0) FROM autofill_sessions",
        "autofillMemoryReused": "SELECT COALESCE(SUM(fields_memory), 0) FROM autofill_sessions",
        "savedAnswers": "SELECT COUNT(*) FROM answer_memory",
    }
    for key, sql in af_queries.items():
        try:
            result = await db.execute(text(sql))
            stats[key] = result.scalar() or 0
        except Exception:
            stats[key] = 0

    return stats


@router.get("/autofill-quality")
async def admin_autofill_quality(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin dashboard: autofill quality metrics."""
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    quality = {}

    # Top portals by failure rate
    try:
        result = await db.execute(text("""
            SELECT portal_domain,
                   COUNT(*) as sessions,
                   COALESCE(AVG(fields_failed), 0) as avg_failed,
                   COALESCE(AVG(fields_filled), 0) as avg_filled
            FROM autofill_sessions
            WHERE portal_domain IS NOT NULL
            GROUP BY portal_domain
            ORDER BY avg_failed DESC LIMIT 10
        """))
        quality["portalStats"] = [
            {"domain": r["portal_domain"], "sessions": r["sessions"],
             "avgFailed": round(float(r["avg_failed"]), 1), "avgFilled": round(float(r["avg_filled"]), 1)}
            for r in result.mappings().all()
        ]
    except Exception:
        quality["portalStats"] = []

    # Most common repeated questions (answer memory)
    try:
        result = await db.execute(text("""
            SELECT question_text, SUM(use_count) as total_uses, COUNT(DISTINCT user_id) as unique_users
            FROM answer_memory
            WHERE question_text IS NOT NULL
            GROUP BY question_text
            ORDER BY total_uses DESC LIMIT 15
        """))
        quality["topQuestions"] = [
            {"question": r["question_text"][:80], "uses": r["total_uses"], "users": r["unique_users"]}
            for r in result.mappings().all()
        ]
    except Exception:
        quality["topQuestions"] = []

    # Average readiness score
    try:
        result = await db.execute(text("SELECT AVG(readiness_score) FROM autofill_sessions"))
        quality["avgReadiness"] = round(float(result.scalar() or 0))
    except Exception:
        quality["avgReadiness"] = 0

    # Memory reuse rate
    try:
        result = await db.execute(text("""
            SELECT COALESCE(SUM(fields_memory), 0) as memory_total,
                   COALESCE(SUM(fields_ai), 0) as ai_total
            FROM autofill_sessions
        """))
        row = result.mappings().first()
        memory = row.get("memory_total", 0) if row else 0
        ai = row.get("ai_total", 0) if row else 0
        quality["memoryReuseRate"] = round(memory / max(memory + ai, 1) * 100)
    except Exception:
        quality["memoryReuseRate"] = 0

    return quality


# ── User Management ──────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    offset = (page - 1) * limit
    conditions = []
    params = {"lim": limit, "off": offset}

    if search:
        conditions.append("(email ILIKE :search OR full_name ILIKE :search)")
        params["search"] = f"%{search}%"
    if plan:
        conditions.append("plan = :plan")
        params["plan"] = plan

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    # Count
    count_result = await db.execute(text(f"SELECT COUNT(*) FROM users {where}"), params)
    total = count_result.scalar() or 0

    # Fetch
    result = await db.execute(
        text(f"SELECT * FROM users {where} ORDER BY created_at DESC LIMIT :lim OFFSET :off"),
        params,
    )
    rows = result.mappings().all()

    users = []
    for r in rows:
        # Get usage stats
        usage = {}
        try:
            u_result = await db.execute(
                text("SELECT * FROM usage_limits WHERE user_id = :uid"),
                {"uid": r["id"]},
            )
            u = u_result.mappings().first()
            if u:
                usage = {
                    "tailoringUsed": u.get("tailoring_used", 0),
                    "tailoringMax": u.get("tailoring_max", 3),
                    "exportsUsed": u.get("exports_used", 0),
                    "resumeCount": 0,
                }
        except Exception:
            pass

        try:
            r_count = await db.execute(
                text("SELECT COUNT(*) FROM resumes WHERE user_id = :uid"),
                {"uid": r["id"]},
            )
            usage["resumeCount"] = r_count.scalar() or 0
        except Exception:
            pass

        users.append({
            "id": r.get("id"),
            "email": r.get("email"),
            "fullName": r.get("full_name"),
            "plan": r.get("plan", "FREE"),
            "role": r.get("role", "user"),
            "onboardingDone": r.get("onboarding_done", False),
            "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
            "updatedAt": r["updated_at"].isoformat() if r.get("updated_at") else None,
            "usage": usage,
        })

    return {"users": users, "total": total, "page": page, "limit": limit}


# ── User Actions ─────────────────────────────────────────────────────────

class UserAction(BaseModel):
    plan: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    data: UserAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    updates = []
    params = {"uid": user_id}

    if data.plan:
        updates.append("plan = :plan")
        params["plan"] = data.plan
    if data.role:
        updates.append("role = :role")
        params["role"] = data.role

    if updates:
        sql = f"UPDATE users SET {', '.join(updates)}, updated_at = NOW() WHERE id = :uid"
        await db.execute(text(sql), params)

        # If plan changed, update usage limits too
        if data.plan:
            from app.core.permissions import FEATURES
            plan = data.plan if data.plan != "PRO_ANNUAL" else "PRO"
            await db.execute(
                text("""
                    UPDATE usage_limits SET
                        tailoring_max = :t, ats_scans_max = :a, exports_max = :e, resumes_max = :r
                    WHERE user_id = :uid
                """),
                {
                    "uid": user_id,
                    "t": FEATURES["max_tailor_per_month"].get(plan, 3),
                    "a": FEATURES["max_ats_scans_per_month"].get(plan, 5),
                    "e": FEATURES["max_exports_per_month"].get(plan, 2),
                    "r": FEATURES["max_resumes"].get(plan, 1),
                },
            )

        # Log admin action
        await _log_admin_action(db, current_user.id, "update_user", user_id, json.dumps(data.model_dump(exclude_none=True)))

        await db.commit()

    return {"status": "updated"}


# ── Activity Feed ────────────────────────────────────────────────────────

@router.get("/activity")
async def admin_activity(
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    activities = []

    # Recent signups
    try:
        result = await db.execute(
            text(f"SELECT email, created_at FROM users WHERE created_at > NOW() - INTERVAL '{days} days' ORDER BY created_at DESC LIMIT 20")
        )
        for r in result.mappings().all():
            activities.append({
                "type": "signup", "email": r.get("email"),
                "timestamp": r["created_at"].isoformat() if r.get("created_at") else None,
            })
    except Exception:
        pass

    # Recent tailoring
    try:
        result = await db.execute(
            text(f"""
                SELECT ts.status, ts.created_at, u.email FROM tailoring_sessions ts
                JOIN users u ON ts.user_id = u.id
                WHERE ts.created_at > NOW() - INTERVAL '{days} days'
                ORDER BY ts.created_at DESC LIMIT 20
            """)
        )
        for r in result.mappings().all():
            activities.append({
                "type": "tailor", "email": r.get("email"), "status": r.get("status"),
                "timestamp": r["created_at"].isoformat() if r.get("created_at") else None,
            })
    except Exception:
        pass

    # Sort by timestamp
    activities.sort(key=lambda a: a.get("timestamp", ""), reverse=True)
    return {"activities": activities[:50]}


# ── Feature Flags ────────────────────────────────────────────────────────

@router.get("/features")
async def get_feature_flags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    try:
        result = await db.execute(text("SELECT * FROM feature_flags ORDER BY name"))
        rows = result.mappings().all()
        return [
            {"name": r.get("name"), "enabled": r.get("enabled", False), "description": r.get("description")}
            for r in rows
        ]
    except Exception:
        # Table may not exist yet
        return []


class FeatureFlagUpdate(BaseModel):
    name: str
    enabled: bool


@router.patch("/features")
async def update_feature_flag(
    data: FeatureFlagUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    try:
        await db.execute(
            text("UPDATE feature_flags SET enabled = :enabled WHERE name = :name"),
            {"name": data.name, "enabled": data.enabled},
        )
        await db.commit()
        await _log_admin_action(db, current_user.id, "toggle_feature", data.name, str(data.enabled))
        return {"status": "updated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Audit Log ────────────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    offset = (page - 1) * limit
    try:
        result = await db.execute(
            text("""
                SELECT al.*, u.email as admin_email FROM audit_log al
                JOIN users u ON al.admin_id = u.id
                ORDER BY al.created_at DESC LIMIT :lim OFFSET :off
            """),
            {"lim": limit, "off": offset},
        )
        rows = result.mappings().all()
        return [
            {
                "id": r.get("id"),
                "adminEmail": r.get("admin_email"),
                "action": r.get("action"),
                "targetId": r.get("target_id"),
                "details": r.get("details"),
                "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
    except Exception:
        return []


@router.get("/system-health")
async def system_health(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """System health metrics for admin dashboard."""
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    health = {}

    # Queue size
    try:
        result = await db.execute(text("SELECT status, COUNT(*) as cnt FROM processing_jobs GROUP BY status"))
        queue = {}
        for r in result.mappings().all():
            queue[r["status"]] = r["cnt"]
        health["queue"] = queue
    except Exception:
        health["queue"] = {}

    # AI latency (last 24h)
    try:
        result = await db.execute(text("""
            SELECT AVG(latency_ms) as avg_latency,
                   MAX(latency_ms) as max_latency,
                   COUNT(*) as total_calls,
                   SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failures
            FROM ai_usage_logs WHERE created_at > NOW() - INTERVAL '24 hours'
        """))
        row = result.mappings().first()
        if row:
            total = row.get("total_calls", 0) or 0
            failures = row.get("failures", 0) or 0
            health["ai"] = {
                "avgLatencyMs": round(float(row.get("avg_latency", 0) or 0)),
                "maxLatencyMs": round(float(row.get("max_latency", 0) or 0)),
                "totalCalls24h": total,
                "failures24h": failures,
                "failureRate": round(failures / max(total, 1) * 100, 1),
            }
        else:
            health["ai"] = {"totalCalls24h": 0}
    except Exception:
        health["ai"] = {"totalCalls24h": 0}

    # Redis status
    try:
        from app.core.queue import get_redis
        redis = await get_redis()
        health["redis"] = "connected" if redis else "unavailable"
        if redis:
            queue_len = await redis.llen("yukti:jobs")
            health["redisQueueSize"] = queue_len
    except Exception:
        health["redis"] = "unavailable"

    # DB connection pool
    try:
        from app.core.database import engine
        pool = engine.pool
        health["db"] = {
            "poolSize": pool.size(),
            "checkedOut": pool.checkedout(),
            "overflow": pool.overflow(),
        }
    except Exception:
        health["db"] = {}

    # Recent errors (last 10 failed jobs)
    try:
        result = await db.execute(text("""
            SELECT job_type, error_message, created_at FROM processing_jobs
            WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10
        """))
        health["recentErrors"] = [
            {"type": r.get("job_type"), "error": (r.get("error_message") or "")[:100],
             "at": r["created_at"].isoformat() if r.get("created_at") else None}
            for r in result.mappings().all()
        ]
    except Exception:
        health["recentErrors"] = []

    return health


async def _log_admin_action(db: AsyncSession, admin_id: str, action: str, target_id: str, details: str = ""):
    """Write an entry to the audit log."""
    import uuid
    try:
        await db.execute(
            text("""
                INSERT INTO audit_log (id, admin_id, action, target_id, details, created_at)
                VALUES (:id, :admin_id, :action, :target_id, :details, NOW())
            """),
            {"id": str(uuid.uuid4()), "admin_id": admin_id, "action": action,
             "target_id": target_id, "details": details},
        )
    except Exception:
        pass  # Don't fail the main operation if logging fails
