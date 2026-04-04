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
    status: Optional[str] = None


class StageChange(BaseModel):
    stage: PipelineStage


class EventCreate(BaseModel):
    event_type: str  # note, interview, follow_up, status_change
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[str] = None
    metadata: Optional[dict] = None


def _serialize_row(r) -> dict:
    """Serialize a raw SQL row mapping (dict-like) — safe even if columns are missing."""
    pipeline = r.get("pipeline_stage") or r.get("status") or "INTERESTED"
    skills_raw = r.get("skills_json")
    skills = json.loads(skills_raw) if skills_raw else []
    applied = r.get("applied_at")
    created = r.get("created_at")
    updated = r.get("updated_at")
    return {
        "id": r.get("id"),
        "jobId": r.get("job_id"),
        "title": r.get("role", ""),
        "company": r.get("company", ""),
        "url": r.get("url"),
        "location": r.get("location"),
        "salary": r.get("salary"),
        "notes": r.get("notes"),
        "source": r.get("source"),
        "workType": r.get("work_type"),
        "experienceLevel": r.get("experience_level"),
        "industry": r.get("industry"),
        "skills": skills,
        "description": r.get("description"),
        "pipelineStage": pipeline,
        "priority": r.get("priority", 0) or 0,
        "resumeUsed": r.get("resume_used"),
        "resumeVersionId": r.get("resume_version_id"),
        "nextActionDate": str(r["next_action_date"]) if r.get("next_action_date") else None,
        "archived": r.get("archived", False) or False,
        "appliedAt": applied.isoformat() if applied else None,
        "createdAt": created.isoformat() if created else None,
        "updatedAt": updated.isoformat() if updated else None,
    }


def _serialize_tracked_job(a: JobApplication) -> dict:
    # Defensive: some columns may not exist in DB yet (added in later migrations)
    try:
        pipeline = a.pipeline_stage.value if a.pipeline_stage else None
    except Exception:
        pipeline = None
    if not pipeline:
        try:
            pipeline = a.status.value if a.status else "INTERESTED"
        except Exception:
            pipeline = "INTERESTED"

    return {
        "id": a.id,
        "jobId": getattr(a, "job_id", None),
        "title": a.role,
        "company": a.company,
        "url": a.url,
        "location": getattr(a, "location", None),
        "salary": getattr(a, "salary", None),
        "notes": a.notes,
        "source": getattr(a, "source", None),
        "workType": getattr(a, "work_type", None),
        "experienceLevel": getattr(a, "experience_level", None),
        "industry": getattr(a, "industry", None),
        "skills": json.loads(a.skills_json) if getattr(a, "skills_json", None) else [],
        "description": getattr(a, "description", None),
        "pipelineStage": pipeline,
        "priority": getattr(a, "priority", 0) or 0,
        "resumeUsed": getattr(a, "resume_used", None),
        "resumeVersionId": getattr(a, "resume_version_id", None),
        "nextActionDate": getattr(a, "next_action_date", None),
        "archived": getattr(a, "archived", False) or False,
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
    from sqlalchemy import text
    try:
        # Use raw SQL to avoid referencing columns that may not exist
        sql = "SELECT * FROM job_applications WHERE user_id = :uid ORDER BY created_at DESC"
        result = await db.execute(text(sql), {"uid": current_user.id})
        rows = result.mappings().all()
        return [_serialize_row(r) for r in rows]
    except Exception as e:
        print(f"[Tracker] list error: {e}")
        return []


@router.get("/kanban")
async def get_kanban(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get jobs grouped by pipeline stage with counts."""
    from sqlalchemy import text
    try:
        sql = "SELECT * FROM job_applications WHERE user_id = :uid ORDER BY created_at DESC"
        result = await db.execute(text(sql), {"uid": current_user.id})
        rows = result.mappings().all()
    except Exception as e:
        print(f"[Tracker] kanban error: {e}")
        rows = []

    stages = {}
    for stage in PipelineStage:
        stages[stage.value] = {"count": 0, "jobs": []}

    for r in rows:
        stage_val = r.get("pipeline_stage") or r.get("status") or "INTERESTED"
        if stage_val in stages:
            stages[stage_val]["count"] += 1
            stages[stage_val]["jobs"].append(_serialize_row(r))
        else:
            # Unknown stage — put in INTERESTED
            stages["INTERESTED"]["count"] += 1
            stages["INTERESTED"]["jobs"].append(_serialize_row(r))

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
    from sqlalchemy import text as sql_text
    try:
        result = await db.execute(
            sql_text("SELECT * FROM job_applications WHERE id = :id AND user_id = :uid"),
            {"id": tracker_id, "uid": current_user.id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Tracked job not found")

        data = _serialize_row(row)

        # Load events (table may not exist)
        events = []
        try:
            events_result = await db.execute(
                sql_text("SELECT * FROM application_events WHERE application_id = :id ORDER BY created_at DESC"),
                {"id": tracker_id},
            )
            events = [dict(e) for e in events_result.mappings().all()]
        except Exception:
            pass
        data["events"] = [{
            "id": e.get("id"),
            "eventType": e.get("event_type"),
            "title": e.get("title"),
            "description": e.get("description"),
            "createdAt": e["created_at"].isoformat() if e.get("created_at") else None,
        } for e in events]

        return data
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracker] get detail error: {e}")
        raise HTTPException(status_code=404, detail="Job not found")
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
    """Update tracked job fields (notes, priority, status, etc.)."""
    from sqlalchemy import text
    try:
        # Check ownership
        result = await db.execute(
            text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
            {"id": tracker_id, "uid": current_user.id},
        )
        if not result.first():
            raise HTTPException(status_code=404, detail="Not found")

        # Update fields
        payload = data.model_dump(exclude_none=True)
        if not payload:
            return {"status": "no changes"}

        # Map field names to DB column names
        field_to_col = {
            "notes": "notes",
            "priority": "priority",
            "next_action_date": "next_action_date",
            "resume_used": "resume_used",
            "status": "pipeline_stage",
        }

        set_clauses = []
        params = {"id": tracker_id}
        for key, value in payload.items():
            col = field_to_col.get(key, key)
            set_clauses.append(f"{col} = :{key}")
            params[key] = value

        if set_clauses:
            set_clauses.append("updated_at = NOW()")
            sql = f"UPDATE job_applications SET {', '.join(set_clauses)} WHERE id = :id"
            await db.execute(text(sql), params)
            await db.commit()

        # Return updated
        result = await db.execute(text("SELECT * FROM job_applications WHERE id = :id"), {"id": tracker_id})
        row = result.mappings().first()
        return _serialize_row(row)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Tracker] update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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


@router.post("/{tracker_id}/create-followups")
async def create_follow_up_reminders(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create automatic follow-up reminders after applying."""
    from sqlalchemy import text
    import uuid
    from datetime import timedelta

    # Verify ownership
    result = await db.execute(
        text("SELECT id, role, company FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    job = result.mappings().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    now = datetime.now(timezone.utc)
    company = job.get("company", "the company")
    role = job.get("role", "the role")

    reminders = [
        {"title": f"Follow up on {role} at {company}", "days": 3, "type": "follow_up"},
        {"title": f"Second follow up — {role} at {company}", "days": 7, "type": "follow_up"},
        {"title": f"Recruiter outreach — {company}", "days": 5, "type": "recruiter"},
    ]

    created = 0
    for r in reminders:
        try:
            await db.execute(
                text("""INSERT INTO reminders (id, user_id, application_id, title, remind_at, is_completed, created_at)
                        VALUES (:id, :uid, :app_id, :title, :remind_at, false, NOW())"""),
                {
                    "id": str(uuid.uuid4()),
                    "uid": current_user.id,
                    "app_id": tracker_id,
                    "title": r["title"],
                    "remind_at": (now + timedelta(days=r["days"])).isoformat(),
                },
            )
            created += 1
        except Exception as e:
            print(f"[Reminders] Error creating: {e}")

    await db.commit()
    return {"created": created, "reminders": [r["title"] for r in reminders]}


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
