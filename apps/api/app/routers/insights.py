"""Insights Router — Analytics and KPIs for job search activity."""
import json
from collections import Counter
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.jobs import PipelineStage

router = APIRouter(prefix="/insights", tags=["insights"])

# Stages that count as "applied"
APPLIED_STAGE_VALS = {"APPLIED", "PHONE_SCREEN", "INTERVIEWING", "OFFER"}
INTERVIEWING_STAGE_VALS = {"PHONE_SCREEN", "INTERVIEWING"}


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return summary KPIs for the user's job search."""
    try:
        result = await db.execute(
            text("SELECT pipeline_stage, status FROM job_applications WHERE user_id = :uid AND (archived = false OR archived IS NULL)"),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
    except Exception as e:
        print(f"[Insights] overview error: {e}")
        rows = []

    total_tracked = len(rows)
    total_applied = 0
    total_interviewing = 0
    total_offers = 0
    total_rejected = 0

    for r in rows:
        stage = r.get("pipeline_stage") or r.get("status") or "INTERESTED"
        if stage in APPLIED_STAGE_VALS:
            total_applied += 1
        if stage in INTERVIEWING_STAGE_VALS:
            total_interviewing += 1
        if stage == "OFFER":
            total_offers += 1
        if stage == "REJECTED":
            total_rejected += 1

    response_rate = (total_interviewing / total_applied * 100) if total_applied > 0 else 0
    interview_rate = (total_interviewing / total_applied * 100) if total_applied > 0 else 0
    offer_rate = (total_offers / total_applied * 100) if total_applied > 0 else 0

    # Upcoming reminders count
    now = datetime.now(timezone.utc)
    upcoming_reminders = 0
    try:
        reminder_result = await db.execute(
            text("SELECT COUNT(*) FROM reminders WHERE user_id = :uid AND is_completed = false AND remind_at > :now"),
            {"uid": current_user.id, "now": now},
        )
        upcoming_reminders = reminder_result.scalar() or 0
    except Exception:
        pass

    return {
        "totalTracked": total_tracked,
        "totalApplied": total_applied,
        "totalInterviewing": total_interviewing,
        "totalOffers": total_offers,
        "totalRejected": total_rejected,
        "responseRate": round(response_rate, 1),
        "interviewRate": round(interview_rate, 1),
        "offerRate": round(offer_rate, 1),
        "upcomingReminders": upcoming_reminders,
    }


@router.get("/pipeline")
async def get_pipeline(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return counts per pipeline stage."""
    try:
        result = await db.execute(
            text("""SELECT COALESCE(pipeline_stage, status, 'INTERESTED') as stage, COUNT(*) as cnt
                    FROM job_applications
                    WHERE user_id = :uid AND (archived = false OR archived IS NULL)
                    GROUP BY stage"""),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
    except Exception as e:
        print(f"[Insights] pipeline error: {e}")
        rows = []

    # Build a complete map with all stages
    stage_counts = {stage.value: 0 for stage in PipelineStage}
    for r in rows:
        stage_val = r.get("stage")
        if stage_val and stage_val in stage_counts:
            stage_counts[stage_val] = r.get("cnt", 0)

    return [{"stage": stage, "count": count} for stage, count in stage_counts.items()]


@router.get("/activity")
async def get_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return applications per week for the last 12 weeks."""
    twelve_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=12)

    try:
        result = await db.execute(
            text("""SELECT date_trunc('week', created_at) as week, COUNT(*) as cnt
                    FROM job_applications
                    WHERE user_id = :uid AND created_at >= :since
                    GROUP BY week ORDER BY week DESC"""),
            {"uid": current_user.id, "since": twelve_weeks_ago},
        )
        rows = result.mappings().all()
    except Exception as e:
        print(f"[Insights] activity error: {e}")
        rows = []

    return [
        {
            "week": r["week"].strftime("%G-W%V") if r.get("week") else None,
            "count": r.get("cnt", 0),
        }
        for r in rows
    ]


@router.get("/skills")
async def get_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top 20 skills across all tracked jobs."""
    try:
        result = await db.execute(
            text("SELECT skills_json FROM job_applications WHERE user_id = :uid AND skills_json IS NOT NULL"),
            {"uid": current_user.id},
        )
        rows = result.all()
    except Exception as e:
        print(f"[Insights] skills error: {e}")
        rows = []

    skill_counter: Counter = Counter()
    for row in rows:
        try:
            skills = json.loads(row[0])
            if isinstance(skills, list):
                for skill in skills:
                    if isinstance(skill, str) and skill.strip():
                        skill_counter[skill.strip()] += 1
        except (json.JSONDecodeError, TypeError):
            continue

    top_skills = skill_counter.most_common(20)
    return [{"skill": skill, "count": count} for skill, count in top_skills]


@router.get("/industries")
async def get_industries(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top industries across tracked jobs."""
    try:
        result = await db.execute(
            text("""SELECT industry, COUNT(*) as cnt FROM job_applications
                    WHERE user_id = :uid AND industry IS NOT NULL AND industry != ''
                    GROUP BY industry ORDER BY cnt DESC"""),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
    except Exception as e:
        print(f"[Insights] industries error: {e}")
        rows = []

    return [{"industry": r["industry"], "count": r["cnt"]} for r in rows]


@router.get("/locations")
async def get_locations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top locations and remote ratio."""
    try:
        result = await db.execute(
            text("""SELECT location, COUNT(*) as cnt FROM job_applications
                    WHERE user_id = :uid AND location IS NOT NULL AND location != ''
                    GROUP BY location ORDER BY cnt DESC"""),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
    except Exception as e:
        print(f"[Insights] locations error: {e}")
        rows = []

    top_locations = [{"location": r["location"], "count": r["cnt"]} for r in rows]

    total = sum(r["cnt"] for r in rows)
    remote_count = sum(
        r["cnt"] for r in rows
        if r.get("location") and "remote" in r["location"].lower()
    )
    remote_ratio = round(remote_count / total, 2) if total > 0 else 0

    return {
        "topLocations": top_locations,
        "remoteRatio": remote_ratio,
    }
