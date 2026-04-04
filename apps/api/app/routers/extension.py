"""Extension Router — Chrome extension integration endpoints."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User

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
    try:
        result = await db.execute(
            text("SELECT id, role, company, status FROM job_applications WHERE user_id = :uid AND url = :url LIMIT 1"),
            {"uid": current_user.id, "url": url},
        )
        row = result.mappings().first()
        if row:
            return {
                "tracked": True,
                "trackerId": row["id"],
                "stage": row.get("status") or "SAVED",
                "company": row.get("company", ""),
                "title": row.get("role", ""),
            }
    except Exception as e:
        print(f"[Extension] check-url error: {e}")

    return {"tracked": False, "jobExists": False}


@router.post("/capture")
async def capture_job(
    data: CaptureData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a captured job from the browser extension."""
    try:
        # Check for duplicate
        result = await db.execute(
            text("SELECT id FROM job_applications WHERE user_id = :uid AND url = :url LIMIT 1"),
            {"uid": current_user.id, "url": data.url},
        )
        existing = result.mappings().first()
        if existing:
            return {
                "status": "duplicate",
                "trackerId": existing["id"],
                "message": "Job already tracked",
            }

        title = data.extracted_title or data.page_title or "Untitled Position"
        company = data.extracted_company or _extract_domain(data.source_domain or data.url)
        desc_text = (data.extracted_description or "")[:5000]
        print(f"[Extension] Saving: {title} @ {company} | desc length: {len(desc_text)} | url: {data.url}")

        # Insert using only columns that exist in the original table
        import uuid
        job_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO job_applications (id, user_id, role, company, url, notes, source, status, created_at, updated_at)
                VALUES (:id, :uid, :role, :company, :url, :notes, :source, 'SAVED', NOW(), NOW())
            """),
            {
                "id": job_id,
                "uid": current_user.id,
                "role": title,
                "company": company,
                "url": data.url,
                "notes": desc_text if desc_text else None,
                "source": f"Extension ({data.source_domain or 'web'})",
            },
        )
        await db.commit()

        return {
            "status": "saved",
            "trackerId": job_id,
            "title": title,
            "company": company,
            "dashboardUrl": f"/dashboard/jobs",
        }
    except Exception as e:
        print(f"[Extension] capture error: {e}")
        import traceback
        traceback.print_exc()
        await db.rollback()
        return {"status": "error", "message": str(e)}


@router.post("/quick-save")
async def quick_save(
    data: CaptureData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Capture + immediately add to tracker. Alias for /capture."""
    return await capture_job(data, current_user, db)


@router.get("/autofill-data")
async def get_autofill_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return structured profile data for form autofill."""
    try:
        profile = await db.execute(
            text("SELECT * FROM profiles WHERE user_id = :uid"),
            {"uid": current_user.id},
        )
        p = profile.mappings().first()

        # Get user email
        user_result = await db.execute(
            text("SELECT email, full_name FROM users WHERE id = :uid"),
            {"uid": current_user.id},
        )
        user = user_result.mappings().first()

        # Parse name
        full_name = (user.get("full_name") or user.get("email", "").split("@")[0]) if user else ""
        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0] if name_parts else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        return {
            "firstName": first_name,
            "lastName": last_name,
            "fullName": full_name,
            "email": user.get("email", "") if user else "",
            "phone": p.get("phone", "") if p else "",
            "location": p.get("location", "") if p else "",
            "linkedin": p.get("linkedin", "") if p else "",
            "github": p.get("github", "") if p else "",
            "portfolio": p.get("portfolio", "") if p else "",
            "headline": p.get("headline", "") if p else "",
            "summary": p.get("summary", "") if p else "",
        }
    except Exception as e:
        print(f"[Extension] autofill-data error: {e}")
        return {"firstName": "", "lastName": "", "email": current_user.email or ""}


def _extract_domain(url_or_domain: str) -> str:
    """Extract a company-ish name from a URL or domain."""
    domain = url_or_domain.replace("https://", "").replace("http://", "").split("/")[0]
    parts = domain.replace("www.", "").split(".")
    return parts[0].title() if parts else "Unknown"
