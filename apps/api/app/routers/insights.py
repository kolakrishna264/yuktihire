"""Insights Router — Analytics and KPIs for job search activity."""
import json
from collections import Counter
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.jobs import JobApplication, PipelineStage
from app.models.v2 import Reminder

router = APIRouter(prefix="/insights", tags=["insights"])

# Stages that count as "applied"
APPLIED_STAGES = {
    PipelineStage.APPLIED,
    PipelineStage.PHONE_SCREEN,
    PipelineStage.INTERVIEWING,
    PipelineStage.OFFER,
}

INTERVIEWING_STAGES = {
    PipelineStage.PHONE_SCREEN,
    PipelineStage.INTERVIEWING,
}


@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return summary KPIs for the user's job search."""
    # Get all non-archived applications
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.user_id == current_user.id,
            JobApplication.archived == False,
        )
    )
    apps = result.scalars().all()

    total_tracked = len(apps)
    total_applied = sum(1 for a in apps if a.pipeline_stage in APPLIED_STAGES)
    total_interviewing = sum(1 for a in apps if a.pipeline_stage in INTERVIEWING_STAGES)
    total_offers = sum(1 for a in apps if a.pipeline_stage == PipelineStage.OFFER)
    total_rejected = sum(1 for a in apps if a.pipeline_stage == PipelineStage.REJECTED)

    response_rate = (total_interviewing / total_applied * 100) if total_applied > 0 else 0
    interview_rate = (total_interviewing / total_applied * 100) if total_applied > 0 else 0
    offer_rate = (total_offers / total_applied * 100) if total_applied > 0 else 0

    # Upcoming reminders count
    now = datetime.now(timezone.utc)
    reminder_result = await db.execute(
        select(func.count(Reminder.id)).where(
            Reminder.user_id == current_user.id,
            Reminder.is_completed == False,
            Reminder.remind_at > now,
        )
    )
    upcoming_reminders = reminder_result.scalar() or 0

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
    result = await db.execute(
        select(
            JobApplication.pipeline_stage,
            func.count(JobApplication.id),
        ).where(
            JobApplication.user_id == current_user.id,
            JobApplication.archived == False,
        ).group_by(JobApplication.pipeline_stage)
    )
    rows = result.all()

    # Build a complete map with all stages
    stage_counts = {stage.value: 0 for stage in PipelineStage}
    for stage, count in rows:
        if stage:
            stage_counts[stage.value] = count

    return [{"stage": stage, "count": count} for stage, count in stage_counts.items()]


@router.get("/activity")
async def get_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return applications per week for the last 12 weeks."""
    twelve_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=12)

    result = await db.execute(
        select(
            func.date_trunc("week", JobApplication.created_at).label("week"),
            func.count(JobApplication.id),
        ).where(
            JobApplication.user_id == current_user.id,
            JobApplication.created_at >= twelve_weeks_ago,
        ).group_by("week").order_by(func.date_trunc("week", JobApplication.created_at).desc())
    )
    rows = result.all()

    return [
        {
            "week": row[0].strftime("%G-W%V") if row[0] else None,
            "count": row[1],
        }
        for row in rows
    ]


@router.get("/skills")
async def get_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top 20 skills across all tracked jobs."""
    result = await db.execute(
        select(JobApplication.skills_json).where(
            JobApplication.user_id == current_user.id,
            JobApplication.skills_json.isnot(None),
        )
    )
    rows = result.scalars().all()

    skill_counter: Counter = Counter()
    for skills_json in rows:
        try:
            skills = json.loads(skills_json)
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
    result = await db.execute(
        select(
            JobApplication.industry,
            func.count(JobApplication.id),
        ).where(
            JobApplication.user_id == current_user.id,
            JobApplication.industry.isnot(None),
            JobApplication.industry != "",
        ).group_by(JobApplication.industry).order_by(func.count(JobApplication.id).desc())
    )
    rows = result.all()

    return [{"industry": industry, "count": count} for industry, count in rows]


@router.get("/locations")
async def get_locations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return top locations and remote ratio."""
    result = await db.execute(
        select(
            JobApplication.location,
            func.count(JobApplication.id),
        ).where(
            JobApplication.user_id == current_user.id,
            JobApplication.location.isnot(None),
            JobApplication.location != "",
        ).group_by(JobApplication.location).order_by(func.count(JobApplication.id).desc())
    )
    rows = result.all()

    top_locations = [{"location": loc, "count": count} for loc, count in rows]

    total = sum(r[1] for r in rows)
    remote_count = sum(
        count for loc, count in rows
        if loc and "remote" in loc.lower()
    )
    remote_ratio = round(remote_count / total, 2) if total > 0 else 0

    return {
        "topLocations": top_locations,
        "remoteRatio": remote_ratio,
    }
