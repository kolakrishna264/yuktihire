import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
    result = await db.execute(
        select(JobApplication)
        .where(JobApplication.user_id == current_user.id)
        .order_by(JobApplication.created_at.desc())
    )
    applications = result.scalars().all()

    return [_serialize_application(a) for a in applications]


@router.get("/saved-urls")
async def get_saved_urls(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all saved job URLs for the current user (for dedup on job board)."""
    result = await db.execute(
        select(JobApplication.url, JobApplication.external_job_id)
        .where(JobApplication.user_id == current_user.id)
    )
    rows = result.all()
    urls = set()
    ext_ids = set()
    for row in rows:
        if row[0]: urls.add(row[0])
        if row[1]: ext_ids.add(row[1])
    return {"urls": list(urls), "externalJobIds": list(ext_ids)}


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
    existing_query = select(JobApplication).where(
        JobApplication.user_id == current_user.id,
    )
    if data.url:
        existing_query = existing_query.where(JobApplication.url == data.url)
    else:
        existing_query = existing_query.where(
            JobApplication.role == data.title,
            JobApplication.company == data.company,
        )

    result = await db.execute(existing_query)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Job already tracked")

    application = JobApplication(
        user_id=current_user.id,
        role=data.title,
        company=data.company,
        status=data.status,
        url=data.url,
        notes=data.notes,
        location=data.location,
        salary=data.salary,
        source=data.source,
        work_type=data.work_type,
        experience_level=data.experience_level,
        industry=data.industry,
        skills_json=json.dumps(data.skills) if data.skills else None,
        description=data.description,
        external_job_id=data.external_job_id,
        posted_at=data.posted_at,
    )
    db.add(application)
    await db.flush()
    await db.commit()
    await db.refresh(application)

    return _serialize_application(application)


@router.post("/{application_id}/apply")
async def mark_as_applied(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a saved job as applied."""
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == current_user.id,
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = ApplicationStatus.APPLIED
    application.applied_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()
    await db.refresh(application)

    return _serialize_application(application)


@router.patch("/{application_id}")
async def update_application(
    application_id: str,
    data: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == current_user.id,
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    payload = data.model_dump(exclude_none=True)

    if "title" in payload:
        application.role = payload.pop("title")

    for field, value in payload.items():
        setattr(application, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(application)

    return _serialize_application(application)


@router.delete("/{application_id}", status_code=204)
async def delete_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == current_user.id,
        )
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    await db.delete(application)
    await db.commit()


@saved_router.get("/")
async def get_saved(
    current_user: User = Depends(get_current_user),
):
    return []
