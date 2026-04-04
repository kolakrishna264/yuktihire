from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.profile import Profile, WorkExperience, Education, Skill, Project

router = APIRouter(prefix="/profiles", tags=["profiles"])


# ── Schemas ───────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None


class WorkExperienceCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    current: bool = False
    bullets: list[str] = []
    skills_used: list[str] = []
    industry: Optional[str] = None
    sort_order: int = 0


class EducationCreate(BaseModel):
    degree: str
    field: str
    school: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    gpa: Optional[str] = None
    honors: Optional[str] = None
    sort_order: int = 0


class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None
    level: Optional[str] = None
    sort_order: int = 0


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    url: Optional[str] = None
    bullets: list[str] = []
    skills: list[str] = []
    sort_order: int = 0


def calc_completeness(profile: Profile) -> int:
    score = 0
    if getattr(profile, "headline", None): score += 15
    if getattr(profile, "summary", None): score += 15
    if getattr(profile, "phone", None): score += 5
    if getattr(profile, "location", None): score += 5
    if getattr(profile, "linkedin", None): score += 5
    if len(getattr(profile, "work_experiences", []) or []) > 0: score += 25
    if len(getattr(profile, "educations", []) or []) > 0: score += 15
    if len(getattr(profile, "skills", []) or []) >= 5: score += 15
    return min(score, 100)


async def get_or_create_profile(user_id: str, db: AsyncSession) -> Profile:
    result = await db.execute(
        select(Profile)
        .where(Profile.user_id == user_id)
        .options(
            selectinload(Profile.work_experiences),
            selectinload(Profile.educations),
            selectinload(Profile.skills),
            selectinload(Profile.projects),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = Profile(user_id=user_id, completeness=0)
        db.add(profile)
        await db.flush()
    return profile


async def get_profile_or_404(user_id: str, db: AsyncSession) -> Profile:
    result = await db.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Complete your profile first.")
    return profile


def serialize_profile(profile: Profile, user: User) -> dict:
    return {
        "id": profile.id,
        "fullName": getattr(user, "full_name", None) or getattr(profile, "full_name", None),
        "email": getattr(user, "email", None),
        "headline": profile.headline,
        "summary": profile.summary,
        "phone": profile.phone,
        "location": profile.location,
        "linkedinUrl": profile.linkedin,
        "githubUrl": profile.github,
        "portfolioUrl": profile.portfolio,
        "completeness": calc_completeness(profile),
        "experiences": [
            {
                "id": e.id,
                "title": e.title,
                "company": e.company,
                "location": e.location,
                "startDate": str(e.start_date) if e.start_date else None,
                "endDate": str(e.end_date) if e.end_date else None,
                "current": e.current,
                "bullets": e.bullets or [],
                "skillsUsed": e.skills_used or [],
                "industry": e.industry,
                "sortOrder": e.sort_order,
            }
            for e in (getattr(profile, "work_experiences", None) or [])
        ],
        "educations": [
            {
                "id": edu.id,
                "degree": edu.degree,
                "field": edu.field,
                "school": edu.school,
                "startDate": str(edu.start_date) if edu.start_date else None,
                "endDate": str(edu.end_date) if edu.end_date else None,
                "gpa": edu.gpa,
                "honors": edu.honors,
            }
            for edu in (getattr(profile, "educations", None) or [])
        ],
        "skills": [
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "level": s.level,
            }
            for s in (getattr(profile, "skills", None) or [])
        ],
    }


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_profile(current_user.id, db)
    return serialize_profile(profile, current_user)


@router.patch("/me")
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_or_create_profile(current_user.id, db)
    payload = data.model_dump(exclude_none=True)

    # Save full_name to users table (not on profile)
    if "full_name" in payload:
        try:
            current_user.full_name = payload.pop("full_name")
        except Exception:
            payload.pop("full_name", None)

    for field, value in payload.items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    profile.completeness = calc_completeness(profile)
    await db.flush()
    return {"id": profile.id, "completeness": profile.completeness}


# ── Work Experiences ──────────────────────────────────────────────────────

@router.post("/me/experiences")
async def add_experience(
    data: WorkExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    exp = WorkExperience(profile_id=profile.id, **data.model_dump())
    db.add(exp)
    await db.flush()
    return {"id": exp.id, "title": exp.title, "company": exp.company}


@router.patch("/me/experiences/{exp_id}")
async def update_experience(
    exp_id: str,
    data: WorkExperienceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(WorkExperience).where(
            WorkExperience.id == exp_id,
            WorkExperience.profile_id == profile.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experience not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(exp, field, value)
    await db.flush()
    return {"id": exp.id}


@router.delete("/me/experiences/{exp_id}", status_code=204)
async def delete_experience(
    exp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(WorkExperience).where(
            WorkExperience.id == exp_id,
            WorkExperience.profile_id == profile.id,
        )
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experience not found")
    await db.delete(exp)


# ── Educations ────────────────────────────────────────────────────────────

@router.post("/me/educations")
async def add_education(
    data: EducationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    edu = Education(profile_id=profile.id, **data.model_dump())
    db.add(edu)
    await db.flush()
    return {"id": edu.id, "degree": edu.degree, "school": edu.school}


@router.delete("/me/educations/{edu_id}", status_code=204)
async def delete_education(
    edu_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(Education).where(
            Education.id == edu_id,
            Education.profile_id == profile.id,
        )
    )
    edu = result.scalar_one_or_none()
    if not edu:
        raise HTTPException(404, "Education not found")
    await db.delete(edu)


# ── Skills ────────────────────────────────────────────────────────────────

@router.post("/me/skills")
async def add_skill(
    data: SkillCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    skill = Skill(profile_id=profile.id, **data.model_dump())
    db.add(skill)
    await db.flush()
    return {"id": skill.id, "name": skill.name}


@router.delete("/me/skills/{skill_id}", status_code=204)
async def delete_skill(
    skill_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_profile_or_404(current_user.id, db)
    result = await db.execute(
        select(Skill).where(
            Skill.id == skill_id,
            Skill.profile_id == profile.id,
        )
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill not found")
    await db.delete(skill)


# ── Resume Import ─────────────────────────────────────────────────────────

@router.post("/me/import")
async def import_from_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(413, "File too large. Max 5MB.")

    content = await file.read()
    filename = (file.filename or "").lower()

    from resume_parser import parse_resume
    parsed = await parse_resume(content, filename)
    return {"parsed": parsed, "confidence": parsed.get("confidence", 0.7)}
