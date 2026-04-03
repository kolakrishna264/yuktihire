"""Job recommendation scoring service."""
import json
from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.discover import Job, JobSkill
from app.models.v2 import UserPreference


@dataclass
class RecommendationResult:
    job_id: str
    score: float  # 0-100
    reasons: list[str]  # Human-readable match reasons
    badges: list[str]   # Short badge labels


async def score_job(job: Job, job_skills: list[JobSkill], prefs: UserPreference | None) -> RecommendationResult:
    """Score a single job against user preferences. Returns 0-100 score with reasons."""
    if not prefs:
        return RecommendationResult(job_id=job.id, score=50, reasons=["Set preferences to get personalized matches"], badges=[])

    score = 0
    max_score = 0
    reasons = []
    badges = []

    # Parse preference arrays (stored as JSON strings)
    pref_titles = _parse_json_array(prefs.preferred_titles)
    pref_locations = _parse_json_array(prefs.preferred_locations)
    pref_work_types = _parse_json_array(prefs.preferred_work_types)
    pref_industries = _parse_json_array(prefs.preferred_industries)
    pref_skills = _parse_json_array(prefs.preferred_skills)

    # Only score dimensions the user has actually set
    if pref_titles:
        max_score += 30
        title_lower = job.title.lower() if job.title else ""
        for pt in pref_titles:
            if pt.lower() in title_lower:
                score += 30
                reasons.append(f"Title matches '{pt}'")
                badges.append("Title Match")
                break

    if pref_skills:
        max_score += 25
        job_skill_names = {s.skill_canonical.lower() for s in job_skills if s.skill_canonical}
        pref_skill_set = {s.lower() for s in pref_skills}
        overlap = job_skill_names & pref_skill_set
        if overlap:
            skill_score = min(25, int(25 * len(overlap) / max(len(pref_skill_set), 1)))
            score += skill_score
            if len(overlap) >= 3:
                reasons.append(f"{len(overlap)} skill matches")
                badges.append("Strong Skills")
            elif overlap:
                reasons.append(f"Skills: {', '.join(list(overlap)[:3])}")
                badges.append("Skill Match")

    if pref_work_types:
        max_score += 15
        if job.work_type and job.work_type.lower() in [w.lower() for w in pref_work_types]:
            score += 15
            reasons.append(f"{job.work_type} preference")
            badges.append(job.work_type)

    if pref_locations:
        max_score += 15  # Increased weight for location relevance
        loc_lower = (job.location or "").lower()
        from app.services.sources.location_normalizer import detect_country, is_us_eligible
        job_country = job.country if hasattr(job, 'country') and job.country else detect_country(job.location or "")

        for pl in pref_locations:
            pl_lower = pl.lower()
            # Direct location match
            if pl_lower in loc_lower:
                score += 15
                reasons.append(f"Location: {pl}")
                badges.append("Location")
                break
            # "Remote" preference matches remote-eligible jobs
            if "remote" in pl_lower and ("remote" in loc_lower or job_country in ("REMOTE", "REMOTE_US")):
                score += 15
                reasons.append("Remote eligible")
                badges.append("Remote")
                break
            # US preference matches US jobs
            if any(us in pl_lower for us in ["us", "united states", "america"]) and job_country in ("US", "REMOTE_US"):
                score += 15
                reasons.append("US-based")
                badges.append("US")
                break
        else:
            # Penalize non-US jobs when user prefers US
            us_prefs = [p for p in pref_locations if any(us in p.lower() for us in ["us", "united states", "remote", "texas", "california", "new york"])]
            if us_prefs and job_country == "NON_US":
                score -= 5  # Negative penalty

    if pref_industries:
        max_score += 10
        if job.industry and job.industry.lower() in [i.lower() for i in pref_industries]:
            score += 10
            reasons.append(f"Industry: {job.industry}")
            badges.append("Industry")

    if prefs.min_salary and (job.salary_min or job.salary_max):
        max_score += 10
        job_max = job.salary_max or job.salary_min or 0
        if job_max >= prefs.min_salary:
            score += 10
            reasons.append("Salary aligned")
            badges.append("Salary")

    # Normalize
    if max_score == 0:
        return RecommendationResult(job_id=job.id, score=50, reasons=["Set more preferences for better matches"], badges=[])

    final_score = int(score / max_score * 100)

    if not reasons:
        reasons = ["No strong matches — try updating preferences"]

    return RecommendationResult(
        job_id=job.id,
        score=final_score,
        reasons=reasons,
        badges=badges,
    )


def _parse_json_array(val: str | None) -> list[str]:
    if not val:
        return []
    try:
        parsed = json.loads(val)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def score_job_dict(job_data: dict, prefs) -> dict:
    """Score a job dict (from raw SQL) against preferences. Returns dict with score/badges/reasons."""
    if not prefs:
        return {"score": 50, "badges": [], "reasons": ["Set preferences for matches"]}

    score = 0
    max_score = 0
    reasons = []
    badges = []

    pref_titles = _parse_json_array(prefs.preferred_titles)
    pref_skills = _parse_json_array(prefs.preferred_skills)
    pref_work_types = _parse_json_array(prefs.preferred_work_types)
    pref_locations = _parse_json_array(prefs.preferred_locations)
    pref_industries = _parse_json_array(prefs.preferred_industries)

    title = (job_data.get("title") or "").lower()
    loc = (job_data.get("location") or "").lower()
    wt = (job_data.get("workType") or job_data.get("work_type") or "").lower()
    ind = (job_data.get("industry") or "").lower()

    if pref_titles:
        max_score += 30
        for pt in pref_titles:
            if pt.lower() in title:
                score += 30
                reasons.append(f"Title: {pt}")
                badges.append("Title Match")
                break

    if pref_skills:
        max_score += 25
        skills = job_data.get("skills", [])
        skill_names = set()
        for s in skills:
            if isinstance(s, dict):
                skill_names.add((s.get("canonical") or s.get("name") or "").lower())
            elif isinstance(s, str):
                skill_names.add(s.lower())
        overlap = skill_names & {s.lower() for s in pref_skills}
        if len(overlap) >= 3:
            score += 25
            badges.append("Strong Skills")
            reasons.append(f"{len(overlap)} skills match")
        elif overlap:
            score += int(25 * len(overlap) / len(pref_skills))
            badges.append("Skill Match")

    if pref_work_types:
        max_score += 15
        if wt in [w.lower() for w in pref_work_types]:
            score += 15
            badges.append(job_data.get("workType") or "Remote")

    if pref_locations:
        max_score += 15
        for pl in pref_locations:
            if pl.lower() in loc or ("remote" in pl.lower() and "remote" in loc):
                score += 15
                badges.append("Location")
                break

    if pref_industries:
        max_score += 10
        if ind and ind in [i.lower() for i in pref_industries]:
            score += 10
            badges.append("Industry")

    if max_score == 0:
        return {"score": 50, "badges": [], "reasons": ["Set more preferences"]}

    final = min(100, max(0, int(score / max_score * 100)))
    if not reasons:
        reasons = ["No strong matches"]
    return {"score": final, "badges": badges, "reasons": reasons}


async def get_recommendations(db: AsyncSession, user_id: str, limit: int = 20) -> list[dict]:
    """Get top recommended jobs for a user using raw SQL."""
    from app.models.v2 import UserPreference
    from sqlalchemy import text

    # Get user preferences
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    prefs = result.scalar_one_or_none()

    # Get recent active jobs using raw SQL (avoids column-missing crashes)
    result = await db.execute(text("SELECT * FROM jobs WHERE is_active = true ORDER BY posted_at DESC NULLS LAST LIMIT 200"))
    rows = result.mappings().all()

    if not rows:
        return []

    # Filter out non-US jobs aggressively
    _non_us_loc = {
        "germany", "berlin", "munich", "frankfurt", "hamburg", "köln", "cologne",
        "düsseldorf", "stuttgart", "leipzig", "dresden", "herford", "münster",
        "mülheim", "offenburg", "mannheim", "blaustein", "ostwestfalen",
        "united kingdom", "uk", "london", "manchester", "england",
        "france", "paris", "netherlands", "amsterdam", "spain", "madrid",
        "italy", "rome", "milan", "sweden", "stockholm",
        "canada", "toronto", "vancouver", "australia", "sydney", "melbourne",
        "india", "bangalore", "mumbai", "singapore", "japan", "tokyo",
        "europe", "emea", "apac", "dach",
    }

    def _is_likely_us(r):
        company = (r.get("company") or "").lower()
        title = (r.get("title") or "").lower()
        location = (r.get("location") or "").lower()
        # German company suffix
        if "gmbh" in company:
            return False
        # German job title pattern (m/w/d)
        if "(m/w/d)" in title or "(w/m/d)" in title or "(all gender)" in title:
            return False
        # Non-US location markers
        if any(m in location for m in _non_us_loc):
            return False
        # Non-US location in company name
        if any(m in company for m in ["gmbh", "ag ", " ag", "b.v.", "ltd"]):
            return False
        return True

    rows = [r for r in rows if _is_likely_us(r)]

    # Pre-filter by title keywords if user has preferred titles
    pref_titles = _parse_json_array(prefs.preferred_titles) if prefs else []
    if pref_titles:
        title_keywords = set()
        for t in pref_titles:
            title_keywords.update(t.lower().split())
        relevant = [r for r in rows if title_keywords & set((r.get("title") or "").lower().split())]
        if len(relevant) >= 5:
            rows = relevant

    # Load skills for these jobs
    job_ids = [r["id"] for r in rows]
    skills_by_job = {}
    if job_ids:
        try:
            skills_result = await db.execute(select(JobSkill).where(JobSkill.job_id.in_(job_ids)))
            for s in skills_result.scalars().all():
                skills_by_job.setdefault(s.job_id, []).append(s)
        except Exception:
            pass

    # Score each job
    scored = []
    for r in rows:
        job_dict = {
            "title": r.get("title"),
            "company": r.get("company"),
            "location": r.get("location"),
            "work_type": r.get("work_type"),
            "industry": r.get("industry"),
            "skills": [{"canonical": s.skill_canonical, "name": s.skill_name} for s in skills_by_job.get(r["id"], [])],
        }
        match = score_job_dict(job_dict, prefs)

        posted = r.get("posted_at")
        scored.append({
            "jobId": r["id"],
            "title": r.get("title", ""),
            "company": r.get("company", ""),
            "location": r.get("location"),
            "url": r.get("url"),
            "workType": r.get("work_type"),
            "salaryRaw": r.get("salary_raw"),
            "companyLogoUrl": r.get("company_logo_url"),
            "experienceLevel": r.get("experience_level"),
            "industry": r.get("industry"),
            "postedAt": posted.isoformat() if posted else None,
            "score": match["score"],
            "reasons": match["reasons"],
            "badges": match["badges"],
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    scored = [s for s in scored if s["score"] >= 15]
    return scored[:limit]
