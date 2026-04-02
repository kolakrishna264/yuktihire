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


class ApplicationUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    url: Optional[str] = None
    notes: Optional[str] = None


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

    return [
        {
            "id": a.id,
            "title": a.role,
            "company": a.company,
            "status": a.status,
            "url": a.url,
            "notes": a.notes,
            "createdAt": a.created_at,
            "updatedAt": a.updated_at,
        }
        for a in applications
    ]


@router.post("/")
async def create_application(
    data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    application = JobApplication(
        user_id=current_user.id,
        role=data.title,
        company=data.company,
        status=data.status,
        url=data.url,
        notes=data.notes,
    )
    db.add(application)
    await db.flush()
    await db.commit()
    await db.refresh(application)

    return {
        "id": application.id,
        "title": application.role,
        "company": application.company,
        "status": application.status,
        "url": application.url,
        "notes": application.notes,
        "createdAt": application.created_at,
        "updatedAt": application.updated_at,
    }


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

    return {
        "id": application.id,
        "title": application.role,
        "company": application.company,
        "status": application.status,
        "url": application.url,
        "notes": application.notes,
        "createdAt": application.created_at,
        "updatedAt": application.updated_at,
    }


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
