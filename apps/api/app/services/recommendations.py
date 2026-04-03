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

    # 1. Title match (weight: 25)
    max_score += 25
    if pref_titles and job.title:
        title_lower = job.title.lower()
        for pt in pref_titles:
            if pt.lower() in title_lower:
                score += 25
                reasons.append(f"Title matches '{pt}'")
                badges.append("Title Match")
                break

    # 2. Skills overlap (weight: 25)
    max_score += 25
    if pref_skills and job_skills:
        job_skill_names = {s.skill_canonical.lower() for s in job_skills if s.skill_canonical}
        pref_skill_set = {s.lower() for s in pref_skills}
        overlap = job_skill_names & pref_skill_set
        if overlap:
            skill_score = min(25, int(25 * len(overlap) / max(len(pref_skill_set), 1)))
            score += skill_score
            if len(overlap) >= 3:
                reasons.append(f"{len(overlap)} skill matches: {', '.join(list(overlap)[:3])}")
                badges.append("Strong Skills")
            elif len(overlap) >= 1:
                reasons.append(f"Skill match: {', '.join(overlap)}")
                badges.append("Skill Match")

    # 3. Work type match (weight: 15)
    max_score += 15
    if pref_work_types and job.work_type:
        if job.work_type.lower() in [w.lower() for w in pref_work_types]:
            score += 15
            reasons.append(f"Matches {job.work_type} preference")
            badges.append(job.work_type)

    # 4. Location match (weight: 10)
    max_score += 10
    if pref_locations and job.location:
        loc_lower = job.location.lower()
        for pl in pref_locations:
            if pl.lower() in loc_lower:
                score += 10
                reasons.append(f"Location matches '{pl}'")
                badges.append("Location Match")
                break

    # 5. Industry match (weight: 10)
    max_score += 10
    if pref_industries and job.industry:
        if job.industry.lower() in [i.lower() for i in pref_industries]:
            score += 10
            reasons.append(f"Industry: {job.industry}")
            badges.append("Industry Match")

    # 6. Salary match (weight: 15)
    max_score += 15
    if prefs.min_salary and (job.salary_min or job.salary_max):
        job_max = job.salary_max or job.salary_min or 0
        if job_max >= prefs.min_salary:
            score += 15
            reasons.append("Salary meets minimum requirement")
            badges.append("Salary Aligned")
        elif job_max >= prefs.min_salary * 0.85:
            score += 8
            reasons.append("Salary close to minimum requirement")

    # Normalize to 0-100
    final_score = int((score / max_score * 100)) if max_score > 0 else 50

    return RecommendationResult(
        job_id=job.id,
        score=final_score,
        reasons=reasons if reasons else ["No strong matches found — try updating preferences"],
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
    jobs = result.scalars().all()

    if not jobs:
        return []

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

    # Sort by score descending, take top N
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]
