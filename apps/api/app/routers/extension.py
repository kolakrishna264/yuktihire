"""Extension Router — Chrome extension integration endpoints."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.jobs import JobApplication, PipelineStage
from app.models.discover import Job

router = APIRouter(prefix="/extension", tags=["extension"])


class CaptureData(BaseModel):
    url: str
    page_title: Optional[str] = None
    extracted_title: Optional[str] = None
    extracted_company: Optional[str] = None
    extracted_description: Optional[str] = None
    source_domain: Optional[str] = None


@router.get("/status")
async def extension_status(current_user: User = Depends(get_current_user)):
    """Auth check + return user plan info for extension."""
    return {
        "authenticated": True,
        "userId": current_user.id,
        "email": current_user.email,
        "plan": current_user.plan.value if current_user.plan else "FREE",
    }


@router.get("/check-url")
async def check_url(
    url: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a URL is already tracked by this user."""
    # Check job_applications
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.user_id == current_user.id,
            JobApplication.url == url,
        )
    )
    app = result.scalar_one_or_none()
    if app:
        return {
            "tracked": True,
            "trackerId": app.id,
            "stage": app.pipeline_stage.value if app.pipeline_stage else "INTERESTED",
            "company": app.company,
            "title": app.role,
        }

    # Check normalized jobs table
    result = await db.execute(select(Job).where(Job.url == url))
    job = result.scalar_one_or_none()
    if job:
        # Job exists in our DB but user hasn't tracked it
        return {"tracked": False, "jobExists": True, "jobId": job.id}

    return {"tracked": False, "jobExists": False}


@router.post("/capture")
async def capture_job(
    data: CaptureData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a captured job from the browser extension."""
    # Check for duplicate
    result = await db.execute(
        select(JobApplication).where(
            JobApplication.user_id == current_user.id,
            JobApplication.url == data.url,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {
            "status": "duplicate",
            "trackerId": existing.id,
            "message": "Job already tracked",
        }

    title = data.extracted_title or data.page_title or "Untitled Position"
    company = data.extracted_company or _extract_domain(data.source_domain or data.url)

    app = JobApplication(
        user_id=current_user.id,
        role=title,
        company=company,
        url=data.url,
        description=data.extracted_description,
        source=f"Extension ({data.source_domain or 'web'})",
        pipeline_stage=PipelineStage.INTERESTED,
    )
    db.add(app)
    await db.flush()
    await db.refresh(app)

    # Create initial event
    from app.models.tracker import ApplicationEvent
    event = ApplicationEvent(
        application_id=app.id,
        event_type="status_change",
        new_value="INTERESTED",
        title="Captured from browser extension",
        event_date=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.commit()

    # Compute match score if user has preferences
    match_data = {}
    try:
        from app.services.recommendations import _parse_json_array
        from app.models.v2 import UserPreference
        pref_result = await db.execute(select(UserPreference).where(UserPreference.user_id == current_user.id))
        prefs = pref_result.scalar_one_or_none()
        if prefs:
            pref_titles = _parse_json_array(prefs.preferred_titles)
            pref_skills = _parse_json_array(prefs.preferred_skills)
            score = 0
            badges = []
            title_lower = title.lower()
            for pt in pref_titles:
                if pt.lower() in title_lower:
                    score += 40
                    badges.append("Title Match")
                    break
            if pref_skills and data.extracted_description:
                desc_lower = data.extracted_description.lower()
                matched = [s for s in pref_skills if s.lower() in desc_lower]
                if len(matched) >= 3:
                    score += 30
                    badges.append("Strong Skills")
                elif matched:
                    score += 15
                    badges.append("Skill Match")
            match_data = {"matchScore": min(score, 100), "matchBadges": badges}
    except Exception:
        pass

    return {
        "status": "saved",
        "trackerId": app.id,
        "title": title,
        "company": company,
        "dashboardUrl": f"/dashboard/tracker/{app.id}",
        **match_data,
    }


@router.post("/quick-save")
async def quick_save(
    data: CaptureData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Capture + immediately add to tracker. Alias for /capture."""
    return await capture_job(data, current_user, db)


def _extract_domain(url_or_domain: str) -> str:
    """Extract a company-ish name from a URL or domain."""
    domain = url_or_domain.replace("https://", "").replace("http://", "").split("/")[0]
    # Remove www. and TLD
    parts = domain.replace("www.", "").split(".")
    return parts[0].title() if parts else "Unknown"
