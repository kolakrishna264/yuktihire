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
        max_score += 10
        loc_lower = (job.location or "").lower()
        for pl in pref_locations:
            if pl.lower() in loc_lower or ("remote" in pl.lower() and "remote" in loc_lower):
                score += 10
                reasons.append(f"Location: {pl}")
                badges.append("Location")
                break

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


async def get_recommendations(db: AsyncSession, user_id: str, limit: int = 20) -> list[dict]:
    """Get top recommended jobs for a user."""
    from app.models.v2 import UserPreference

    # Get user preferences
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    prefs = result.scalar_one_or_none()

    # Get recent active jobs
    result = await db.execute(
        select(Job).where(Job.is_active == True).order_by(Job.posted_at.desc().nullslast()).limit(200)
    )
    jobs = list(result.scalars().all())

    if not jobs:
        return []

    # Pre-filter: if user has preferred titles, keep only jobs with title keyword overlap
    pref_titles = _parse_json_array(prefs.preferred_titles) if prefs else []
    if pref_titles:
        title_keywords = set()
        for t in pref_titles:
            title_keywords.update(t.lower().split())
        relevant_jobs = []
        for job in jobs:
            job_title_words = set((job.title or "").lower().split())
            if title_keywords & job_title_words:
                relevant_jobs.append(job)
        if len(relevant_jobs) >= 10:
            jobs = relevant_jobs  # Only use filtered if we have enough

    # Load all skills for these jobs
    job_ids = [j.id for j in jobs]
    skills_result = await db.execute(select(JobSkill).where(JobSkill.job_id.in_(job_ids)))
    all_skills = skills_result.scalars().all()
    skills_by_job = {}
    for s in all_skills:
        skills_by_job.setdefault(s.job_id, []).append(s)

    # Score each job
    scored = []
    for job in jobs:
        result = await score_job(job, skills_by_job.get(job.id, []), prefs)
        scored.append({
            "jobId": job.id,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "url": job.url,
            "workType": job.work_type,
            "salaryRaw": job.salary_raw,
            "companyLogoUrl": job.company_logo_url,
            "experienceLevel": job.experience_level,
            "industry": job.industry,
            "postedAt": job.posted_at.isoformat() if job.posted_at else None,
            "score": result.score,
            "reasons": result.reasons,
            "badges": result.badges,
        })

    # Sort by score descending, filter out very low matches, take top N
    scored.sort(key=lambda x: x["score"], reverse=True)
    scored = [s for s in scored if s["score"] >= 15]
    return scored[:limit]
