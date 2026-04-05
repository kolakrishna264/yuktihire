"""
Redis-backed job queue for async AI processing.

Usage:
    from app.core.queue import enqueue_job, get_job_status

    # Enqueue a job
    job_id = await enqueue_job(db, user_id, "tailor_resume", {
        "session_id": "xxx", "resume_content": {...}, "jd_text": "..."
    })

    # Check status
    status = await get_job_status(db, job_id)
    # → { "status": "processing", "attempts": 1 }

    # Get result
    result = await get_job_result(db, job_id)
    # → { "status": "completed", "result": {...} }
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Job types
JOB_TYPES = [
    "tailor_resume",
    "generate_cover_letter",
    "generate_interview_prep",
    "generate_company_intel",
    "generate_outreach",
    "generate_ai_answer",
    "parse_resume",
    "compute_ats_score",
]

# Status constants
STATUS_QUEUED = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"

MAX_RETRIES = 3


async def enqueue_job(
    db: AsyncSession,
    user_id: str,
    job_type: str,
    payload: dict,
    related_job_id: Optional[str] = None,
    related_resume_id: Optional[str] = None,
) -> str:
    """Create a job record and push to Redis queue. Returns job_id."""
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload_json = json.dumps(payload)

    await db.execute(
        text("""
            INSERT INTO processing_jobs (id, user_id, job_type, status, attempts, payload_json,
                related_job_id, related_resume_id, created_at, updated_at)
            VALUES (:id, :uid, :type, :status, 0, :payload, :job_id, :resume_id, :now, :now)
        """),
        {
            "id": job_id, "uid": user_id, "type": job_type,
            "status": STATUS_QUEUED, "payload": payload_json,
            "job_id": related_job_id, "resume_id": related_resume_id, "now": now,
        },
    )
    await db.commit()

    # Push to Redis queue
    try:
        redis = await get_redis()
        if redis:
            await redis.lpush("yukti:jobs", json.dumps({"job_id": job_id, "job_type": job_type}))
    except Exception as e:
        # If Redis is unavailable, the worker poll loop will pick it up from DB
        from app.core.logger import log
        log.warning("redis_push_failed", job_id=job_id, error=str(e))

    return job_id


async def get_job_status(db: AsyncSession, job_id: str) -> dict:
    """Get current status of a job."""
    result = await db.execute(
        text("SELECT status, attempts, error_message, created_at, updated_at, completed_at FROM processing_jobs WHERE id = :id"),
        {"id": job_id},
    )
    row = result.mappings().first()
    if not row:
        return {"status": "not_found"}
    return {
        "status": row["status"],
        "attempts": row.get("attempts", 0),
        "error": row.get("error_message"),
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "completedAt": row["completed_at"].isoformat() if row.get("completed_at") else None,
    }


async def get_job_result(db: AsyncSession, job_id: str) -> dict:
    """Get completed job result."""
    result = await db.execute(
        text("SELECT status, result_json, error_message FROM processing_jobs WHERE id = :id"),
        {"id": job_id},
    )
    row = result.mappings().first()
    if not row:
        return {"status": "not_found"}

    result_data = None
    if row.get("result_json"):
        try:
            result_data = json.loads(row["result_json"])
        except Exception:
            result_data = row["result_json"]

    return {
        "status": row["status"],
        "result": result_data,
        "error": row.get("error_message"),
    }


async def mark_processing(db: AsyncSession, job_id: str):
    """Mark a job as being processed."""
    await db.execute(
        text("UPDATE processing_jobs SET status = :s, attempts = attempts + 1, updated_at = NOW() WHERE id = :id"),
        {"id": job_id, "s": STATUS_PROCESSING},
    )
    await db.commit()


async def mark_completed(db: AsyncSession, job_id: str, result: dict):
    """Mark a job as completed with result."""
    result_json = json.dumps(result) if result else None
    await db.execute(
        text("UPDATE processing_jobs SET status = :s, result_json = :result, completed_at = NOW(), updated_at = NOW() WHERE id = :id"),
        {"id": job_id, "s": STATUS_COMPLETED, "result": result_json},
    )
    await db.commit()


async def mark_failed(db: AsyncSession, job_id: str, error: str):
    """Mark a job as failed."""
    await db.execute(
        text("UPDATE processing_jobs SET status = :s, error_message = :err, updated_at = NOW() WHERE id = :id"),
        {"id": job_id, "s": STATUS_FAILED, "err": error[:2000]},
    )
    await db.commit()


async def should_retry(db: AsyncSession, job_id: str) -> bool:
    """Check if a failed job should be retried."""
    result = await db.execute(
        text("SELECT attempts FROM processing_jobs WHERE id = :id"),
        {"id": job_id},
    )
    row = result.first()
    return row and row[0] < MAX_RETRIES


async def requeue_job(db: AsyncSession, job_id: str):
    """Re-queue a failed job for retry."""
    await db.execute(
        text("UPDATE processing_jobs SET status = :s, updated_at = NOW() WHERE id = :id"),
        {"id": job_id, "s": STATUS_QUEUED},
    )
    await db.commit()
    try:
        result = await db.execute(
            text("SELECT job_type FROM processing_jobs WHERE id = :id"),
            {"id": job_id},
        )
        row = result.first()
        if row:
            redis = await get_redis()
            if redis:
                await redis.lpush("yukti:jobs", json.dumps({"job_id": job_id, "job_type": row[0]}))
    except Exception:
        pass


# ── Redis Connection ──

_redis = None

async def get_redis():
    """Get or create Redis connection. Returns None if unavailable."""
    global _redis
    if _redis:
        try:
            await _redis.ping()
            return _redis
        except Exception:
            _redis = None

    try:
        from app.core.config import get_settings
        settings = get_settings()
        if not settings.redis_url:
            return None
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _redis.ping()
        return _redis
    except Exception:
        return None


async def close_redis():
    """Close Redis connection."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
