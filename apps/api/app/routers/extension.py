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

        # Insert with description for JD storage + notes as backup
        import uuid
        job_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO job_applications (id, user_id, role, company, url, description, notes, source, status, created_at, updated_at)
                VALUES (:id, :uid, :role, :company, :url, :description, :notes, :source, 'SAVED', NOW(), NOW())
            """),
            {
                "id": job_id,
                "uid": current_user.id,
                "role": title,
                "company": company,
                "url": data.url,
                "description": desc_text if desc_text else None,
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


class UpdateNameData(BaseModel):
    first_name: str
    last_name: str


@router.post("/update-name")
async def update_user_name(
    data: UpdateNameData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save first_name and last_name separately on the user record."""
    try:
        await db.execute(
            text("UPDATE users SET first_name = :fn, last_name = :ln, full_name = :full, updated_at = NOW() WHERE id = :uid"),
            {"fn": data.first_name.strip(), "ln": data.last_name.strip(),
             "full": f"{data.first_name.strip()} {data.last_name.strip()}".strip(),
             "uid": current_user.id},
        )
        await db.commit()
        return {"status": "updated"}
    except Exception as e:
        print(f"[Extension] update-name error: {e}")
        return {"status": "error", "message": str(e)}


class UpdateJDData(BaseModel):
    tracker_id: str
    description: str


@router.post("/update-jd")
async def update_job_description(
    data: UpdateJDData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the JD/description for a tracked job (extension sends page text after save)."""
    try:
        result = await db.execute(
            text("SELECT id FROM job_applications WHERE id = :id AND user_id = :uid"),
            {"id": data.tracker_id, "uid": current_user.id},
        )
        if not result.first():
            raise HTTPException(status_code=404, detail="Job not found")

        desc = (data.description or "")[:10000]
        await db.execute(
            text("UPDATE job_applications SET description = :desc, notes = COALESCE(NULLIF(notes, ''), :desc), updated_at = NOW() WHERE id = :id"),
            {"id": data.tracker_id, "desc": desc},
        )
        await db.commit()
        return {"status": "updated", "trackerId": data.tracker_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Extension] update-jd error: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/autofill-data")
async def get_autofill_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return structured profile data for form autofill. Priority: profile > user > fallback."""
    try:
        # Get profile (has parsed resume data)
        profile = await db.execute(
            text("SELECT * FROM profiles WHERE user_id = :uid"),
            {"uid": current_user.id},
        )
        p = profile.mappings().first()

        # Get user record (with separate first_name/last_name if available)
        user_result = await db.execute(
            text("SELECT * FROM users WHERE id = :uid"),
            {"uid": current_user.id},
        )
        user = user_result.mappings().first()

        # Get name: prefer separate first_name/last_name, fallback to full_name split
        first_name = ""
        last_name = ""
        full_name = ""

        # Source 1: Separate first_name/last_name columns
        if user:
            first_name = (user.get("first_name") or "").strip()
            last_name = (user.get("last_name") or "").strip()

        # Source 2: full_name column (split into parts)
        if not first_name and user and user.get("full_name"):
            full_name = (user.get("full_name") or "").strip()
            name_parts = full_name.split(" ") if full_name else []
            first_name = name_parts[0] if len(name_parts) >= 1 else ""
            last_name = " ".join(name_parts[1:]) if len(name_parts) >= 2 else ""

        # Source 3: Resume content
        if not first_name:
            try:
                resume_result = await db.execute(
                    text("SELECT content FROM resumes WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1"),
                    {"uid": current_user.id},
                )
                resume_row = resume_result.mappings().first()
                if resume_row and resume_row.get("content"):
                    import json
                    content = resume_row["content"] if isinstance(resume_row["content"], dict) else json.loads(resume_row["content"])
                    resume_name = content.get("name") or content.get("full_name") or content.get("contact", {}).get("name", "")
                    if resume_name:
                        parts = resume_name.strip().split(" ")
                        first_name = parts[0] if parts else ""
                        last_name = " ".join(parts[1:]) if len(parts) >= 2 else ""
            except Exception:
                pass

        full_name = f"{first_name} {last_name}".strip() if not full_name else full_name

        email = user.get("email", "") if user else ""
        phone = p.get("phone", "") if p else ""
        location = p.get("location", "") if p else ""
        linkedin = p.get("linkedin", "") if p else ""
        github = p.get("github", "") if p else ""
        portfolio = p.get("portfolio", "") if p else ""

        # Generate address from location
        address = location
        if location and "," not in location:
            address = f"{location}, United States"

        # Get user preferences for application-specific fields
        app_info = {}
        try:
            pref_result = await db.execute(
                text("SELECT application_data FROM user_preferences WHERE user_id = :uid"),
                {"uid": current_user.id},
            )
            pref_row = pref_result.first()
            if pref_row and pref_row[0]:
                import json as _json
                app_info = _json.loads(pref_row[0])
        except Exception:
            pass

        # Defaults — overridden by saved application info from preferences
        defaults = {
            "workAuthorization": "Yes",
            "sponsorship": "Yes",
            "relocation": "Yes",
            "pronouns": "He/him/his",
            "gender": "Male",
            "veteranStatus": "I am not a protected veteran",
            "disabilityStatus": "I do not want to answer",
            "hispanicLatino": "No",
            "race": "Asian",
            "earliestStart": "2 weeks from offer",
            "interviewedBefore": "No",
            "aiPolicyAcknowledge": "Yes",
        }
        # Merge saved preferences over defaults
        for key in defaults:
            if key in app_info and app_info[key]:
                defaults[key] = app_info[key]

        return {
            "firstName": first_name,
            "lastName": last_name,
            "fullName": full_name,
            "email": email,
            "phone": phone,
            "location": location,
            "address": address,
            "linkedin": linkedin,
            "github": github,
            "portfolio": portfolio,
            "headline": p.get("headline", "") if p else "",
            "summary": p.get("summary", "") if p else "",
            **defaults,
        }
    except Exception as e:
        print(f"[Extension] autofill-data error: {e}")
        return {"firstName": "", "lastName": "", "email": current_user.email or ""}


@router.get("/resumes")
async def list_resumes_for_extension(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's resumes for extension tailor flow."""
    try:
        result = await db.execute(
            text("SELECT * FROM resumes WHERE user_id = :uid ORDER BY created_at DESC"),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
        return {"resumes": [
            {"id": r["id"], "name": r.get("name", "Resume"), "isDefault": r.get("is_default", False) or False}
            for r in rows
        ]}
    except Exception as e:
        print(f"[Extension] resumes error: {e}")
        import traceback
        traceback.print_exc()
        return {"resumes": []}


@router.get("/tailor-status/{session_id}")
async def get_tailor_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Poll tailoring session status for extension."""
    try:
        result = await db.execute(
            text("SELECT id, status, resume_id FROM tailoring_sessions WHERE id = :id AND user_id = :uid"),
            {"id": session_id, "uid": current_user.id},
        )
        row = result.mappings().first()
        if not row:
            return {"status": "NOT_FOUND"}

        data = {"status": row.get("status", "UNKNOWN"), "resumeId": row.get("resume_id")}

        # If completed, get ATS score
        if row.get("status") == "COMPLETED":
            try:
                ats = await db.execute(
                    text("SELECT overall_score, keyword_score, skills_score, experience_score FROM ats_scores WHERE session_id = :sid LIMIT 1"),
                    {"sid": session_id},
                )
                ats_row = ats.mappings().first()
                if ats_row:
                    data["atsScore"] = {
                        "overall": ats_row.get("overall_score"),
                        "keywords": ats_row.get("keyword_score"),
                        "skills": ats_row.get("skills_score"),
                        "experience": ats_row.get("experience_score"),
                    }
            except Exception:
                pass

        return data
    except Exception as e:
        print(f"[Extension] tailor-status error: {e}")
        return {"status": "ERROR", "message": str(e)}


@router.get("/export")
async def export_resume_for_extension(
    resume_id: str = Query(...),
    format: str = Query("pdf"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate PDF/DOCX download for extension. Returns file bytes."""
    from fastapi.responses import StreamingResponse

    try:
        result = await db.execute(
            text("SELECT id, name, content FROM resumes WHERE id = :id AND user_id = :uid"),
            {"id": resume_id, "uid": current_user.id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Resume not found")

        import json
        content = row.get("content")
        if isinstance(content, str):
            content = json.loads(content)

        name = row.get("name", "Resume").replace(" ", "_")

        if format == "pdf":
            from pdf_gen import generate_pdf
            file_bytes = await generate_pdf(content, "standard")
            return StreamingResponse(
                iter([file_bytes]),
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'},
            )
        elif format == "docx":
            from docx_gen import generate_docx
            file_bytes = await generate_docx(content)
            return StreamingResponse(
                iter([file_bytes]),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{name}.docx"'},
            )
        else:
            raise HTTPException(400, "Format must be pdf or docx")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Extension] export error: {e}")
        raise HTTPException(500, str(e))


def _extract_domain(url_or_domain: str) -> str:
    """Extract a company-ish name from a URL or domain."""
    domain = url_or_domain.replace("https://", "").replace("http://", "").split("/")[0]
    parts = domain.replace("www.", "").split(".")
    return parts[0].title() if parts else "Unknown"
