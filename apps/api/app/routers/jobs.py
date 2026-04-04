import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.jobs import JobApplication, ApplicationStatus

router = APIRouter(prefix="/applications", tags=["applications"])
saved_router = APIRouter(prefix="/saved", tags=["saved"])


class ApplicationCreate(BaseModel):
    title: str
    company: str
    status: Optional[ApplicationStatus] = ApplicationStatus.SAVED
    url: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None
    source: Optional[str] = None
    work_type: Optional[str] = None
    experience_level: Optional[str] = None
    industry: Optional[str] = None
    skills: Optional[list[str]] = None
    description: Optional[str] = None
    external_job_id: Optional[str] = None
    posted_at: Optional[str] = None


class ApplicationUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None
    source: Optional[str] = None
    resume_used: Optional[str] = None


def _serialize_application(a: JobApplication) -> dict:
    return {
        "id": a.id,
        "title": a.role,
        "company": a.company,
        "status": a.status,
        "url": a.url,
        "location": a.location,
        "salary": a.salary,
        "notes": a.notes,
        "source": a.source,
        "resumeUsed": a.resume_used,
        "appliedAt": a.applied_at.isoformat() if a.applied_at else None,
        "workType": a.work_type,
        "experienceLevel": a.experience_level,
        "industry": a.industry,
        "skills": json.loads(a.skills_json) if a.skills_json else [],
        "description": a.description,
        "externalJobId": a.external_job_id,
        "postedAt": a.posted_at,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
        "updatedAt": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/")
async def get_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text
    try:
        result = await db.execute(
            text("SELECT * FROM job_applications WHERE user_id = :uid ORDER BY created_at DESC"),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
        return [
            {
                "id": r.get("id"),
                "title": r.get("role", ""),
                "company": r.get("company", ""),
                "status": r.get("status") or r.get("pipeline_stage") or "SAVED",
                "url": r.get("url"),
                "location": r.get("location"),
                "salary": r.get("salary"),
                "notes": r.get("notes"),
                "source": r.get("source"),
                "resumeUsed": r.get("resume_used"),
                "appliedAt": r["applied_at"].isoformat() if r.get("applied_at") else None,
                "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
                "updatedAt": r["updated_at"].isoformat() if r.get("updated_at") else None,
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[Applications] GET / error: {e}")
        return []


@router.get("/saved-urls")
async def get_saved_urls(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all saved job URLs for the current user (for dedup on job board)."""
    from sqlalchemy import text
    try:
        result = await db.execute(
            text("SELECT url FROM job_applications WHERE user_id = :uid AND url IS NOT NULL"),
            {"uid": current_user.id},
        )
        urls = [row[0] for row in result.all() if row[0]]
        return {"urls": urls, "externalJobIds": []}
    except Exception as e:
        print(f"[Applications] saved-urls error: {e}")
        return {"urls": [], "externalJobIds": []}


@router.post("/")
async def create_application(
    data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate title and company length
    if len(data.title.strip()) < 2:
        raise HTTPException(status_code=400, detail="Title too short")
    if len(data.company.strip()) < 2:
        raise HTTPException(status_code=400, detail="Company name too short")

    # Strip whitespace
    data.title = data.title.strip()
    data.company = data.company.strip()

    # Check for duplicate: same user + (same URL or same company+role)
    if data.url:
        dup_result = await db.execute(
            text("SELECT id FROM job_applications WHERE user_id = :uid AND url = :url LIMIT 1"),
            {"uid": current_user.id, "url": data.url},
        )
    else:
        dup_result = await db.execute(
            text("SELECT id FROM job_applications WHERE user_id = :uid AND role = :role AND company = :company LIMIT 1"),
            {"uid": current_user.id, "role": data.title, "company": data.company},
        )
    if dup_result.first():
        raise HTTPException(status_code=409, detail="Job already tracked")

    import uuid
    app_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    status_val = (data.status or ApplicationStatus.SAVED).value
    skills_str = json.dumps(data.skills) if data.skills else None

    await db.execute(
        text("""
            INSERT INTO job_applications (id, user_id, role, company, status, url, notes, location, salary,
                source, work_type, experience_level, industry, skills_json, description,
                external_job_id, posted_at, created_at, updated_at)
            VALUES (:id, :uid, :role, :company, :status, :url, :notes, :location, :salary,
                :source, :work_type, :experience_level, :industry, :skills_json, :description,
                :external_job_id, :posted_at, :now, :now)
        """),
        {
            "id": app_id, "uid": current_user.id, "role": data.title, "company": data.company,
            "status": status_val, "url": data.url, "notes": data.notes, "location": data.location,
            "salary": data.salary, "source": data.source, "work_type": data.work_type,
            "experience_level": data.experience_level, "industry": data.industry,
            "skills_json": skills_str, "description": data.description,
            "external_job_id": data.external_job_id, "posted_at": data.posted_at, "now": now,
        },
    )
    await db.commit()

    # Return the created row
    result = await db.execute(
        text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": app_id},
    )
    row = result.mappings().first()
    return {
        "id": row["id"],
        "title": row.get("role", ""),
        "company": row.get("company", ""),
        "status": row.get("status") or row.get("pipeline_stage") or "SAVED",
        "url": row.get("url"),
        "location": row.get("location"),
        "salary": row.get("salary"),
        "notes": row.get("notes"),
        "source": row.get("source"),
        "resumeUsed": row.get("resume_used"),
        "appliedAt": row["applied_at"].isoformat() if row.get("applied_at") else None,
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


@router.post("/{application_id}/apply")
async def mark_as_applied(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a saved job as applied."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": application_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Application not found")

    await db.execute(
        text("UPDATE job_applications SET status = 'APPLIED', applied_at = :now, updated_at = :now WHERE id = :id"),
        {"id": application_id, "now": now},
    )
    await db.commit()

    result = await db.execute(
        text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": application_id},
    )
    row = result.mappings().first()
    return {
        "id": row["id"],
        "title": row.get("role", ""),
        "company": row.get("company", ""),
        "status": row.get("status") or "APPLIED",
        "url": row.get("url"),
        "location": row.get("location"),
        "salary": row.get("salary"),
        "notes": row.get("notes"),
        "source": row.get("source"),
        "resumeUsed": row.get("resume_used"),
        "appliedAt": row["applied_at"].isoformat() if row.get("applied_at") else None,
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


@router.patch("/{application_id}")
async def update_application(
    application_id: str,
    data: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": application_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Application not found")

    payload = data.model_dump(exclude_none=True)

    # Map field names to DB columns
    field_map = {"title": "role", "status": "status", "company": "company",
                 "url": "url", "notes": "notes", "location": "location",
                 "salary": "salary", "source": "source", "resume_used": "resume_used"}

    set_clauses = []
    params = {"id": application_id}
    for key, value in payload.items():
        col = field_map.get(key, key)
        param_name = f"p_{key}"
        set_clauses.append(f"{col} = :{param_name}")
        params[param_name] = value.value if hasattr(value, "value") else value

    if not set_clauses:
        # No changes, return current
        pass
    else:
        set_clauses.append("updated_at = NOW()")
        sql = f"UPDATE job_applications SET {', '.join(set_clauses)} WHERE id = :id"
        await db.execute(text(sql), params)
        await db.commit()

    result = await db.execute(
        text("SELECT * FROM job_applications WHERE id = :id"),
        {"id": application_id},
    )
    row = result.mappings().first()
    return {
        "id": row["id"],
        "title": row.get("role", ""),
        "company": row.get("company", ""),
        "status": row.get("status") or row.get("pipeline_stage") or "SAVED",
        "url": row.get("url"),
        "location": row.get("location"),
        "salary": row.get("salary"),
        "notes": row.get("notes"),
        "source": row.get("source"),
        "resumeUsed": row.get("resume_used"),
        "appliedAt": row["applied_at"].isoformat() if row.get("applied_at") else None,
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


@router.delete("/{application_id}", status_code=204)
async def delete_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
        {"id": application_id, "uid": current_user.id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Application not found")

    # Delete events first, then the application
    await db.execute(text("DELETE FROM application_events WHERE application_id = :id"), {"id": application_id})
    await db.execute(text("DELETE FROM job_applications WHERE id = :id"), {"id": application_id})
    await db.commit()


@saved_router.get("/")
async def get_saved(
    current_user: User = Depends(get_current_user),
):
    return []
