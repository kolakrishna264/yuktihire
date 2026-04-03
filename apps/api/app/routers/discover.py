"""Discover Router — Job search and discovery using raw SQL."""
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


# ── Location helpers (inline to avoid import issues) ─────────────────────

_US_MARKERS = {"united states", "usa", ", us", " us,", "(us)", "u.s.", "usa only", "us only", "north america"}
_US_STATES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york",
    "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west virginia", "wisconsin", "wyoming",
}
_US_ABBREVS = {
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id",
    "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms",
    "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
    "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv",
    "wi", "wy", "dc",
}
_US_CITIES = {
    "new york", "los angeles", "chicago", "houston", "phoenix", "san francisco",
    "seattle", "denver", "boston", "atlanta", "miami", "austin", "dallas",
    "san diego", "san jose", "portland", "nashville", "charlotte", "tampa",
    "minneapolis", "raleigh", "salt lake city", "arlington", "columbus",
}
_NON_US = {
    "united kingdom", "uk", "london", "manchester", "england", "scotland", "wales",
    "germany", "berlin", "munich", "frankfurt", "hamburg", "köln", "cologne",
    "düsseldorf", "stuttgart", "leipzig", "dresden", "herford", "münster",
    "mülheim", "offenburg", "mannheim", "blaustein", "ostwestfalen",
    "france", "paris", "lyon", "netherlands", "amsterdam", "rotterdam",
    "spain", "madrid", "barcelona", "italy", "rome", "milan",
    "sweden", "stockholm", "denmark", "copenhagen", "norway", "oslo",
    "switzerland", "zurich", "austria", "vienna",
    "poland", "warsaw", "czech", "prague", "portugal", "lisbon",
    "canada", "toronto", "vancouver", "montreal",
    "australia", "sydney", "melbourne", "india", "bangalore", "mumbai", "hyderabad",
    "singapore", "japan", "tokyo", "brazil", "são paulo",
    "europe", "eu", "emea", "apac", "dach", "gmbh",
}


def _detect_country(location: str) -> str:
    if not location:
        return "UNKNOWN"
    loc = location.lower().strip()
    if any(m in loc for m in _US_MARKERS):
        return "US"
    if "remote" in loc and any(m in loc for m in ["us", "usa", "united states", "north america"]):
        return "REMOTE_US"
    for state in _US_STATES:
        if state in loc:
            return "US"
    parts = [p.strip().lower() for p in loc.replace(",", " ").split()]
    for part in parts:
        if part in _US_ABBREVS:
            return "US"
    for city in _US_CITIES:
        if city in loc:
            return "US"
    for marker in _NON_US:
        if marker in loc:
            return "NON_US"
    if "remote" in loc or "worldwide" in loc or "anywhere" in loc:
        return "REMOTE"
    return "UNKNOWN"


def _is_us_eligible(location: str, company: str = "", title: str = "") -> bool:
    """Check if a job is US-eligible based on location, company, and title."""
    c = _detect_country(location)
    if c == "NON_US":
        return False
    cl = company.lower() if company else ""
    tl = title.lower() if title else ""
    # German company indicators
    if "gmbh" in cl or "ag " in cl or " ag" in cl:
        return False
    # German job title pattern
    if "(m/w/d)" in tl or "(w/m/d)" in tl or "(all gender)" in tl:
        return False
    return True


# ── Helpers ──────────────────────────────────────────────────────────────

async def get_optional_user(request: Request):
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
    posted = r.get("posted_at")
    created = r.get("created_at")
    loc = r.get("location") or ""
    data = {
        "id": r.get("id"),
        "title": r.get("title", ""),
        "company": r.get("company", ""),
        "location": loc,
        "url": r.get("url"),
        "descriptionText": (r.get("description_text") or "")[:500],
        "salaryMin": r.get("salary_min"),
        "salaryMax": r.get("salary_max"),
        "salaryRaw": r.get("salary_raw"),
        "workType": r.get("work_type"),
        "employmentType": r.get("employment_type"),
        "experienceLevel": r.get("experience_level"),
        "industry": r.get("industry"),
        "country": "NON_US" if (r.get("company") or "").lower().endswith("gmbh") else _detect_country(loc),
        "postedAt": posted.isoformat() if posted else None,
        "isActive": r.get("is_active", True),
        "companyLogoUrl": r.get("company_logo_url"),
        "skills": [{"name": s.skill_name, "canonical": s.skill_canonical, "isRequired": s.is_required} for s in (skills or [])],
        "sources": sources or [],
        "createdAt": created.isoformat() if created else None,
    }
    if match:
        data["matchScore"] = match.get("score", 0)
        data["matchBadges"] = match.get("badges", [])
        data["matchReasons"] = match.get("reasons", [])[:2]
    return data


# ── Endpoints ────────────────────────────────────────────────────────────

@router.get("")
async def search_jobs(
    request: Request,
    q: Optional[str] = Query(None),
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
    try:
        # Exclude German/non-US jobs at SQL level for performance
        conditions = [
            "is_active = true",
            "title NOT LIKE '%%(m/w/d)%%'",
            "title NOT LIKE '%%(w/m/d)%%'",
            "title NOT LIKE '%%(all gender)%%'",
            "company NOT LIKE '%%GmbH%%'",
            "company NOT LIKE '%%gmbh%%'",
        ]
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
        order = "posted_at DESC NULLS LAST, created_at DESC"
        if sort == "oldest":
            order = "posted_at ASC NULLS LAST"
        elif sort == "salary":
            order = "salary_max DESC NULLS LAST"
        elif sort == "company":
            order = "company ASC"

        # Fetch large batch then filter by country in Python
        sql = f"SELECT * FROM jobs WHERE {where_clause} ORDER BY {order} LIMIT 2000"
        result = await db.execute(text(sql), params)
        all_rows = result.mappings().all()

        # Filter by country IN PYTHON (no DB column needed)
        if country and country != "":
            if country == "us_eligible":
                all_rows = [r for r in all_rows if _is_us_eligible(r.get("location") or "", r.get("company") or "", r.get("title") or "")]
            elif country == "US":
                all_rows = [r for r in all_rows if _detect_country(r.get("location") or "") == "US"]
            elif country == "REMOTE_US":
                all_rows = [r for r in all_rows if _detect_country(r.get("location") or "") == "REMOTE_US"]
            elif country == "REMOTE":
                all_rows = [r for r in all_rows if _detect_country(r.get("location") or "") in ("REMOTE", "REMOTE_US")]

        total = len(all_rows)

        # Paginate
        start = (page - 1) * per_page
        rows = all_rows[start:start + per_page]

        # Load skills + sources for page
        job_ids = [r["id"] for r in rows]
        skills_by_job = {}
        sources_by_job = {}

        if job_ids:
            try:
                skills_result = await db.execute(select(JobSkill).where(JobSkill.job_id.in_(job_ids)))
                for s in skills_result.scalars().all():
                    skills_by_job.setdefault(s.job_id, []).append(s)
            except Exception:
                pass
            try:
                src_result = await db.execute(
                    select(JobSourceLink, JobSource).join(JobSource).where(JobSourceLink.job_id.in_(job_ids))
                )
                for link, src in src_result.all():
                    sources_by_job.setdefault(link.job_id, []).append({
                        "slug": src.slug, "name": src.name,
                        "externalId": link.external_id, "sourceUrl": link.source_url,
                    })
            except Exception:
                pass

        # Serialize
        jobs_data = [_serialize_row(r, skills_by_job.get(r["id"], []), sources_by_job.get(r["id"], [])) for r in rows]

        # Always try to score jobs against user preferences
        current_user = await get_optional_user(request)
        if current_user:
            try:
                from app.services.recommendations import score_job_dict
                from app.models.v2 import UserPreference
                prefs_result = await db.execute(select(UserPreference).where(UserPreference.user_id == current_user.id))
                prefs = prefs_result.scalar_one_or_none()
                if prefs:
                    for jd in jobs_data:
                        m = score_job_dict(jd, prefs)
                        jd["matchScore"] = m["score"]
                        jd["matchBadges"] = m["badges"]
                        jd["matchReasons"] = m["reasons"][:2]
                    if sort == "best_match":
                        jobs_data.sort(key=lambda x: x.get("matchScore", 0), reverse=True)
            except Exception as e:
                print(f"[Discover] scoring error: {e}")

        return {
            "jobs": jobs_data,
            "total": total,
            "page": page,
            "perPage": per_page,
            "totalPages": (total + per_page - 1) // per_page if total > 0 else 0,
        }
    except Exception as e:
        print(f"[Discover] search error: {e}")
        return {"jobs": [], "total": 0, "page": 1, "perPage": per_page, "totalPages": 0}


@router.get("/debug")
async def debug_counts(db: AsyncSession = Depends(get_db)):
    """Debug: show job counts by source and country for troubleshooting."""
    try:
        # Total jobs
        total = (await db.execute(text("SELECT COUNT(*) FROM jobs"))).scalar() or 0

        # By source
        source_counts = []
        try:
            result = await db.execute(text("""
                SELECT js.slug, js.name, COUNT(jsl.id) as cnt, js.last_sync_at
                FROM job_sources js
                LEFT JOIN job_source_links jsl ON js.id = jsl.source_id
                GROUP BY js.id, js.slug, js.name, js.last_sync_at
                ORDER BY cnt DESC
            """))
            for row in result.mappings().all():
                source_counts.append({
                    "slug": row["slug"],
                    "name": row["name"],
                    "count": row["cnt"],
                    "lastSync": row["last_sync_at"].isoformat() if row["last_sync_at"] else None,
                })
        except Exception as e:
            source_counts = [{"error": str(e)}]

        # Non-GmbH jobs (US-eligible estimate)
        us_est = (await db.execute(text("SELECT COUNT(*) FROM jobs WHERE company NOT LIKE '%%GmbH%%' AND company NOT LIKE '%%gmbh%%' AND title NOT LIKE '%%(m/w/d)%%'"))).scalar() or 0

        # Recent jobs (last 24h)
        recent = 0
        try:
            recent = (await db.execute(text("SELECT COUNT(*) FROM jobs WHERE created_at > NOW() - INTERVAL '24 hours'"))).scalar() or 0
        except Exception:
            pass

        return {
            "totalJobs": total,
            "usEligibleEstimate": us_est,
            "recentJobs24h": recent,
            "bySources": source_counts,
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(JobSource).order_by(JobSource.name))
        return [{"id": s.id, "slug": s.slug, "name": s.name, "isActive": s.is_active, "lastSyncAt": s.last_sync_at.isoformat() if s.last_sync_at else None} for s in result.scalars().all()]
    except Exception:
        return []


@router.post("/refresh")
async def refresh_sources(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.sources.scheduler import run_sync_cycle
    background_tasks.add_task(run_sync_cycle)
    return {"status": "refresh_started"}


@router.get("/recommendations")
async def get_job_recommendations(
    limit: int = Query(20, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        from app.services.recommendations import get_recommendations
        results = await get_recommendations(db, current_user.id, limit)
        return {"recommendations": results}
    except Exception as e:
        print(f"[Discover] recommendations error: {e}")
        return {"recommendations": []}


@router.get("/{job_id}")
async def get_job_detail(job_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT * FROM jobs WHERE id = :id"), {"id": job_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        skills = []
        sources = []
        try:
            sr = await db.execute(select(JobSkill).where(JobSkill.job_id == job_id))
            skills = sr.scalars().all()
        except Exception:
            pass
        try:
            sr = await db.execute(select(JobSourceLink, JobSource).join(JobSource).where(JobSourceLink.job_id == job_id))
            sources = [{"slug": s.slug, "name": s.name, "externalId": l.external_id, "sourceUrl": l.source_url} for l, s in sr.all()]
        except Exception:
            pass
        data = _serialize_row(row, skills, sources)
        data["descriptionText"] = row.get("description_text")
        return data
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Discover] detail error: {e}")
        raise HTTPException(status_code=404, detail="Job not found")
