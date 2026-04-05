"""
YuktiHire Background Worker — Processes async AI jobs from Redis queue.

Run: python worker.py
Or on Railway: add as separate service with this as the start command.

Pulls jobs from Redis queue (or polls DB), processes them using AI,
and saves results. Handles retries and failure logging.
"""
import asyncio
import json
import time
from datetime import datetime, timezone

# Setup path
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.queue import (
    get_redis, close_redis,
    mark_processing, mark_completed, mark_failed,
    should_retry, requeue_job,
    STATUS_QUEUED, STATUS_PROCESSING,
)
from app.core.logger import log

settings = get_settings()

# ── Job Handlers ──────────────────────────────────────────────────────────

async def handle_tailor_resume(payload: dict, db):
    """Process a resume tailoring job."""
    from app.routers.tailor import run_pipeline_background
    session_id = payload.get("session_id")
    resume_content = payload.get("resume_content", {})
    jd_text = payload.get("jd_text", "")
    await run_pipeline_background(session_id, resume_content, jd_text, None)
    return {"session_id": session_id, "status": "completed"}


async def handle_generate_ai_answer(payload: dict, db):
    """Generate an AI answer for an application question."""
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    question = payload.get("question", "")
    tone = payload.get("tone", "professional")

    prompt = f"Answer this job application question in a {tone} tone. Be concise (2-4 sentences for short questions, 200-400 words for open-ended). Question: {question}"

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    answer = response.content[0].text if response.content else ""
    return {"answer": answer, "question": question}


async def handle_generate_cover_letter(payload: dict, db):
    """Generate a cover letter."""
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    jd = payload.get("job_description", "")
    resume = payload.get("resume_summary", "")
    company = payload.get("company", "")
    role = payload.get("role", "")

    prompt = f"""Write a professional cover letter for the role of {role} at {company}.

Job Description:
{jd[:3000]}

Candidate Summary:
{resume[:2000]}

Write a compelling, honest cover letter (3-4 paragraphs). Do not fabricate experience."""

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"coverLetter": response.content[0].text if response.content else ""}


async def handle_parse_resume(payload: dict, db):
    """Parse a resume file."""
    from resume_parser import parse_resume
    content = payload.get("file_content", b"")
    filename = payload.get("filename", "resume.pdf")
    if isinstance(content, str):
        import base64
        content = base64.b64decode(content)
    parsed = await parse_resume(content, filename)
    return {"parsed": parsed}


async def handle_compute_ats_score(payload: dict, db):
    """Compute ATS score for a resume against a JD."""
    # Placeholder — uses existing scoring logic
    return {"score": 0, "status": "not_implemented"}


async def handle_generic_ai(payload: dict, db, job_type: str):
    """Generic handler for interview prep, company intel, outreach."""
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = payload.get("prompt", "")
    max_tokens = payload.get("max_tokens", 1000)

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text if response.content else ""

    # Log AI usage
    await log_ai_usage(db, payload.get("user_id"), job_type, response)

    return {"result": text}


# ── AI Usage Logging ──

async def log_ai_usage(db, user_id: str, job_type: str, response):
    """Log AI API usage for analytics."""
    try:
        import uuid
        tokens_in = getattr(response.usage, "input_tokens", 0) if hasattr(response, "usage") else 0
        tokens_out = getattr(response.usage, "output_tokens", 0) if hasattr(response, "usage") else 0
        from sqlalchemy import text
        await db.execute(
            text("""INSERT INTO ai_usage_logs (id, user_id, job_type, model_name, provider,
                    tokens_input, tokens_output, success, created_at)
                    VALUES (:id, :uid, :type, :model, 'anthropic', :tin, :tout, true, NOW())"""),
            {"id": str(uuid.uuid4()), "uid": user_id, "type": job_type,
             "model": "claude-sonnet-4-6", "tin": tokens_in, "tout": tokens_out},
        )
        await db.commit()
    except Exception as e:
        log.warning("ai_usage_log_failed", error=str(e))


# ── Job Router ──

JOB_HANDLERS = {
    "tailor_resume": handle_tailor_resume,
    "generate_ai_answer": handle_generate_ai_answer,
    "generate_cover_letter": handle_generate_cover_letter,
    "parse_resume": handle_parse_resume,
    "compute_ats_score": handle_compute_ats_score,
    "generate_interview_prep": lambda p, db: handle_generic_ai(p, db, "generate_interview_prep"),
    "generate_company_intel": lambda p, db: handle_generic_ai(p, db, "generate_company_intel"),
    "generate_outreach": lambda p, db: handle_generic_ai(p, db, "generate_outreach"),
}


# ── Worker Loop ──────────────────────────────────────────────────────────

async def process_job(job_id: str, job_type: str):
    """Process a single job."""
    start = time.time()
    log.info("job_started", job_id=job_id, job_type=job_type)

    async with AsyncSessionLocal() as db:
        try:
            # Mark as processing
            await mark_processing(db, job_id)

            # Load payload
            from sqlalchemy import text
            result = await db.execute(
                text("SELECT payload_json, user_id FROM processing_jobs WHERE id = :id"),
                {"id": job_id},
            )
            row = result.mappings().first()
            if not row:
                log.error("job_not_found", job_id=job_id)
                return

            payload = json.loads(row["payload_json"]) if row["payload_json"] else {}
            payload["user_id"] = row["user_id"]

            # Get handler
            handler = JOB_HANDLERS.get(job_type)
            if not handler:
                await mark_failed(db, job_id, f"Unknown job type: {job_type}")
                log.error("unknown_job_type", job_id=job_id, job_type=job_type)
                return

            # Execute
            result = await handler(payload, db)

            # Mark completed
            await mark_completed(db, job_id, result)

            duration_ms = round((time.time() - start) * 1000)
            log.info("job_completed", job_id=job_id, job_type=job_type, duration_ms=duration_ms)

        except Exception as e:
            duration_ms = round((time.time() - start) * 1000)
            log.error("job_failed", job_id=job_id, job_type=job_type, error=str(e), duration_ms=duration_ms)

            try:
                await mark_failed(db, job_id, str(e))

                # Retry if under limit
                if await should_retry(db, job_id):
                    await requeue_job(db, job_id)
                    log.info("job_requeued", job_id=job_id, job_type=job_type)
            except Exception as re:
                log.error("job_retry_failed", job_id=job_id, error=str(re))


async def worker_loop():
    """Main worker loop — pulls jobs from Redis or polls DB."""
    log.info("worker_started")

    while True:
        job_data = None

        # Try Redis first
        try:
            redis = await get_redis()
            if redis:
                raw = await redis.brpop("yukti:jobs", timeout=5)
                if raw:
                    job_data = json.loads(raw[1])
        except Exception as e:
            log.warning("redis_pop_failed", error=str(e))

        # Fallback: poll DB for queued jobs
        if not job_data:
            try:
                async with AsyncSessionLocal() as db:
                    from sqlalchemy import text
                    result = await db.execute(
                        text("""SELECT id, job_type FROM processing_jobs
                                WHERE status = :s ORDER BY created_at ASC LIMIT 1"""),
                        {"s": STATUS_QUEUED},
                    )
                    row = result.mappings().first()
                    if row:
                        job_data = {"job_id": row["id"], "job_type": row["job_type"]}
            except Exception as e:
                log.warning("db_poll_failed", error=str(e))

        if job_data:
            await process_job(job_data["job_id"], job_data["job_type"])
        else:
            # No jobs — wait before polling again
            await asyncio.sleep(2)


async def main():
    """Entry point for the worker process."""
    log.info("worker_init", redis_url=settings.redis_url[:20] + "..." if settings.redis_url else "none")
    try:
        await worker_loop()
    except KeyboardInterrupt:
        log.info("worker_shutdown")
    finally:
        await close_redis()


if __name__ == "__main__":
    asyncio.run(main())
