"""
Job Feed Router — Personalized job feed for users.

Architecture:
- curated_jobs table: admin/system-added jobs (manual + imported)
- jobs table: discover-sourced jobs (external APIs)
- user_preferences table: user's preferred titles, locations, work types
- Feed endpoint: merges curated + discovered, matches to user prefs, filters by freshness
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
import json
import uuid

router = APIRouter(prefix="/feed", tags=["feed"])


# ══════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════

class AddCuratedJobRequest(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    work_type: Optional[str] = None  # remote, hybrid, onsite
    employment_type: Optional[str] = None  # full-time, part-time, contract
    experience_level: Optional[str] = None  # entry, mid, senior, lead
    salary_range: Optional[str] = None
    skills: Optional[str] = None  # comma-separated
    tags: Optional[str] = None  # comma-separated
    job_family: Optional[str] = None  # engineering, data-science, product, design, etc.
    seniority: Optional[str] = None  # junior, mid, senior, staff, principal


class UpdatePreferencesRequest(BaseModel):
    preferred_titles: Optional[list[str]] = None
    preferred_locations: Optional[list[str]] = None
    preferred_work_types: Optional[list[str]] = None
    preferred_industries: Optional[list[str]] = None
    min_salary: Optional[int] = None
    experience_level: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════
# USER PREFERENCES
# ══════════════════════════════════════════════════════════════════════════

@router.get("/preferences")
async def get_feed_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's job feed preferences."""
    result = await db.execute(
        text("SELECT * FROM user_preferences WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    row = result.mappings().first()
    if not row:
        return {"preferences": None, "message": "Set your preferences to get personalized job feed"}

    def parse_json(val):
        if not val: return []
        try: return json.loads(val)
        except: return []

    return {
        "preferences": {
            "preferredTitles": parse_json(row.get("preferred_titles")),
            "preferredLocations": parse_json(row.get("preferred_locations")),
            "preferredWorkTypes": parse_json(row.get("preferred_work_types")),
            "preferredIndustries": parse_json(row.get("preferred_industries")),
            "minSalary": row.get("min_salary"),
            "experienceLevel": row.get("experience_level"),
        }
    }


@router.post("/preferences")
async def update_feed_preferences(
    data: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's job feed preferences."""
    # Upsert
    existing = await db.execute(
        text("SELECT id FROM user_preferences WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    row = existing.mappings().first()

    titles_json = json.dumps(data.preferred_titles) if data.preferred_titles else None
    locations_json = json.dumps(data.preferred_locations) if data.preferred_locations else None
    work_types_json = json.dumps(data.preferred_work_types) if data.preferred_work_types else None
    industries_json = json.dumps(data.preferred_industries) if data.preferred_industries else None

    if row:
        await db.execute(text("""
            UPDATE user_preferences SET
                preferred_titles = COALESCE(:titles, preferred_titles),
                preferred_locations = COALESCE(:locations, preferred_locations),
                preferred_work_types = COALESCE(:work_types, preferred_work_types),
                preferred_industries = COALESCE(:industries, preferred_industries),
                min_salary = COALESCE(:min_salary, min_salary),
                experience_level = COALESCE(:exp_level, experience_level),
                updated_at = NOW()
            WHERE user_id = :uid
        """), {
            "uid": current_user.id,
            "titles": titles_json,
            "locations": locations_json,
            "work_types": work_types_json,
            "industries": industries_json,
            "min_salary": data.min_salary,
            "exp_level": data.experience_level,
        })
    else:
        await db.execute(text("""
            INSERT INTO user_preferences (id, user_id, preferred_titles, preferred_locations,
                preferred_work_types, preferred_industries, min_salary, experience_level)
            VALUES (:id, :uid, :titles, :locations, :work_types, :industries, :min_salary, :exp_level)
        """), {
            "id": str(uuid.uuid4()),
            "uid": current_user.id,
            "titles": titles_json,
            "locations": locations_json,
            "work_types": work_types_json,
            "industries": industries_json,
            "min_salary": data.min_salary,
            "exp_level": data.experience_level,
        })

    await db.commit()
    return {"status": "updated"}


# ══════════════════════════════════════════════════════════════════════════
# CURATED JOBS (Admin)
# ══════════════════════════════════════════════════════════════════════════

@router.post("/curated")
async def add_curated_job(
    data: AddCuratedJobRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a curated job to the feed. Admin or any authenticated user for now."""
    job_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO curated_jobs (id, title, company, location, url, description,
            work_type, employment_type, experience_level, salary_range,
            skills, tags, job_family, seniority, is_active, source_type, created_by)
        VALUES (:id, :title, :company, :location, :url, :description,
            :work_type, :employment_type, :exp_level, :salary_range,
            :skills, :tags, :job_family, :seniority, TRUE, 'manual', :created_by)
    """), {
        "id": job_id,
        "title": data.title,
        "company": data.company,
        "location": data.location,
        "url": data.url,
        "description": data.description,
        "work_type": data.work_type,
        "employment_type": data.employment_type,
        "exp_level": data.experience_level,
        "salary_range": data.salary_range,
        "skills": data.skills,
        "tags": data.tags,
        "job_family": data.job_family,
        "seniority": data.seniority,
        "created_by": current_user.id,
    })
    await db.commit()
    return {"status": "created", "jobId": job_id}


@router.get("/curated")
async def list_curated_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all active curated jobs (for admin review)."""
    result = await db.execute(text("""
        SELECT * FROM curated_jobs WHERE is_active = TRUE
        ORDER BY created_at DESC LIMIT 100
    """))
    rows = result.mappings().all()
    return {"jobs": [dict(r) for r in rows], "total": len(rows)}


# ══════════════════════════════════════════════════════════════════════════
# PERSONALIZED FEED
# ══════════════════════════════════════════════════════════════════════════

def _build_title_match_clause(titles: list[str], table_alias: str = "j") -> tuple[str, dict]:
    """Build SQL WHERE clause for fuzzy title matching."""
    if not titles:
        return "TRUE", {}
    conditions = []
    params = {}
    for i, title in enumerate(titles):
        key = f"title_{i}"
        # Match: title contains search term OR search term contains title
        conditions.append(f"(LOWER({table_alias}.title) LIKE :{key})")
        params[key] = f"%{title.lower()}%"
    return f"({' OR '.join(conditions)})", params


@router.get("")
async def get_personalized_feed(
    q: Optional[str] = Query(None, description="Search query"),
    work_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get personalized job feed for the user.

    Merges:
    1. Curated jobs (manual/imported, last 7 days)
    2. Discovered jobs (external APIs, last 7 days)

    Matches by:
    - User's preferred titles (fuzzy)
    - User's preferred locations
    - User's preferred work types
    - Search query (if provided)

    Always filtered to last 7 days.
    """
    # Load user preferences
    pref_result = await db.execute(
        text("SELECT * FROM user_preferences WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    pref_row = pref_result.mappings().first()

    preferred_titles = []
    preferred_locations = []
    preferred_work_types = []
    if pref_row:
        try: preferred_titles = json.loads(pref_row.get("preferred_titles") or "[]")
        except: pass
        try: preferred_locations = json.loads(pref_row.get("preferred_locations") or "[]")
        except: pass
        try: preferred_work_types = json.loads(pref_row.get("preferred_work_types") or "[]")
        except: pass

    # Freshness: last 30 days (7 was too strict for a new product)
    cutoff = datetime.utcnow() - timedelta(days=30)
    cutoff_str = cutoff.isoformat()

    # ── Build search conditions ──
    where_parts = [f"created_at >= :cutoff"]
    params: dict = {"cutoff": cutoff_str, "limit": per_page, "offset": (page - 1) * per_page}

    # Search query
    if q:
        where_parts.append("(LOWER(title) LIKE :q OR LOWER(company) LIKE :q OR LOWER(COALESCE(description,'')) LIKE :q)")
        params["q"] = f"%{q.lower()}%"

    # Work type filter
    if work_type:
        where_parts.append("LOWER(COALESCE(work_type,'')) = :wt")
        params["wt"] = work_type.lower()

    # Title matching from preferences — use OR, not AND with other filters
    title_clause = "TRUE"
    if preferred_titles or q:
        all_titles = preferred_titles + ([q] if q else [])
        tc, tp = _build_title_match_clause(all_titles)
        title_clause = tc
        params.update(tp)
        where_parts.append(title_clause)

    where_sql = " AND ".join(where_parts) if where_parts else "TRUE"
    # Also build a relaxed version without title filter (for fallback)
    where_sql_no_title = " AND ".join([p for p in where_parts if p != title_clause]) or "TRUE"

    def _format_job(row, source_type=""):
        return {
            "id": row.get("id", ""),
            "title": row.get("title") or row.get("role", ""),
            "company": row.get("company", ""),
            "location": row.get("location") or "",
            "url": row.get("url") or "",
            "description": (row.get("description") or row.get("description_text") or "")[:500],
            "fullDescription": row.get("description") or row.get("description_text") or "",
            "workType": row.get("work_type") or "",
            "employmentType": row.get("employment_type") or "",
            "experienceLevel": row.get("experience_level") or "",
            "salaryRange": row.get("salary_range") or row.get("salary") or "",
            "skills": row.get("skills") or "",
            "tags": row.get("tags") or "",
            "postedAt": str(row.get("created_at") or row.get("posted_at") or ""),
            "sourceType": source_type,
        }

    try:
        all_jobs = []

        # ── Query curated_jobs ──
        try:
            curated_result = await db.execute(text(f"""
                SELECT * FROM curated_jobs
                WHERE is_active = TRUE AND created_at >= :cutoff
                ORDER BY created_at DESC LIMIT 50
            """), {"cutoff": cutoff_str})
            for row in curated_result.mappings().all():
                all_jobs.append(_format_job(dict(row), "curated"))
        except Exception as e:
            print(f"[Feed] curated_jobs query error: {e}")

        # ── Query discovered jobs ──
        try:
            discover_result = await db.execute(text(f"""
                SELECT * FROM jobs
                WHERE is_active = TRUE AND (posted_at >= :cutoff OR created_at >= :cutoff)
                ORDER BY COALESCE(posted_at, created_at) DESC LIMIT 50
            """), {"cutoff": cutoff_str})
            for row in discover_result.mappings().all():
                all_jobs.append(_format_job(dict(row), "discovered"))
        except Exception as e:
            print(f"[Feed] jobs query error: {e}")

        # ── Query user's saved jobs as fallback ──
        try:
            saved_result = await db.execute(text(f"""
                SELECT id, role as title, company, location, url, description, salary,
                       work_type, experience_level, created_at
                FROM job_applications
                WHERE user_id = :uid AND created_at >= :cutoff
                ORDER BY created_at DESC LIMIT 20
            """), {"uid": current_user.id, "cutoff": cutoff_str})
            for row in saved_result.mappings().all():
                all_jobs.append(_format_job(dict(row), "saved"))
        except Exception as e:
            print(f"[Feed] saved jobs query error: {e}")

        # ── Filter by preferences (in Python, not SQL — more reliable) ──
        if preferred_titles and not q:
            title_lower = [t.lower() for t in preferred_titles]
            matched = [j for j in all_jobs if any(t in j["title"].lower() for t in title_lower)]
            # If title filter returns results, use them. Otherwise show all.
            if matched:
                all_jobs = matched

        # Filter by search query
        if q:
            ql = q.lower()
            all_jobs = [j for j in all_jobs if ql in j["title"].lower() or ql in j["company"].lower() or ql in j["description"].lower()]

        # Filter by work type
        if work_type:
            wtl = work_type.lower()
            filtered = [j for j in all_jobs if wtl in (j["workType"] or "").lower()]
            if filtered:
                all_jobs = filtered

        # Deduplicate by URL
        seen_urls = set()
        deduped = []
        for j in all_jobs:
            url_key = (j["url"] or j["title"] + j["company"]).lower()
            if url_key not in seen_urls:
                seen_urls.add(url_key)
                deduped.append(j)
        all_jobs = deduped

        # Paginate
        total = len(all_jobs)
        start = (page - 1) * per_page
        page_jobs = all_jobs[start:start + per_page]

        return {
            "jobs": page_jobs,
            "total": total,
            "page": page,
            "perPage": per_page,
            "totalPages": max(1, (total + per_page - 1) // per_page),
            "preferences": {
                "titles": preferred_titles,
                "locations": preferred_locations,
                "workTypes": preferred_work_types,
            },
        }
    except Exception as e:
        print(f"[Feed] error: {e}")
        import traceback
        traceback.print_exc()
        return {"jobs": [], "total": 0, "page": 1, "perPage": per_page, "totalPages": 1, "preferences": {}}


# ══════════════════════════════════════════════════════════════════════════
# BULK IMPORT (for seeding initial jobs)
# ══════════════════════════════════════════════════════════════════════════

class BulkImportRequest(BaseModel):
    jobs: list[AddCuratedJobRequest]


@router.post("/import")
async def bulk_import_jobs(
    data: BulkImportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import curated jobs. For admin/testing use."""
    imported = 0
    for job in data.jobs:
        try:
            job_id = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO curated_jobs (id, title, company, location, url, description,
                    work_type, employment_type, experience_level, salary_range,
                    skills, tags, job_family, seniority, is_active, source_type, created_by)
                VALUES (:id, :title, :company, :location, :url, :description,
                    :work_type, :employment_type, :exp_level, :salary_range,
                    :skills, :tags, :job_family, :seniority, TRUE, 'import', :created_by)
                ON CONFLICT DO NOTHING
            """), {
                "id": job_id,
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "url": job.url,
                "description": job.description,
                "work_type": job.work_type,
                "employment_type": job.employment_type,
                "exp_level": job.experience_level,
                "salary_range": job.salary_range,
                "skills": job.skills,
                "tags": job.tags,
                "job_family": job.job_family,
                "seniority": job.seniority,
                "created_by": current_user.id,
            })
            imported += 1
        except Exception as e:
            print(f"[Feed] import error for {job.title}: {e}")

    await db.commit()
    return {"imported": imported, "total": len(data.jobs)}
