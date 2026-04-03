"""
Job Board Router — Aggregates real job listings from free APIs.
Sources: Remotive, Arbeitnow (no API keys required).
"""
import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(prefix="/job-board", tags=["job-board"])

# Simple in-memory cache
_cache: dict = {"jobs": [], "fetched_at": None}
CACHE_TTL = 600  # 10 minutes


class JobBoardItem(BaseModel):
    id: str
    title: str
    company: str
    location: str
    postedDate: str
    workType: str  # Remote, Hybrid, On-site
    employmentType: Optional[str] = None
    experienceLevel: str
    salaryRange: Optional[str] = None
    industry: Optional[str] = None
    skills: list[str] = []
    url: Optional[str] = None
    description: Optional[str] = None


def _guess_level(title: str) -> str:
    t = title.lower()
    if "senior" in t or "sr." in t or "lead" in t or "principal" in t:
        return "5+ years"
    if "junior" in t or "jr." in t or "entry" in t or "intern" in t:
        return "0-2 years"
    if "mid" in t or "ii" in t:
        return "3-5 years"
    return "1+ years"


def _parse_salary(salary_str: str) -> str | None:
    if not salary_str or salary_str.strip() == "":
        return None
    return salary_str.strip()


async def fetch_remotive_jobs() -> list[dict]:
    """Fetch from Remotive API (remote jobs)"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://remotive.com/api/remote-jobs?limit=50")
            resp.raise_for_status()
            data = resp.json()
            jobs = []
            for j in data.get("jobs", []):
                # Extract skills from tags
                tags = j.get("tags", []) or []
                # Parse date
                pub_date = j.get("publication_date", "")
                try:
                    dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                    date_str = dt.strftime("%b %d, %Y")
                except Exception:
                    date_str = pub_date[:10] if pub_date else "Recent"

                jobs.append({
                    "id": f"rem-{j.get('id', '')}",
                    "title": j.get("title", "Untitled"),
                    "company": j.get("company_name", "Unknown"),
                    "location": j.get("candidate_required_location", "Worldwide"),
                    "postedDate": date_str,
                    "workType": "Remote",
                    "employmentType": j.get("job_type", "").replace("_", "-").title() or "Full-time",
                    "experienceLevel": _guess_level(j.get("title", "")),
                    "salaryRange": _parse_salary(j.get("salary", "")),
                    "industry": j.get("category", "Technology"),
                    "skills": tags[:8],
                    "url": j.get("url", ""),
                    "description": (j.get("description", "") or "")[:500],
                })
            return jobs
    except Exception as e:
        print(f"[job_board] Remotive fetch error: {e}")
        return []


async def fetch_arbeitnow_jobs() -> list[dict]:
    """Fetch from Arbeitnow API"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://www.arbeitnow.com/api/job-board-api?page=1")
            resp.raise_for_status()
            data = resp.json()
            jobs = []
            for j in data.get("data", []):
                tags = j.get("tags", []) or []
                created = j.get("created_at", 0)
                try:
                    dt = datetime.fromtimestamp(created)
                    date_str = dt.strftime("%b %d, %Y")
                except Exception:
                    date_str = "Recent"

                work_type = "On-site"
                if j.get("remote", False):
                    work_type = "Remote"

                location = j.get("location", "")
                if not location:
                    location = "Not specified"

                jobs.append({
                    "id": f"arb-{j.get('slug', '')}",
                    "title": j.get("title", "Untitled"),
                    "company": j.get("company_name", "Unknown"),
                    "location": location,
                    "postedDate": date_str,
                    "workType": work_type,
                    "employmentType": "Full-time",
                    "experienceLevel": _guess_level(j.get("title", "")),
                    "salaryRange": None,
                    "industry": tags[0] if tags else "Technology",
                    "skills": tags[:8],
                    "url": j.get("url", ""),
                    "description": (j.get("description", "") or "")[:500],
                })
            return jobs
    except Exception as e:
        print(f"[job_board] Arbeitnow fetch error: {e}")
        return []


async def _get_jobs() -> list[dict]:
    """Get cached or fresh jobs"""
    now = datetime.utcnow()
    if _cache["jobs"] and _cache["fetched_at"] and (now - _cache["fetched_at"]).seconds < CACHE_TTL:
        return _cache["jobs"]

    # Fetch from both sources in parallel
    remotive_jobs, arbeitnow_jobs = await asyncio.gather(
        fetch_remotive_jobs(),
        fetch_arbeitnow_jobs(),
    )

    all_jobs = remotive_jobs + arbeitnow_jobs
    _cache["jobs"] = all_jobs
    _cache["fetched_at"] = now
    return all_jobs


@router.get("")
async def list_jobs(
    search: Optional[str] = Query(None),
    work_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
):
    """Browse job listings from aggregated sources"""
    jobs = await _get_jobs()

    # Apply filters
    if search:
        q = search.lower()
        jobs = [j for j in jobs if q in j["title"].lower() or q in j["company"].lower()]

    if work_type and work_type != "All":
        jobs = [j for j in jobs if j["workType"].lower() == work_type.lower()]

    return {"jobs": jobs[:limit], "total": len(jobs)}
