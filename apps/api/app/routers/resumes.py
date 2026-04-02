from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.resume import Resume, ResumeVersion, ResumeStatus
from app.models.billing import UsageLimit

router = APIRouter(prefix="/resumes", tags=["resumes"])


class ResumeCreate(BaseModel):
    name: str
    content: Optional[dict] = {}
    template_id: Optional[str] = "standard"


class ResumeUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[dict] = None
    status: Optional[ResumeStatus] = None


class VersionCreate(BaseModel):
    label: Optional[str] = None
    session_id: Optional[str] = None


async def check_resume_limit(user_id: str, db: AsyncSession):
    result = await db.execute(
        select(func.count(Resume.id)).where(
            Resume.user_id == user_id,
            Resume.status != ResumeStatus.ARCHIVED
        )
    )
    count = result.scalar_one()
    limit_result = await db.execute(
        select(UsageLimit).where(UsageLimit.user_id == user_id)
    )
    limits = limit_result.scalar_one_or_none()
    max_resumes = limits.resumes_max if limits else 10
    if count >= max_resumes:
        raise HTTPException(
            status_code=403,
            detail=f"Resume limit reached ({max_resumes}). Upgrade to Pro to add more."
        )


@router.get("")
async def list_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.updated_at.desc())
    )
    resumes = result.scalars().all()
    return {"resumes": [
        {
            "id": r.id,
            "name": r.name,
            "status": r.status,
            "templateId": r.template_id,
            "isDefault": r.is_default,
            "createdAt": r.created_at,
            "updatedAt": r.updated_at,
        } for r in resumes
    ]}


@router.post("")
async def create_resume(
    data: ResumeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_resume_limit(current_user.id, db)

    resume = Resume(
        user_id=current_user.id,
        name=data.name,
        content=data.content or {},
        template_id=data.template_id or "standard",
        status=ResumeStatus.DRAFT,
        is_default=False,
    )
    db.add(resume)
    await db.flush()
    await db.commit()
    await db.refresh(resume)

    return {
        "id": resume.id,
        "name": resume.name,
        "status": resume.status,
        "templateId": resume.template_id,
        "isDefault": resume.is_default,
        "createdAt": resume.created_at,
        "updatedAt": resume.updated_at,
    }


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    return {
        "id": resume.id,
        "name": resume.name,
        "content": resume.content,
        "status": resume.status,
        "templateId": resume.template_id,
        "isDefault": resume.is_default,
        "createdAt": resume.created_at,
        "updatedAt": resume.updated_at,
    }


@router.patch("/{resume_id}")
async def update_resume(
    resume_id: str,
    data: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(resume, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(resume)

    return {"id": resume.id, "updatedAt": resume.updated_at}


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    await db.delete(resume)
    await db.commit()


@router.get("/{resume_id}/versions")
async def list_versions(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Resume not found")

    ver_result = await db.execute(
        select(ResumeVersion)
        .where(ResumeVersion.resume_id == resume_id)
        .order_by(ResumeVersion.created_at.desc())
    )
    versions = ver_result.scalars().all()
    return {"versions": [
        {
            "id": v.id,
            "label": v.label,
            "createdAt": v.created_at,
            "sessionId": v.session_id
        }
        for v in versions
    ]}


@router.post("/{resume_id}/versions")
async def create_version(
    resume_id: str,
    data: VersionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    version = ResumeVersion(
        resume_id=resume_id,
        content=resume.content,
        label=data.label,
        session_id=data.session_id,
    )
    db.add(version)
    await db.flush()
    await db.commit()
    await db.refresh(version)

    return {
        "id": version.id,
        "label": version.label,
        "createdAt": version.created_at
    }


@router.post("/{resume_id}/versions/{version_id}/restore")
async def restore_version(
    resume_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res_result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = res_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    ver_result = await db.execute(
        select(ResumeVersion).where(
            ResumeVersion.id == version_id,
            ResumeVersion.resume_id == resume_id
        )
    )
    version = ver_result.scalar_one_or_none()
    if not version:
        raise HTTPException(404, "Version not found")

    resume.content = version.content
    await db.flush()
    await db.commit()
    await db.refresh(resume)

    return {"id": resume.id, "restoredFrom": version_id}
