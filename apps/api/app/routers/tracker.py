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
    # Dedup check using raw SQL
    from sqlalchemy import text as sql_text
    if data.url:
        result = await db.execute(
            sql_text("SELECT id FROM job_applications WHERE user_id = :uid AND url = :url LIMIT 1"),
            {"uid": current_user.id, "url": data.url},
        )
        if result.first():
            raise HTTPException(status_code=409, detail="Job already tracked")
    else:
        result = await db.execute(
            sql_text("SELECT id FROM job_applications WHERE user_id = :uid AND role = :role AND company = :company LIMIT 1"),
            {"uid": current_user.id, "role": data.title, "company": data.company},
        )
        if result.first():
            raise HTTPException(status_code=409, detail="Job already tracked")

    import uuid
    app_id = str(uuid.uuid4())
    stage_val = (data.pipeline_stage or PipelineStage.INTERESTED).value
    skills_str = json.dumps(data.skills) if data.skills else None
    now = datetime.now(timezone.utc)

    await db.execute(
        sql_text("""
            INSERT INTO job_applications (id, user_id, job_id, role, company, url, location, salary,
                work_type, experience_level, industry, skills_json, description, source, notes,
                pipeline_stage, created_at, updated_at)
            VALUES (:id, :uid, :job_id, :role, :company, :url, :location, :salary,
                :work_type, :experience_level, :industry, :skills_json, :description, :source, :notes,
                :pipeline_stage, :now, :now)
        """),
        {
            "id": app_id, "uid": current_user.id, "job_id": data.job_id,
            "role": data.title, "company": data.company, "url": data.url,
            "location": data.location, "salary": data.salary,
            "work_type": data.work_type, "experience_level": data.experience_level,
            "industry": data.industry, "skills_json": skills_str,
            "description": data.description, "source": data.source or "manual",
            "notes": data.notes, "pipeline_stage": stage_val, "now": now,
        },
    )

    # Create initial event
    event_id = str(uuid.uuid4())
    await db.execute(
        sql_text("""
            INSERT INTO application_events (id, application_id, event_type, new_value, title, event_date, created_at)
            VALUES (:id, :app_id, 'status_change', :new_value, :title, :now, :now)
        """),
        {
            "id": event_id, "app_id": app_id,
            "new_value": stage_val,
            "title": f"Added to {stage_val.replace('_', ' ').title()}",
            "now": now,
        },
    )
    await db.commit()

    # Return the newly created row
    result = await db.execute(
        sql_text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": app_id},
    )
    return _serialize_row(result.mappings().first())


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
    from sqlalchemy import text as sql_text
    import uuid
    now = datetime.now(timezone.utc)
    new_stage = data.stage.value

    # Get current stages for events
    placeholders = ", ".join([f":id_{i}" for i in range(len(data.ids))])
    params = {"uid": current_user.id}
    for i, id_val in enumerate(data.ids):
        params[f"id_{i}"] = id_val

    result = await db.execute(
        sql_text(f"SELECT id, pipeline_stage FROM job_applications WHERE user_id = :uid AND id IN ({placeholders})"),
        params,
    )
    rows = result.mappings().all()

    updated = 0
    for row in rows:
        old = row.get("pipeline_stage") or "INTERESTED"
        # Update the job
        update_sql = "UPDATE job_applications SET pipeline_stage = :stage, updated_at = :now"
        update_params = {"id": row["id"], "stage": new_stage, "now": now}
        if data.stage == PipelineStage.APPLIED:
            update_sql += ", applied_at = COALESCE(applied_at, :now)"
        update_sql += " WHERE id = :id"
        await db.execute(sql_text(update_sql), update_params)

        # Create event
        await db.execute(
            sql_text("""INSERT INTO application_events (id, application_id, event_type, old_value, new_value, title, event_date, created_at)
                        VALUES (:id, :app_id, 'status_change', :old, :new, :title, :now, :now)"""),
            {"id": str(uuid.uuid4()), "app_id": row["id"], "old": old, "new": new_stage,
             "title": f"Bulk moved to {new_stage.replace('_', ' ').title()}", "now": now},
        )
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
    from sqlalchemy import text as sql_text
    placeholders = ", ".join([f":id_{i}" for i in range(len(data.ids))])
    params = {"uid": current_user.id}
    for i, id_val in enumerate(data.ids):
        params[f"id_{i}"] = id_val
    result = await db.execute(
        sql_text(f"UPDATE job_applications SET archived = true, pipeline_stage = 'ARCHIVED', updated_at = NOW() WHERE user_id = :uid AND id IN ({placeholders})"),
        params,
    )
    await db.commit()
    return {"archived": result.rowcount}


@router.post("/bulk/delete")
async def bulk_delete(
    data: BulkArchive,  # Reuse same schema
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple tracked jobs at once."""
    from sqlalchemy import text as sql_text
    placeholders = ", ".join([f":id_{i}" for i in range(len(data.ids))])
    params = {"uid": current_user.id}
    for i, id_val in enumerate(data.ids):
        params[f"id_{i}"] = id_val
    # Delete events first (foreign key)
    await db.execute(
        sql_text(f"DELETE FROM application_events WHERE application_id IN ({placeholders})"),
        {f"id_{i}": data.ids[i] for i in range(len(data.ids))},
    )
    result = await db.execute(
        sql_text(f"DELETE FROM job_applications WHERE user_id = :uid AND id IN ({placeholders})"),
        params,
    )
    await db.commit()
    return {"deleted": result.rowcount}


@router.get("/{tracker_id}/resume-intel")
async def get_resume_intel(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get resume and tailoring intelligence for a tracked job."""
    from sqlalchemy import text as sql_text

    result = await db.execute(
        sql_text("SELECT * FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    intel = {
        "resumeUsed": row.get("resume_used"),
        "resumeVersionId": row.get("resume_version_id"),
        "tailoredResume": None,
        "atsScore": None,
        "missingSkills": [],
        "lastTailoredAt": None,
        "tailoringStatus": None,
    }

    # Find tailoring sessions for this job
    try:
        sessions_result = await db.execute(
            sql_text("SELECT * FROM tailoring_sessions WHERE user_id = :uid ORDER BY created_at DESC LIMIT 5"),
            {"uid": current_user.id},
        )
        sessions = sessions_result.mappings().all()

        if sessions:
            latest = sessions[0]
            intel["lastTailoredAt"] = latest["created_at"].isoformat() if latest.get("created_at") else None
            intel["tailoringStatus"] = latest.get("status")

            # Get ATS score
            try:
                ats_result = await db.execute(
                    sql_text("SELECT * FROM ats_scores WHERE session_id = :sid LIMIT 1"),
                    {"sid": latest["id"]},
                )
                ats = ats_result.mappings().first()
                if ats:
                    intel["atsScore"] = {
                        "overall": ats.get("overall_score"),
                        "keywords": ats.get("keyword_score"),
                        "skills": ats.get("skills_score"),
                        "experience": ats.get("experience_score"),
                    }
                    missing = ats.get("missing_keywords")
                    if missing:
                        intel["missingSkills"] = json.loads(missing) if isinstance(missing, str) else (missing or [])
            except Exception:
                pass
    except Exception:
        pass

    # Get resume version if linked
    rv_id = row.get("resume_version_id")
    if rv_id:
        try:
            rv_result = await db.execute(
                sql_text("SELECT id, label, created_at FROM resume_versions WHERE id = :id"),
                {"id": rv_id},
            )
            rv = rv_result.mappings().first()
            if rv:
                intel["tailoredResume"] = {
                    "id": rv["id"],
                    "label": rv.get("label"),
                    "createdAt": rv["created_at"].isoformat() if rv.get("created_at") else None,
                }
        except Exception:
            pass

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
    from sqlalchemy import text as sql_text
    import uuid

    result = await db.execute(
        sql_text("SELECT * FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    old_stage = row.get("pipeline_stage") or row.get("status") or "INTERESTED"
    new_stage = data.stage.value
    now = datetime.now(timezone.utc)

    if old_stage == new_stage:
        return _serialize_row(row)

    # Update stage
    update_sql = "UPDATE job_applications SET pipeline_stage = :stage, updated_at = :now"
    params = {"id": tracker_id, "stage": new_stage, "now": now}
    if data.stage == PipelineStage.APPLIED and not row.get("applied_at"):
        update_sql += ", applied_at = :now"
    update_sql += " WHERE id = :id"
    await db.execute(sql_text(update_sql), params)

    # Auto-create event
    await db.execute(
        sql_text("""INSERT INTO application_events (id, application_id, event_type, old_value, new_value, title, event_date, created_at)
                    VALUES (:id, :app_id, 'status_change', :old, :new, :title, :now, :now)"""),
        {"id": str(uuid.uuid4()), "app_id": tracker_id, "old": old_stage, "new": new_stage,
         "title": f"Moved to {new_stage.replace('_', ' ').title()}", "now": now},
    )
    await db.commit()

    # Return updated row
    result = await db.execute(
        sql_text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": tracker_id},
    )
    return _serialize_row(result.mappings().first())


@router.delete("/{tracker_id}", status_code=204)
async def remove_from_tracker(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a job from the tracker."""
    from sqlalchemy import text as sql_text
    result = await db.execute(
        sql_text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Tracked job not found")
    # Delete events first, then the job
    await db.execute(sql_text("DELETE FROM application_events WHERE application_id = :id"), {"id": tracker_id})
    await db.execute(sql_text("DELETE FROM job_applications WHERE id = :id"), {"id": tracker_id})
    await db.commit()


@router.post("/{tracker_id}/archive")
async def archive_job(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive a tracked job."""
    from sqlalchemy import text as sql_text
    result = await db.execute(
        sql_text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    await db.execute(
        sql_text("UPDATE job_applications SET archived = true, pipeline_stage = 'ARCHIVED', updated_at = NOW() WHERE id = :id"),
        {"id": tracker_id},
    )
    await db.commit()

    result = await db.execute(
        sql_text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": tracker_id},
    )
    return _serialize_row(result.mappings().first())


# ── Events sub-routes ────────────────────────────────────────────────────────

@router.get("/{tracker_id}/events")
async def list_events(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text as sql_text
    # Verify ownership
    result = await db.execute(
        sql_text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    events_result = await db.execute(
        sql_text("SELECT * FROM application_events WHERE application_id = :id ORDER BY event_date DESC"),
        {"id": tracker_id},
    )
    events = events_result.mappings().all()
    return [{
        "id": e.get("id"),
        "eventType": e.get("event_type"),
        "oldValue": e.get("old_value"),
        "newValue": e.get("new_value"),
        "title": e.get("title"),
        "description": e.get("description"),
        "metadata": e.get("metadata_json") or {},
        "eventDate": e["event_date"].isoformat() if e.get("event_date") else None,
        "createdAt": e["created_at"].isoformat() if e.get("created_at") else None,
    } for e in events]


@router.post("/{tracker_id}/events")
async def add_event(
    tracker_id: str,
    data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text as sql_text
    import uuid
    # Verify ownership
    result = await db.execute(
        sql_text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    event_date = datetime.now(timezone.utc)
    if data.event_date:
        try:
            event_date = datetime.fromisoformat(data.event_date)
        except ValueError:
            pass

    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    metadata_str = json.dumps(data.metadata) if data.metadata else None
    await db.execute(
        sql_text("""INSERT INTO application_events (id, application_id, event_type, title, description, metadata_json, event_date, created_at)
                    VALUES (:id, :app_id, :event_type, :title, :description, :metadata, :event_date, :now)"""),
        {"id": event_id, "app_id": tracker_id, "event_type": data.event_type,
         "title": data.title, "description": data.description,
         "metadata": metadata_str, "event_date": event_date, "now": now},
    )
    await db.commit()

    return {
        "id": event_id,
        "eventType": data.event_type,
        "title": data.title,
        "description": data.description,
        "metadata": data.metadata or {},
        "eventDate": event_date.isoformat(),
        "createdAt": now.isoformat(),
    }


@router.post("/{tracker_id}/tailor")
async def tailor_from_tracker(
    tracker_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tailor-ready data from a tracked job."""
    from sqlalchemy import text as sql_text
    result = await db.execute(
        sql_text("SELECT * FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Tracked job not found")

    return {
        "jobDescription": row.get("description") or "",
        "company": row.get("company", ""),
        "role": row.get("role", ""),
        "url": row.get("url"),
        "trackerId": row.get("id"),
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
    from sqlalchemy import text as sql_text
    # Verify ownership
    result = await db.execute(
        sql_text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": tracker_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Tracked job not found")

    del_result = await db.execute(
        sql_text("DELETE FROM application_events WHERE id = :eid AND application_id = :app_id"),
        {"eid": event_id, "app_id": tracker_id},
    )
    if del_result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.commit()
