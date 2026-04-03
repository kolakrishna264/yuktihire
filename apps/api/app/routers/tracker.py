"""Tracker Router — User job pipeline management."""
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.jobs import JobApplication, PipelineStage
from app.models.tracker import ApplicationEvent
from app.models.discover import Job, JobSkill

router = APIRouter(prefix="/tracker", tags=["tracker"])


class TrackerAdd(BaseModel):
    job_id: Optional[str] = None  # Link to normalized job
    title: str
    company: str
    url: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None
    work_type: Optional[str] = None
    experience_level: Optional[str] = None
    industry: Optional[str] = None
    skills: Optional[list[str]] = None
    description: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    pipeline_stage: Optional[PipelineStage] = PipelineStage.INTERESTED


class TrackerUpdate(BaseModel):
    notes: Optional[str] = None
    priority: Optional[int] = None
    next_action_date: Optional[str] = None
    resume_used: Optional[str] = None


class StageChange(BaseModel):
    stage: PipelineStage


class EventCreate(BaseModel):
    event_type: str  # note, interview, follow_up, status_change
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[str] = None
    metadata: Optional[dict] = None


def _serialize_tracked_job(a: JobApplication) -> dict:
    return {
        "id": a.id,
        "jobId": a.job_id,
        "title": a.role,
        "company": a.company,
        "url": a.url,
        "location": a.location,
        "salary": a.salary,
        "notes": a.notes,
        "source": a.source,
        "workType": a.work_type,
        "experienceLevel": a.experience_level,
        "industry": a.industry,
        "skills": json.loads(a.skills_json) if a.skills_json else [],
        "description": a.description,
        "pipelineStage": a.pipeline_stage.value if a.pipeline_stage else (a.status.value if a.status else "INTERESTED"),
        "priority": a.priority or 0,
        "resumeUsed": a.resume_used,
        "resumeVersionId": a.resume_version_id,
        "nextActionDate": a.next_action_date.isoformat() if a.next_action_date else None,
        "archived": a.archived or False,
        "appliedAt": a.applied_at.isoformat() if a.applied_at else None,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
        "updatedAt": a.updated_at.isoformat() if a.updated_at else None,
    }


def _serialize_event(e: ApplicationEvent) -> dict:
    return {
        "id": e.id,
        "eventType": e.event_type,
        "oldValue": e.old_value,
        "newValue": e.new_value,
        "title": e.title,
        "description": e.description,
        "metadata": e.metadata_json or {},
        "eventDate": e.event_date.isoformat() if e.event_date else None,
        "createdAt": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
async def list_tracked_jobs(
    stage: Optional[str] = Query(None, description="Filter by pipeline stage"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tracked jobs, optionally filtered by stage."""
    query = select(JobApplication).where(
        JobApplication.user_id == current_user.id,
        JobApplication.archived == False,
    )
    if stage and stage != "ALL":
        try:
            ps = PipelineStage(stage)
            query = query.where(JobApplication.pipeline_stage == ps)
        except ValueError:
            pass
    query = query.order_by(JobApplication.created_at.desc())

    result = await db.execute(query)
    jobs = result.scalars().all()
    return [_serialize_tracked_job(a) for a in jobs]


@router.get("/kanban")
async def get_kanban(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get jobs grouped by pipeline stage with counts."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.user_id == current_user.id,
            JobApplication.archived == False,
        ).order_by(JobApplication.priority.desc(), JobApplication.created_at.desc())
    )
    all_jobs = result.scalars().all()

    # Group by stage
    stages = {}
    for stage in PipelineStage:
        stages[stage.value] = {"count": 0, "jobs": []}

    for job in all_jobs:
        stage_val = job.pipeline_stage.value if job.pipeline_stage else "INTERESTED"
        if stage_val in stages:
            stages[stage_val]["count"] += 1
            stages[stage_val]["jobs"].append(_serialize_tracked_job(job))

    return {"stages": stages}


@router.post("")
async def add_to_tracker(
    data: TrackerAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a job to the tracker. Duplicate detection by URL or company+title."""
    # Dedup check
    if data.url:
        result = await db.execute(
            select(JobApplication).where(
                JobApplication.user_id == current_user.id,
                JobApplication.url == data.url,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Job already tracked")
    else:
        result = await db.execute(
            select(JobApplication).where(
                JobApplication.user_id == current_user.id,
                JobApplication.role == data.title,
                JobApplication.company == data.company,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Job already tracked")

    app = JobApplication(
        user_id=current_user.id,
        job_id=data.job_id,
        role=data.title,
        company=data.company,
        url=data.url,
        location=data.location,
        salary=data.salary,
        work_type=data.work_type,
        experience_level=data.experience_level,
        industry=data.industry,
        skills_json=json.dumps(data.skills) if data.skills else None,
        description=data.description,
        source=data.source or "manual",
        notes=data.notes,
        pipeline_stage=data.pipeline_stage or PipelineStage.INTERESTED,
        status=None,  # Using pipeline_stage instead
    )
    db.add(app)
    await db.flush()
    await db.refresh(app)

    # Create initial event
    event = ApplicationEvent(
        application_id=app.id,
        event_type="status_change",
        new_value=app.pipeline_stage.value,
        title=f"Added to {app.pipeline_stage.value.replace('_', ' ').title()}",
        event_date=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.commit()

    return _serialize_tracked_job(app)


class BulkStageChange(BaseModel):
    ids: list[str]
    stage: PipelineStage


class BulkArchive(BaseModel):
    ids: list[str]


@router.post("/bulk/stage")
async def bulk_change_stage(
    data: BulkStageChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change stage for multiple tracked jobs at once."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id.in_(data.ids),
            JobApplication.user_id == current_user.id,
        )
    )
    apps = result.scalars().all()
    updated = 0
    for app in apps:
        old = app.pipeline_stage.value if app.pipeline_stage else "INTERESTED"
        app.pipeline_stage = data.stage
        if data.stage == PipelineStage.APPLIED and not app.applied_at:
            app.applied_at = datetime.now(timezone.utc)
        event = ApplicationEvent(
            application_id=app.id,
            event_type="status_change",
            old_value=old,
            new_value=data.stage.value,
            title=f"Bulk moved to {data.stage.value.replace('_', ' ').title()}",
            event_date=datetime.now(timezone.utc),
        )
        db.add(event)
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.post("/bulk/archive")
async def bulk_archive(
    data: BulkArchive,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive multiple tracked jobs at once."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id.in_(data.ids),
            JobApplication.user_id == current_user.id,
        )
    )
    apps = result.scalars().all()
    for app in apps:
        app.archived = True
        app.pipeline_stage = PipelineStage.ARCHIVED
    await db.commit()
    return {"archived": len(apps)}


@router.post("/bulk/delete")
async def bulk_delete(
    data: BulkArchive,  # Reuse same schema
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple tracked jobs at once."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id.in_(data.ids),
            JobApplication.user_id == current_user.id,
        )
    )
    apps = result.scalars().all()
    for app in apps:
        await db.delete(app)
    await db.commit()
    return {"deleted": len(apps)}


@router.get("/{tracker_id}/resume-intel")
async def get_resume_intel(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get resume and tailoring intelligence for a tracked job."""
    from app.models.tailoring import TailoringSession, AtsScore
    from app.models.resume import Resume, ResumeVersion

    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Not found")

    intel = {
        "resumeUsed": app.resume_used,
        "resumeVersionId": app.resume_version_id,
        "tailoredResume": None,
        "atsScore": None,
        "missingSkills": [],
        "lastTailoredAt": None,
        "tailoringStatus": None,
    }

    # Find tailoring sessions for this job's description
    if app.description or app.url:
        # Look for tailoring sessions that match
        sessions_query = select(TailoringSession).where(
            TailoringSession.user_id == current_user.id,
        ).order_by(TailoringSession.created_at.desc()).limit(5)

        sessions_result = await db.execute(sessions_query)
        sessions = sessions_result.scalars().all()

        if sessions:
            latest = sessions[0]
            intel["lastTailoredAt"] = latest.created_at.isoformat() if latest.created_at else None
            intel["tailoringStatus"] = latest.status.value if latest.status else None

            # Get ATS score
            ats_result = await db.execute(
                select(AtsScore).where(AtsScore.session_id == latest.id)
            )
            ats = ats_result.scalar_one_or_none()
            if ats:
                intel["atsScore"] = {
                    "overall": ats.overall_score,
                    "keywords": ats.keyword_score,
                    "skills": ats.skills_score,
                    "experience": ats.experience_score,
                }
                intel["missingSkills"] = ats.missing_keywords or []

    # Get resume version if linked
    if app.resume_version_id:
        rv_result = await db.execute(
            select(ResumeVersion).where(ResumeVersion.id == app.resume_version_id)
        )
        rv = rv_result.scalar_one_or_none()
        if rv:
            intel["tailoredResume"] = {
                "id": rv.id,
                "label": rv.label,
                "createdAt": rv.created_at.isoformat() if rv.created_at else None,
            }

    return intel


@router.get("/{tracker_id}")
async def get_tracked_job(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a tracked job with its events."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    # Load events
    events_result = await db.execute(
        select(ApplicationEvent)
        .where(ApplicationEvent.application_id == tracker_id)
        .order_by(ApplicationEvent.event_date.desc())
    )
    events = events_result.scalars().all()

    data = _serialize_tracked_job(app)
    data["events"] = [_serialize_event(e) for e in events]
    return data


@router.patch("/{tracker_id}")
async def update_tracked_job(
    tracker_id: str,
    data: TrackerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update tracked job fields (notes, priority, etc.)."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    payload = data.model_dump(exclude_none=True)
    if "next_action_date" in payload:
        try:
            app.next_action_date = datetime.fromisoformat(payload.pop("next_action_date"))
        except (ValueError, TypeError):
            payload.pop("next_action_date", None)

    for field, value in payload.items():
        setattr(app, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(app)
    return _serialize_tracked_job(app)


@router.patch("/{tracker_id}/stage")
async def change_stage(
    tracker_id: str,
    data: StageChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change pipeline stage. Auto-creates a timeline event."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    old_stage = app.pipeline_stage.value if app.pipeline_stage else "INTERESTED"
    new_stage = data.stage.value

    if old_stage == new_stage:
        return _serialize_tracked_job(app)

    app.pipeline_stage = data.stage

    # Set applied_at when moving to APPLIED
    if data.stage == PipelineStage.APPLIED and not app.applied_at:
        app.applied_at = datetime.now(timezone.utc)

    # Auto-create event
    event = ApplicationEvent(
        application_id=app.id,
        event_type="status_change",
        old_value=old_stage,
        new_value=new_stage,
        title=f"Moved to {new_stage.replace('_', ' ').title()}",
        event_date=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()
    await db.commit()
    await db.refresh(app)
    return _serialize_tracked_job(app)


@router.delete("/{tracker_id}", status_code=204)
async def remove_from_tracker(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a job from the tracker."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Tracked job not found")
    await db.delete(app)
    await db.commit()


@router.post("/{tracker_id}/archive")
async def archive_job(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive a tracked job."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    app.archived = True
    app.pipeline_stage = PipelineStage.ARCHIVED
    await db.flush()
    await db.commit()
    await db.refresh(app)
    return _serialize_tracked_job(app)


# ── Events sub-routes ────────────────────────────────────────────────────────

@router.get("/{tracker_id}/events")
async def list_events(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    events_result = await db.execute(
        select(ApplicationEvent)
        .where(ApplicationEvent.application_id == tracker_id)
        .order_by(ApplicationEvent.event_date.desc())
    )
    events = events_result.scalars().all()
    return [_serialize_event(e) for e in events]


@router.post("/{tracker_id}/events")
async def add_event(
    tracker_id: str,
    data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    event_date = datetime.now(timezone.utc)
    if data.event_date:
        try:
            event_date = datetime.fromisoformat(data.event_date)
        except ValueError:
            pass

    event = ApplicationEvent(
        application_id=tracker_id,
        event_type=data.event_type,
        title=data.title,
        description=data.description,
        metadata_json=data.metadata or {},
        event_date=event_date,
    )
    db.add(event)
    await db.flush()
    await db.commit()
    await db.refresh(event)
    return _serialize_event(event)


@router.post("/{tracker_id}/tailor")
async def tailor_from_tracker(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tailor-ready data from a tracked job."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    return {
        "jobDescription": app.description or "",
        "company": app.company,
        "role": app.role,
        "url": app.url,
        "trackerId": app.id,
    }


@router.delete("/{tracker_id}/events/{event_id}", status_code=204)
async def delete_event(
    tracker_id: str,
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == tracker_id,
            JobApplication.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    event_result = await db.execute(
        select(ApplicationEvent).where(
            ApplicationEvent.id == event_id,
            ApplicationEvent.application_id == tracker_id,
        )
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
