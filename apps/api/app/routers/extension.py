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
    location: Optional[str] = None
    salary: Optional[str] = None
    work_type: Optional[str] = None
    experience_level: Optional[str] = None


@router.get("/download")
async def download_extension():
    """Serve only the Chrome extension files as a zip — NOT the full source code."""
    import zipfile
    import io
    import os
    from fastapi.responses import StreamingResponse

    # Try multiple paths to find the extension directory
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "apps", "extension"),
        os.path.join(os.getcwd(), "apps", "extension"),
        os.path.join(os.getcwd(), "extension"),
        "/app/apps/extension",  # Railway container path
    ]

    ext_dir = None
    for path in candidates:
        if os.path.isdir(path) and os.path.isfile(os.path.join(path, "manifest.json")):
            ext_dir = path
            break

    if not ext_dir:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Extension files not found on server. Contact support.")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(ext_dir):
            dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "__pycache__"}]
            for f in files:
                if f.endswith((".py", ".pyc", ".env", ".gitignore")):
                    continue
                filepath = os.path.join(root, f)
                arcname = os.path.join("yuktihire-extension", os.path.relpath(filepath, ext_dir))
                zf.write(filepath, arcname)

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="yuktihire-extension.zip"'},
    )


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
        desc_text = (data.extracted_description or "")[:15000]
        print(f"[Extension] Saving: {title} @ {company} | desc length: {len(desc_text)} | url: {data.url}")

        # Insert with description for JD storage + notes as backup
        import uuid
        job_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO job_applications (id, user_id, role, company, url, description, notes, source, status,
                    location, salary, work_type, experience_level, created_at, updated_at)
                VALUES (:id, :uid, :role, :company, :url, :description, :notes, :source, 'SAVED',
                    :location, :salary, :work_type, :experience_level, NOW(), NOW())
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
                "location": data.location,
                "salary": data.salary,
                "work_type": data.work_type,
                "experience_level": data.experience_level,
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


class SaveAnswerData(BaseModel):
    question_hash: str
    question_text: str
    answer: str
    source: Optional[str] = "ai"
    category: Optional[str] = None


@router.post("/save-answer")
async def save_answer_memory(
    data: SaveAnswerData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a user-confirmed answer for a recurring question."""
    try:
        import uuid
        now = datetime.now(timezone.utc)
        existing = await db.execute(
            text("SELECT id, use_count FROM answer_memory WHERE user_id = :uid AND question_hash = :qh"),
            {"uid": current_user.id, "qh": data.question_hash},
        )
        row = existing.first()
        if row:
            await db.execute(
                text("""UPDATE answer_memory SET answer = :answer, question_text = :qt, source = :src,
                        category = :cat, use_count = :uc, updated_at = :now
                        WHERE user_id = :uid AND question_hash = :qh"""),
                {"uid": current_user.id, "qh": data.question_hash, "answer": data.answer,
                 "qt": data.question_text, "src": data.source, "cat": data.category,
                 "uc": (row[1] or 0) + 1, "now": now},
            )
        else:
            await db.execute(
                text("""INSERT INTO answer_memory (id, user_id, question_hash, question_text, answer, source, category, use_count, created_at, updated_at)
                        VALUES (:id, :uid, :qh, :qt, :answer, :src, :cat, 1, :now, :now)"""),
                {"id": str(uuid.uuid4()), "uid": current_user.id, "qh": data.question_hash,
                 "qt": data.question_text, "answer": data.answer, "src": data.source,
                 "cat": data.category, "now": now},
            )
        await db.commit()
        return {"status": "saved"}
    except Exception as e:
        print(f"[Extension] save-answer error: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/answers")
async def list_answer_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all saved answers for this user."""
    try:
        result = await db.execute(
            text("SELECT * FROM answer_memory WHERE user_id = :uid ORDER BY updated_at DESC"),
            {"uid": current_user.id},
        )
        rows = result.mappings().all()
        return [
            {
                "id": r.get("id"),
                "questionHash": r.get("question_hash"),
                "questionText": r.get("question_text"),
                "answer": r.get("answer"),
                "source": r.get("source", "ai"),
                "category": r.get("category"),
                "useCount": r.get("use_count", 1),
                "updatedAt": r["updated_at"].isoformat() if r.get("updated_at") else None,
            }
            for r in rows
        ]
    except Exception:
        return []


@router.patch("/answers/{answer_id}")
async def update_answer(
    answer_id: str,
    data: SaveAnswerData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a saved answer."""
    try:
        await db.execute(
            text("UPDATE answer_memory SET answer = :answer, source = 'edited', updated_at = NOW() WHERE id = :id AND user_id = :uid"),
            {"id": answer_id, "uid": current_user.id, "answer": data.answer},
        )
        await db.commit()
        return {"status": "updated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.delete("/answers/{answer_id}", status_code=204)
async def delete_answer(
    answer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a saved answer."""
    await db.execute(
        text("DELETE FROM answer_memory WHERE id = :id AND user_id = :uid"),
        {"id": answer_id, "uid": current_user.id},
    )
    await db.commit()


class AutofillSessionData(BaseModel):
    portal_domain: Optional[str] = None
    portal_name: Optional[str] = None    # detected portal (greenhouse, workday, etc.)
    job_title: Optional[str] = None
    company: Optional[str] = None
    fields_total: int = 0
    fields_filled: int = 0
    fields_review: int = 0
    fields_failed: int = 0
    fields_ai: int = 0
    fields_memory: int = 0
    fields_option: int = 0               # option-based fields (select/radio) filled
    upload_interrupted: bool = False       # did we pause for file upload?
    submit_ready: bool = False             # was submit bar shown?
    readiness_score: int = 0
    duration_ms: int = 0


@router.post("/autofill-session")
async def save_autofill_session(
    data: AutofillSessionData,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Track an autofill session for analytics."""
    try:
        import uuid
        await db.execute(
            text("""INSERT INTO autofill_sessions (id, user_id, portal_domain, job_title, company,
                    fields_total, fields_filled, fields_review, fields_failed, fields_ai, fields_memory,
                    readiness_score, duration_ms, created_at)
                    VALUES (:id, :uid, :domain, :title, :company, :total, :filled, :review, :failed,
                    :ai, :memory, :readiness, :duration, NOW())"""),
            {"id": str(uuid.uuid4()), "uid": current_user.id, "domain": data.portal_domain,
             "title": data.job_title, "company": data.company, "total": data.fields_total,
             "filled": data.fields_filled, "review": data.fields_review, "failed": data.fields_failed,
             "ai": data.fields_ai, "memory": data.fields_memory, "readiness": data.readiness_score,
             "duration": data.duration_ms},
        )
        await db.commit()
        return {"status": "saved"}
    except Exception as e:
        print(f"[Extension] autofill-session error: {e}")
        return {"status": "error"}


@router.get("/autofill-stats")
async def get_autofill_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get autofill analytics for this user."""
    try:
        result = await db.execute(
            text("""SELECT
                    COUNT(*) as total_sessions,
                    COALESCE(SUM(fields_filled), 0) as total_filled,
                    COALESCE(SUM(fields_review), 0) as total_review,
                    COALESCE(SUM(fields_ai), 0) as total_ai,
                    COALESCE(SUM(fields_memory), 0) as total_memory,
                    COALESCE(SUM(fields_failed), 0) as total_failed,
                    COALESCE(AVG(readiness_score), 0) as avg_readiness,
                    COALESCE(SUM(duration_ms), 0) as total_duration_ms
                    FROM autofill_sessions WHERE user_id = :uid"""),
            {"uid": current_user.id},
        )
        row = result.mappings().first()
        if not row:
            return {"totalSessions": 0}

        # Estimate time saved: ~2 min per manual field vs ~2 sec autofill
        total_filled = row.get("total_filled", 0)
        time_saved_min = round(total_filled * 1.5)  # ~1.5 min saved per field

        # Portal success rate breakdown
        portal_result = await db.execute(
            text("""SELECT portal_domain,
                    COUNT(*) as sessions,
                    COALESCE(AVG(CASE WHEN fields_total > 0 THEN fields_filled * 100.0 / fields_total ELSE 0 END), 0) as success_rate
                    FROM autofill_sessions WHERE user_id = :uid
                    GROUP BY portal_domain ORDER BY sessions DESC LIMIT 10"""),
            {"uid": current_user.id},
        )
        portal_stats = [
            {"portal": r.get("portal_domain", ""), "sessions": r.get("sessions", 0),
             "successRate": round(float(r.get("success_rate", 0)))}
            for r in portal_result.mappings()
        ]

        return {
            "totalSessions": row.get("total_sessions", 0),
            "totalFieldsFilled": total_filled,
            "totalFieldsReview": row.get("total_review", 0),
            "totalAIAnswers": row.get("total_ai", 0),
            "totalMemoryReused": row.get("total_memory", 0),
            "totalFailed": row.get("total_failed", 0),
            "avgReadiness": round(float(row.get("avg_readiness", 0))),
            "estimatedTimeSavedMin": time_saved_min,
            "portalStats": portal_stats,
        }
    except Exception:
        return {"totalSessions": 0}


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

        desc = (data.description or "")[:15000]
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

        # Application preferences — from user's saved settings only
        defaults = {
            "workAuthType": "",
            "workAuthorization": "",
            "sponsorship": "",
            "visaStatus": "",
            "relocation": "",
            "pronouns": "",
            "gender": "",
            "veteranStatus": "",
            "disabilityStatus": "",
            "hispanicLatino": "",
            "race": "",
            "earliestStart": "",
            "interviewedBefore": "",
            "aiPolicyAcknowledge": "Yes",
        }
        for key in defaults:
            if key in app_info and app_info[key]:
                defaults[key] = app_info[key]

        # Deterministic Tier 1: derive work auth + sponsorship from workAuthType
        auth_type = defaults.get("workAuthType", "")
        if auth_type:
            # Only auto-derive work authorization — NOT sponsorship (user must choose separately)
            AUTH_MAP = {
                "us_citizen":     {"workAuthorization": "Yes", "visaStatus": "U.S. Citizen"},
                "green_card":     {"workAuthorization": "Yes", "visaStatus": "U.S. Permanent Resident"},
                "opt":            {"workAuthorization": "Yes", "visaStatus": "OPT"},
                "stem_opt":       {"workAuthorization": "Yes", "visaStatus": "STEM OPT"},
                "h1b":            {"workAuthorization": "Yes", "visaStatus": "H-1B"},
                "o1":             {"workAuthorization": "Yes", "visaStatus": "O-1"},
                "other_visa":     {"workAuthorization": "Yes", "visaStatus": "Other Visa"},
                "not_authorized": {"workAuthorization": "No",  "visaStatus": ""},
            }
            derived = AUTH_MAP.get(auth_type, {})
            defaults["workAuthorization"] = derived.get("workAuthorization", defaults["workAuthorization"])
            defaults["visaStatus"] = derived.get("visaStatus", defaults["visaStatus"])
            # Sponsorship: only auto-set for citizen/green card (definitively "No")
            # For all visa types: use the user's explicitly saved preference
            if auth_type in ("us_citizen", "green_card"):
                defaults["sponsorship"] = "No"
            # Otherwise keep whatever the user saved in preferences

        # Load saved answer memory (Tier 2 recurring answers)
        answer_memory = {}
        try:
            am_result = await db.execute(
                text("SELECT question_hash, answer FROM answer_memory WHERE user_id = :uid"),
                {"uid": current_user.id},
            )
            for row in am_result.mappings().all():
                answer_memory[row["question_hash"]] = row["answer"]
        except Exception:
            pass

        # Calculate autofill readiness score
        readiness_fields = {
            "firstName": bool(first_name),
            "lastName": bool(last_name),
            "email": bool(email),
            "phone": bool(phone),
            "location": bool(location),
            "linkedin": bool(linkedin),
            "workAuthType": bool(defaults.get("workAuthType")),
            "resumeUploaded": False,
        }
        # Check if user has at least one resume
        try:
            resume_check = await db.execute(
                text("SELECT COUNT(*) FROM resumes WHERE user_id = :uid"),
                {"uid": current_user.id},
            )
            readiness_fields["resumeUploaded"] = (resume_check.scalar() or 0) > 0
        except Exception:
            pass

        readiness_score = sum(1 for v in readiness_fields.values() if v)
        readiness_total = len(readiness_fields)
        readiness_pct = round((readiness_score / readiness_total) * 100)

        # US metro area detection from location
        metro_area = ""
        loc_lower = location.lower() if location else ""
        METRO_MAP = {
            "dfw": ["dallas", "fort worth", "arlington, tx", "arlington, texas", "irving", "plano", "frisco", "mckinney", "denton", "garland", "mesquite", "grand prairie"],
            "bay_area": ["san francisco", "san jose", "oakland", "palo alto", "mountain view", "sunnyvale", "santa clara", "fremont", "redwood", "menlo park", "cupertino"],
            "nyc": ["new york", "manhattan", "brooklyn", "queens", "bronx", "jersey city", "hoboken"],
            "seattle": ["seattle", "bellevue", "redmond", "kirkland", "tacoma"],
            "la": ["los angeles", "santa monica", "pasadena", "long beach", "burbank", "glendale"],
            "chicago": ["chicago", "evanston", "naperville", "schaumburg"],
            "boston": ["boston", "cambridge", "somerville", "brookline"],
            "dc": ["washington dc", "washington, dc", "arlington, va", "bethesda", "reston", "mclean"],
            "austin": ["austin", "round rock", "cedar park"],
            "denver": ["denver", "boulder", "aurora", "lakewood"],
        }
        for metro, cities in METRO_MAP.items():
            if any(city in loc_lower for city in cities):
                metro_area = metro
                break

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
            "metroArea": metro_area,
            "answerMemory": answer_memory,
            "readiness": {
                "score": readiness_pct,
                "fields": readiness_fields,
                "missing": [k for k, v in readiness_fields.items() if not v],
            },
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
        if not isinstance(content, dict):
            content = {}

        # ALWAYS enrich from profile — profile tables are the source of truth
        # Resume content JSON may be stale, truncated, or corrupted from old parser runs
        if True:  # Always run enrichment
            # Try to rebuild from the latest valid resume version
            try:
                ver_result = await db.execute(
                    text("""SELECT content FROM resume_versions WHERE resume_id = :rid
                            AND content IS NOT NULL ORDER BY created_at DESC"""),
                    {"rid": resume_id},
                )
                for ver_row in ver_result.mappings().all():
                    ver_content = ver_row.get("content")
                    if isinstance(ver_content, str):
                        ver_content = json.loads(ver_content)
                    if isinstance(ver_content, dict) and ver_content.get("experiences"):
                        content = ver_content
                        break
            except Exception:
                pass

            # Enrich from user profile — add experiences, education, projects from profile tables
            try:
                user_result = await db.execute(
                    text("SELECT full_name, first_name, last_name, email FROM users WHERE id = :uid"),
                    {"uid": current_user.id},
                )
                u = user_result.mappings().first()
                if u:
                    if not content.get("name"):
                        content["name"] = u.get("full_name") or f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                    # Only use account email if resume has NO email at all
                    if not content.get("email"):
                        content["email"] = u.get("email", "")

                profile_result = await db.execute(
                    text("SELECT * FROM profiles WHERE user_id = :uid"),
                    {"uid": current_user.id},
                )
                p = profile_result.mappings().first()
                if p:
                    if not content.get("phone"): content["phone"] = p.get("phone", "")
                    if not content.get("location"): content["location"] = p.get("location", "")
                    if not content.get("linkedin"): content["linkedin"] = p.get("linkedin", "")
                    if not content.get("summary"): content["summary"] = p.get("summary") or p.get("headline") or ""

                    profile_id = p.get("id")
                    if profile_id:
                        # Load experiences from profile ONLY if resume content has none
                        # After tailoring, resume content has rewritten bullets — preserve them
                        try:
                            exp_result = await db.execute(
                                text("SELECT * FROM work_experiences WHERE profile_id = :pid ORDER BY sort_order, start_date DESC"),
                                {"pid": profile_id},
                            )
                            profile_exps = exp_result.mappings().all()
                            if profile_exps and not content.get("experiences"):
                                # Only use profile experiences if resume content has none
                                # After tailoring, resume content has rewritten bullets — preserve them
                                seen_exp = set()
                                exps = []
                                for e in profile_exps:
                                    key = f"{(e.get('company','') or '').lower()}|{(e.get('title','') or '').lower()}"
                                    if key in seen_exp:
                                        continue
                                    seen_exp.add(key)
                                    exps.append({
                                        "title": e.get("title", ""),
                                        "company": e.get("company", ""),
                                        "location": e.get("location", ""),
                                        "start_date": str(e["start_date"]) if e.get("start_date") else "",
                                        "end_date": str(e["end_date"]) if e.get("end_date") else "",
                                    "current": e.get("current", False),
                                    "bullets": e.get("bullets") or [],
                                    "skills_used": e.get("skills_used") or [],
                                })
                                if exps: content["experiences"] = exps
                        except Exception as exp_err:
                            print(f"[Export] Experience load error: {exp_err}")

                        # Load education from profile
                        if not content.get("educations"):
                            edu_result = await db.execute(
                                text("SELECT * FROM educations WHERE profile_id = :pid ORDER BY sort_order"),
                                {"pid": profile_id},
                            )
                            edus = []
                            for ed in edu_result.mappings().all():
                                edus.append({
                                    "degree": ed.get("degree", ""),
                                    "field": ed.get("field", ""),
                                    "school": ed.get("school", ""),
                                    "end_date": str(ed["end_date"]) if ed.get("end_date") else "",
                                    "gpa": ed.get("gpa", ""),
                                })
                            if edus: content["educations"] = edus

                        # Load projects from profile
                        if not content.get("projects"):
                            proj_result = await db.execute(
                                text("SELECT * FROM projects WHERE profile_id = :pid ORDER BY sort_order"),
                                {"pid": profile_id},
                            )
                            projs = []
                            for pr in proj_result.mappings().all():
                                projs.append({
                                    "name": pr.get("name", ""),
                                    "description": pr.get("description", ""),
                                    "bullets": pr.get("bullets") or [],
                                    "skills": pr.get("skills") or [],
                                })
                            if projs: content["projects"] = projs
            except Exception as e:
                print(f"[Export] Profile enrichment error: {e}")

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


# ═══════════════════════════════════════════════════════════════════════════
# BETA ACCESS SYSTEM
# ═══════════════════════════════════════════════════════════════════════════

class BetaVerifyRequest(BaseModel):
    invite_code: str
    device_id: Optional[str] = None


@router.post("/beta/verify")
async def verify_beta_access(
    data: BetaVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify invite code and grant beta access. Called by extension on startup."""
    import uuid

    code = data.invite_code.strip().upper()

    # Check if user already has active beta access
    existing = await db.execute(
        text("SELECT id, status FROM beta_access WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    existing_row = existing.mappings().first()
    if existing_row:
        if existing_row["status"] == "active":
            # Already approved — update last_verified
            await db.execute(
                text("UPDATE beta_access SET last_verified_at = NOW() WHERE user_id = :uid"),
                {"uid": current_user.id},
            )
            await db.commit()
            return {"approved": True, "status": "active", "message": "Beta access active"}
        elif existing_row["status"] == "disabled":
            return {"approved": False, "status": "disabled", "message": "Beta access has been revoked"}

    # Look up invite code
    invite = await db.execute(
        text("""SELECT id, code, status, expires_at, redeemed_by, device_id
                FROM beta_invites WHERE code = :code"""),
        {"code": code},
    )
    invite_row = invite.mappings().first()

    if not invite_row:
        return {"approved": False, "message": "Invalid invite code"}
    if invite_row["status"] == "revoked":
        return {"approved": False, "message": "This invite code has been revoked"}
    if invite_row["redeemed_by"] and invite_row["redeemed_by"] != current_user.id:
        return {"approved": False, "message": "This invite code has already been used"}
    if invite_row["expires_at"] and invite_row["expires_at"] < datetime.now(timezone.utc):
        return {"approved": False, "message": "This invite code has expired"}

    # Check device binding — if invite was already used from a different device
    if invite_row["device_id"] and data.device_id and invite_row["device_id"] != data.device_id:
        return {"approved": False, "message": "This invite code is bound to another device"}

    # Check total beta user limit (25)
    count_result = await db.execute(
        text("SELECT COUNT(*) as cnt FROM beta_access WHERE status = 'active'")
    )
    active_count = count_result.mappings().first()["cnt"]
    if active_count >= 25:
        return {"approved": False, "message": "Beta is full (25/25 users). Please try again later."}

    # Redeem the invite
    await db.execute(
        text("""UPDATE beta_invites SET redeemed_by = :uid, redeemed_at = NOW(),
                device_id = :did, status = 'redeemed' WHERE id = :id"""),
        {"uid": current_user.id, "did": data.device_id, "id": invite_row["id"]},
    )

    # Create beta access record
    await db.execute(
        text("""INSERT INTO beta_access (id, user_id, invite_id, device_id, status, last_verified_at, created_at)
                VALUES (:id, :uid, :iid, :did, 'active', NOW(), NOW())"""),
        {"id": str(uuid.uuid4()), "uid": current_user.id, "iid": invite_row["id"], "did": data.device_id},
    )
    await db.commit()

    return {"approved": True, "status": "active", "message": "Beta access granted!"}


@router.get("/beta/check")
async def check_beta_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Periodic check — extension calls every 10 min. Returns current access status + kill switch."""
    result = await db.execute(
        text("SELECT status, disabled_reason FROM beta_access WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    row = result.mappings().first()

    if not row:
        return {"approved": False, "status": "no_access", "kill": False}

    if row["status"] == "disabled":
        return {"approved": False, "status": "disabled", "kill": True, "reason": row.get("disabled_reason", "")}

    # Check global kill switch
    kill_result = await db.execute(
        text("SELECT enabled FROM feature_flags WHERE name = 'beta_active'")
    )
    kill_row = kill_result.mappings().first()
    if kill_row and not kill_row["enabled"]:
        return {"approved": False, "status": "beta_paused", "kill": True, "reason": "Beta is temporarily paused"}

    # Update last verified
    await db.execute(
        text("UPDATE beta_access SET last_verified_at = NOW() WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    await db.commit()

    return {"approved": True, "status": "active", "kill": False}
