"""Discover Router — Job search and discovery."""
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from app.core.database import get_db, AsyncSessionLocal
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.discover import Job, JobSource, JobSourceLink, JobSkill

router = APIRouter(prefix="/discover", tags=["discover"])


async def get_optional_user(request: Request):
    """Try to resolve user from auth header. Returns None if unauthenticated."""
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        from fastapi.security import HTTPAuthorizationCredentials
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=auth.split(" ", 1)[1])
        async with AsyncSessionLocal() as session:
            return await get_current_user(creds, session)
    except Exception:
        return None


def _serialize_job(job: Job, skills: list[JobSkill] = None, sources: list[dict] = None, match=None) -> dict:
    data = {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "url": job.url,
        "descriptionText": (job.description_text or "")[:500],
        "salaryMin": job.salary_min,
        "salaryMax": job.salary_max,
        "salaryRaw": job.salary_raw,
        "workType": job.work_type,
        "employmentType": job.employment_type,
        "experienceLevel": job.experience_level,
        "industry": job.industry,
        "country": job.country,
        "postedAt": job.posted_at.isoformat() if job.posted_at else None,
        "isActive": job.is_active,
        "companyLogoUrl": job.company_logo_url,
        "skills": [{"name": s.skill_name, "canonical": s.skill_canonical, "isRequired": s.is_required} for s in (skills or [])],
        "sources": sources or [],
        "createdAt": job.created_at.isoformat() if job.created_at else None,
    }
    if match:
        data["matchScore"] = match.score
        data["matchBadges"] = match.badges
        data["matchReasons"] = match.reasons[:2]
    return data


@router.get("")
async def search_jobs(
    request: Request,
    q: Optional[str] = Query(None, description="Search query (title, company)"),
    work_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    salary_min: Optional[int] = Query(None),
    source: Optional[str] = Query(None, description="Source slug filter"),
    country: Optional[str] = Query(None, description="US, REMOTE_US, REMOTE, NON_US, or us_eligible"),
    sort: str = Query("newest", description="newest, oldest, salary, company, best_match"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search and filter jobs from the normalized jobs table."""
    query = select(Job).where(Job.is_active == True)

    # Text search
    if q:
        pattern = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(Job.title).like(pattern),
                func.lower(Job.company).like(pattern),
                func.lower(Job.location).like(pattern),
            )
        )

    # Filters
    if work_type and work_type != "All":
        query = query.where(func.lower(Job.work_type) == work_type.lower())
    if location:
        query = query.where(func.lower(Job.location).like(f"%{location.lower()}%"))
    if experience_level and experience_level != "All":
        query = query.where(Job.experience_level == experience_level)
    if industry and industry != "All":
        query = query.where(func.lower(Job.industry).like(f"%{industry.lower()}%"))
    if salary_min:
        query = query.where(or_(Job.salary_min >= salary_min, Job.salary_max >= salary_min))
    if source:
        # Join to source_links to filter by source
        query = query.join(JobSourceLink).join(JobSource).where(JobSource.slug == source)
    # Country filter — only apply if column exists in DB
    _apply_country = False
    if country:
        try:
            from sqlalchemy import text as _text
            check = await db.execute(_text("SELECT column_name FROM information_schema.columns WHERE table_name='jobs' AND column_name='country'"))
            _apply_country = check.scalar() is not None
        except Exception:
            pass
    if _apply_country and country:
        if country == "us_eligible":
            query = query.where(or_(Job.country.in_(["US", "REMOTE_US", "REMOTE", "UNKNOWN"]), Job.country == None))
        else:
            query = query.where(Job.country == country)

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sort (best_match handled after fetch)
    if sort == "oldest":
        query = query.order_by(Job.posted_at.asc().nullslast())
    elif sort == "salary":
        query = query.order_by(Job.salary_max.desc().nullslast(), Job.posted_at.desc().nullslast())
    elif sort == "company":
        query = query.order_by(Job.company_normalized.asc())
    else:  # newest (default) or best_match
        query = query.order_by(Job.posted_at.desc().nullslast(), Job.created_at.desc())

    # Paginate
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    jobs = result.scalars().all()

    # Batch-load skills for all jobs
    job_ids = [j.id for j in jobs]
    skills_result = await db.execute(
        select(JobSkill).where(JobSkill.job_id.in_(job_ids))
    ) if job_ids else None
    all_skills = skills_result.scalars().all() if skills_result else []
    skills_by_job = {}
    for s in all_skills:
        skills_by_job.setdefault(s.job_id, []).append(s)

    # Batch-load source links
    source_links_result = await db.execute(
        select(JobSourceLink, JobSource)
        .join(JobSource)
        .where(JobSourceLink.job_id.in_(job_ids))
    ) if job_ids else None
    source_links = source_links_result.all() if source_links_result else []
    sources_by_job = {}
    for link, src in source_links:
        sources_by_job.setdefault(link.job_id, []).append({
            "slug": src.slug,
            "name": src.name,
            "externalId": link.external_id,
            "sourceUrl": link.source_url,
        })

    # Best match: score + re-sort when user is authenticated and has preferences
    if sort == "best_match":
        current_user = await get_optional_user(request)
        if current_user:
            from app.services.recommendations import score_job
            from app.models.v2 import UserPreference

            prefs_result = await db.execute(
                select(UserPreference).where(UserPreference.user_id == current_user.id)
            )
            prefs = prefs_result.scalar_one_or_none()

            if prefs:
                scored_jobs = []
                for j in jobs:
                    match_result = await score_job(j, skills_by_job.get(j.id, []), prefs)
                    scored_jobs.append((j, match_result))
                scored_jobs.sort(key=lambda x: x[1].score, reverse=True)

                return {
                    "jobs": [
                        _serialize_job(j, skills_by_job.get(j.id, []), sources_by_job.get(j.id, []), match=m)
                        for j, m in scored_jobs
                    ],
                    "total": total,
                    "page": page,
                    "perPage": per_page,
                    "totalPages": (total + per_page - 1) // per_page if total > 0 else 0,
                }

    return {
        "jobs": [_serialize_job(j, skills_by_job.get(j.id, []), sources_by_job.get(j.id, [])) for j in jobs],
        "total": total,
        "page": page,
        "perPage": per_page,
        "totalPages": (total + per_page - 1) // per_page if total > 0 else 0,
    }


@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db)):
    """List all registered job sources."""
    result = await db.execute(select(JobSource).order_by(JobSource.name))
    sources = result.scalars().all()
    return [
        {
            "id": s.id,
            "slug": s.slug,
            "name": s.name,
            "isActive": s.is_active,
            "lastSyncAt": s.last_sync_at.isoformat() if s.last_sync_at else None,
        }
        for s in sources
    ]


@router.post("/refresh")
async def refresh_sources(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger an immediate source sync (Remotive + Arbeitnow + RemoteOK)."""
    from app.services.sources.scheduler import run_sync_cycle
    background_tasks.add_task(run_sync_cycle)
    return {"status": "refresh_started"}


@router.get("/recommendations")
async def get_job_recommendations(
    limit: int = Query(20, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get AI-ranked job recommendations based on user preferences."""
    from app.services.recommendations import get_recommendations
    results = await get_recommendations(db, current_user.id, limit)
    return {"recommendations": results}


@router.get("/{job_id}")
async def get_job_detail(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full job details including skills and source links."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Load skills
    skills_result = await db.execute(select(JobSkill).where(JobSkill.job_id == job_id))
    skills = skills_result.scalars().all()

    # Load source links
    source_result = await db.execute(
        select(JobSourceLink, JobSource).join(JobSource).where(JobSourceLink.job_id == job_id)
    )
    source_links = source_result.all()
    sources = [{"slug": src.slug, "name": src.name, "externalId": link.external_id, "sourceUrl": link.source_url} for link, src in source_links]

    data = _serialize_job(job, skills, sources)
    data["descriptionText"] = job.description_text  # Full description for detail view
    return data
