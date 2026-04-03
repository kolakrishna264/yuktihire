"""Discover Router — Job search and discovery using raw SQL for DB compatibility."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from app.core.database import get_db, AsyncSessionLocal
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.discover import JobSource, JobSourceLink, JobSkill

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


def _serialize_row(r, skills=None, sources=None, match=None) -> dict:
    """Serialize a raw SQL row mapping safely."""
    posted = r.get("posted_at")
    created = r.get("created_at")
    data = {
        "id": r.get("id"),
        "title": r.get("title", ""),
        "company": r.get("company", ""),
        "location": r.get("location"),
        "url": r.get("url"),
        "descriptionText": (r.get("description_text") or "")[:500],
        "salaryMin": r.get("salary_min"),
        "salaryMax": r.get("salary_max"),
        "salaryRaw": r.get("salary_raw"),
        "workType": r.get("work_type"),
        "employmentType": r.get("employment_type"),
        "experienceLevel": r.get("experience_level"),
        "industry": r.get("industry"),
        "country": r.get("country"),
        "postedAt": posted.isoformat() if posted else None,
        "isActive": r.get("is_active", True),
        "companyLogoUrl": r.get("company_logo_url"),
        "skills": [{"name": s.skill_name, "canonical": s.skill_canonical, "isRequired": s.is_required} for s in (skills or [])],
        "sources": sources or [],
        "createdAt": created.isoformat() if created else None,
    }
    if match:
        data["matchScore"] = match.score
        data["matchBadges"] = match.badges
        data["matchReasons"] = match.reasons[:2]
    return data


@router.get("")
async def search_jobs(
    request: Request,
    q: Optional[str] = Query(None, description="Search query"),
    work_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    salary_min: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search and filter jobs using raw SQL for maximum DB compatibility."""
    try:
        # Build WHERE clauses dynamically
        conditions = ["is_active = true"]
        params = {}

        if q:
            conditions.append("(lower(title) LIKE :q OR lower(company) LIKE :q OR lower(COALESCE(location,'')) LIKE :q)")
            params["q"] = f"%{q.lower()}%"

        if work_type and work_type != "All":
            conditions.append("lower(COALESCE(work_type,'')) = :wt")
            params["wt"] = work_type.lower()

        if location:
            conditions.append("lower(COALESCE(location,'')) LIKE :loc")
            params["loc"] = f"%{location.lower()}%"

        if experience_level and experience_level != "All":
            conditions.append("experience_level = :exp")
            params["exp"] = experience_level

        if industry and industry != "All":
            conditions.append("lower(COALESCE(industry,'')) LIKE :ind")
            params["ind"] = f"%{industry.lower()}%"

        where_clause = " AND ".join(conditions)

        # Count
        count_sql = f"SELECT COUNT(*) FROM jobs WHERE {where_clause}"
        count_result = await db.execute(text(count_sql), params)
        total = count_result.scalar() or 0

        # Sort
        order = "posted_at DESC NULLS LAST, created_at DESC"
        if sort == "oldest":
            order = "posted_at ASC NULLS LAST"
        elif sort == "salary":
            order = "salary_max DESC NULLS LAST, posted_at DESC NULLS LAST"
        elif sort == "company":
            order = "company ASC"

        # Paginate
        offset = (page - 1) * per_page
        params["limit"] = per_page
        params["offset"] = offset

        sql = f"SELECT * FROM jobs WHERE {where_clause} ORDER BY {order} LIMIT :limit OFFSET :offset"
        result = await db.execute(text(sql), params)
        rows = result.mappings().all()

        # Batch-load skills
        job_ids = [r["id"] for r in rows]
        skills_by_job = {}
        if job_ids:
            skills_result = await db.execute(
                select(JobSkill).where(JobSkill.job_id.in_(job_ids))
            )
            for s in skills_result.scalars().all():
                skills_by_job.setdefault(s.job_id, []).append(s)

        # Batch-load sources
        sources_by_job = {}
        if job_ids:
            src_result = await db.execute(
                select(JobSourceLink, JobSource)
                .join(JobSource)
                .where(JobSourceLink.job_id.in_(job_ids))
            )
            for link, src in src_result.all():
                sources_by_job.setdefault(link.job_id, []).append({
                    "slug": src.slug,
                    "name": src.name,
                    "externalId": link.external_id,
                    "sourceUrl": link.source_url,
                })

        # Serialize
        jobs_data = [
            _serialize_row(r, skills_by_job.get(r["id"], []), sources_by_job.get(r["id"], []))
            for r in rows
        ]

        # Best match re-sort
        if sort == "best_match":
            current_user = await get_optional_user(request)
            if current_user:
                try:
                    from app.services.recommendations import score_job_dict
                    from app.models.v2 import UserPreference
                    prefs_result = await db.execute(
                        select(UserPreference).where(UserPreference.user_id == current_user.id)
                    )
                    prefs = prefs_result.scalar_one_or_none()
                    if prefs:
                        scored = []
                        for jd in jobs_data:
                            match = score_job_dict(jd, prefs)
                            jd["matchScore"] = match["score"]
                            jd["matchBadges"] = match["badges"]
                            jd["matchReasons"] = match["reasons"][:2]
                            scored.append(jd)
                        scored.sort(key=lambda x: x.get("matchScore", 0), reverse=True)
                        jobs_data = scored
                except Exception as e:
                    print(f"[Discover] best_match scoring error: {e}")

        return {
            "jobs": jobs_data,
            "total": total,
            "page": page,
            "perPage": per_page,
            "totalPages": (total + per_page - 1) // per_page if total > 0 else 0,
        }
    except Exception as e:
        print(f"[Discover] search_jobs error: {e}")
        return {"jobs": [], "total": 0, "page": 1, "perPage": per_page, "totalPages": 0}


@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db)):
    """List all registered job sources."""
    try:
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
    except Exception:
        return []


@router.post("/refresh")
async def refresh_sources(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger an immediate source sync."""
    from app.services.sources.scheduler import run_sync_cycle
    background_tasks.add_task(run_sync_cycle)
    return {"status": "refresh_started"}


@router.get("/recommendations")
async def get_job_recommendations(
    limit: int = Query(20, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get job recommendations based on user preferences."""
    try:
        from app.services.recommendations import get_recommendations
        results = await get_recommendations(db, current_user.id, limit)
        return {"recommendations": results}
    except Exception as e:
        print(f"[Discover] recommendations error: {e}")
        return {"recommendations": []}


@router.get("/{job_id}")
async def get_job_detail(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full job details."""
    try:
        result = await db.execute(text("SELECT * FROM jobs WHERE id = :id"), {"id": job_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")

        # Skills
        skills = []
        try:
            skills_result = await db.execute(select(JobSkill).where(JobSkill.job_id == job_id))
            skills = skills_result.scalars().all()
        except Exception:
            pass

        # Sources
        sources = []
        try:
            src_result = await db.execute(
                select(JobSourceLink, JobSource).join(JobSource).where(JobSourceLink.job_id == job_id)
            )
            sources = [{"slug": src.slug, "name": src.name, "externalId": link.external_id, "sourceUrl": link.source_url} for link, src in src_result.all()]
        except Exception:
            pass

        data = _serialize_row(row, skills, sources)
        data["descriptionText"] = row.get("description_text")  # Full description
        return data
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Discover] job_detail error: {e}")
        raise HTTPException(status_code=404, detail="Job not found")
