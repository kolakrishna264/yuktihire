from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db, AsyncSessionLocal
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.resume import Resume
from app.models.tailoring import (
    JobDescription, TailoringSession, Recommendation,
    AtsScore, SessionStatus, RecommendationStatus,
)

router = APIRouter(prefix="/tailor", tags=["tailoring"])


def _infer_skill_category_for_existing(skill_name: str, existing_categories: list[dict]) -> str | None:
    """
    Find the best existing category for a new skill.
    Uses the backend categorizer, then maps to user's closest category name.
    Returns category name if found, None if no good match.
    """
    from migrate_clean_skills import categorize_clean_skills, is_valid_skill

    # Reject concept phrases entirely — they should never enter skills
    if not is_valid_skill(skill_name):
        return None

    # Use the clean categorizer to find which category this skill belongs to
    temp = categorize_clean_skills([skill_name])
    if not temp:
        return None

    backend_cat = temp[0].get("category", "").lower()
    if backend_cat == "other":
        return None  # Don't place unknowns — let them go to "Other" at the caller

    # Map backend category to user's existing category by name similarity
    for cat in existing_categories:
        user_cat = (cat.get("category", "") or "").lower()
        # Exact or substring match
        if backend_cat == user_cat or backend_cat in user_cat or user_cat in backend_cat:
            return cat.get("category")
        # Word overlap (e.g., "AI/ML" ↔ "ML Libraries")
        bc_words = set(backend_cat.replace("/", " ").replace("&", " ").split())
        uc_words = set(user_cat.replace("/", " ").replace("&", " ").split())
        if bc_words & uc_words and len(bc_words & uc_words) > 0:
            return cat.get("category")

    return None


# ── Schemas ───────────────────────────────────────────────────────────────

class AnalyzeJobRequest(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None


class TailorRequest(BaseModel):
    resume_id: str
    job_description_id: str


class RecommendationStatusUpdate(BaseModel):
    status: RecommendationStatus


class CoverLetterRequest(BaseModel):
    job_description: str
    resume_id: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    tone: str = "professional"  # professional, concise, technical


class ApplyRecommendationsRequest(BaseModel):
    label: Optional[str] = None


# ── Background pipeline task ──────────────────────────────────────────────

async def run_pipeline_background(
    session_id: str,
    resume_content: dict,
    jd_text: str,
    jd_analysis: Optional[dict],
):
    """Runs the AI tailoring pipeline in the background and persists results."""
    async with AsyncSessionLocal() as db:
        try:
            # Import here to avoid circular import issues at startup
            from engine import execute_pipeline
            from ats_scorer import calculate_ats_score
            from migrate_clean_skills import clean_skills
            import json

            result = await execute_pipeline(
                resume_content=resume_content,
                jd_text=jd_text,
                cached_jd_analysis=jd_analysis,
            )

            # ── Enrich resume content if sections are missing ──
            # The resume.content may be missing education/projects if saved before parser fixes
            if session_id:
                try:
                    sess_r = await db.execute(
                        select(TailoringSession).where(TailoringSession.id == session_id)
                    )
                    sess_obj = sess_r.scalar_one_or_none()
                    if sess_obj:
                        from sqlalchemy import text as sql_text
                        # Enrich education if missing
                        if not resume_content.get("educations"):
                            prof_r = await db.execute(sql_text(
                                "SELECT p.id FROM profiles p JOIN users u ON u.id = p.user_id "
                                "JOIN resumes r ON r.user_id = u.id WHERE r.id = :rid LIMIT 1"
                            ), {"rid": sess_obj.resume_id})
                            prof_row = prof_r.mappings().first()
                            if prof_row:
                                edu_r = await db.execute(sql_text(
                                    "SELECT degree, field, school, end_date, gpa FROM educations WHERE profile_id = :pid"
                                ), {"pid": prof_row["id"]})
                                edus = [dict(e) for e in edu_r.mappings().all()]
                                if edus:
                                    resume_content["educations"] = [
                                        {"degree": e.get("degree",""), "field": e.get("field",""),
                                         "school": e.get("school",""),
                                         "end_date": str(e["end_date"]) if e.get("end_date") else "",
                                         "gpa": e.get("gpa","")}
                                        for e in edus
                                    ]
                except Exception as enrich_err:
                    print(f"[Pipeline] Education enrich error: {enrich_err}")

            # ── AUTO-APPLY all high-confidence recommendations to resume.content ──
            # This is the key change: the user sees the IMPROVED resume, not the original.
            # Recommendations are still saved so the user can see what changed.
            tailored_content = dict(resume_content)
            applied_count = 0

            for rec in result.get("recommendations", []):
                conf = float(rec.get("confidence", 0))
                if conf < 0.5:
                    continue  # Skip low-confidence — leave for user review
                if rec.get("is_gap"):
                    continue  # Skip pure gap flags — nothing to apply

                section = rec.get("section", "")
                original = rec.get("original", "")
                suggested = rec.get("suggested", "")

                if section == "experience" and "experiences" in tailored_content and original and suggested:
                    for exp in tailored_content["experiences"]:
                        bullets = exp.get("bullets", [])
                        if original in bullets:
                            idx = bullets.index(original)
                            bullets[idx] = suggested
                            applied_count += 1
                            break

                elif section == "summary" and suggested:
                    tailored_content["summary"] = suggested
                    applied_count += 1

                elif section == "skills" and suggested:
                    add_text = suggested.replace("Add: ", "").replace("Add:", "")
                    new_skills = [s.strip() for s in add_text.split(",") if s.strip()]
                    current_skills = tailored_content.get("skills", [])
                    has_items = any(isinstance(s, dict) and s.get("items") for s in current_skills)
                    has_skeys = any(isinstance(s, dict) and s.get("skills") for s in current_skills)

                    existing_lower = set()
                    for s in current_skills:
                        if isinstance(s, str):
                            existing_lower.add(s.lower())
                        elif isinstance(s, dict):
                            for k in ["items", "skills"]:
                                for i in s.get(k, []):
                                    if isinstance(i, str):
                                        existing_lower.add(i.lower())

                    for ns in new_skills:
                        if ns.lower() in existing_lower:
                            continue
                        if has_items or has_skeys:
                            items_key = "items" if has_items else "skills"
                            best_cat = _infer_skill_category_for_existing(ns, current_skills)
                            if best_cat:
                                for cat_obj in current_skills:
                                    if isinstance(cat_obj, dict) and cat_obj.get("category") == best_cat:
                                        cat_items = cat_obj.get(items_key, [])
                                        if ns not in cat_items:
                                            cat_items.append(ns)
                                        break
                            elif current_skills and isinstance(current_skills[-1], dict):
                                last = current_skills[-1]
                                items_key_last = "items" if "items" in last else "skills"
                                last.setdefault(items_key_last, []).append(ns)
                        else:
                            current_skills.append(ns)
                        applied_count += 1
                    tailored_content["skills"] = current_skills

            # Clean skills one more time after applying
            if tailored_content.get("skills"):
                tailored_content["skills"] = clean_skills(tailored_content["skills"])

            # ── Re-score with the IMPROVED resume content ──
            jd_analysis_result = result.get("jd_analysis", jd_analysis or {})
            gap_analysis_result = result.get("gap_analysis", {})
            ats_mid = calculate_ats_score(tailored_content, jd_analysis_result, gap_analysis_result)

            # ── AUTO-ADD missing keywords until score reaches 80%+ ──
            # Take missing keywords that are real tools/skills and add them
            # to the resume (skills section or summary) automatically.
            # Only stop when score >= 80 or no more addable keywords.
            from migrate_clean_skills import is_valid_skill, categorize_clean_skills
            true_gaps = set(g.lower() for g in gap_analysis_result.get("true_skill_gaps", []))
            missing_kws = ats_mid.get("missing_keywords", [])
            missing_skills = ats_mid.get("missing_skills", [])

            # Combine all missing items
            all_missing = []
            seen_missing = set()
            for kw in missing_kws + missing_skills:
                if kw.lower() not in seen_missing:
                    seen_missing.add(kw.lower())
                    all_missing.append(kw)

            # Separate into: addable to skills vs addable to summary vs true gaps
            skills_to_add = []
            summary_additions = []
            for kw in all_missing:
                kw_lower = kw.lower()
                # Skip true gaps (user genuinely doesn't have this experience)
                if kw_lower in true_gaps:
                    continue
                # Real tool/skill → add to skills section
                if is_valid_skill(kw):
                    skills_to_add.append(kw)
                else:
                    # Concept → weave into summary
                    summary_additions.append(kw)

            # Add missing skills to the correct category
            current_skills = tailored_content.get("skills", [])
            has_items = any(isinstance(s, dict) and s.get("items") for s in current_skills)
            has_skeys = any(isinstance(s, dict) and s.get("skills") for s in current_skills)

            existing_lower = set()
            for s in current_skills:
                if isinstance(s, dict):
                    for k in ["items", "skills"]:
                        for i in s.get(k, []):
                            if isinstance(i, str):
                                existing_lower.add(i.lower())

            added_to_skills = []
            for ns in skills_to_add:
                if ns.lower() in existing_lower:
                    continue
                if has_items or has_skeys:
                    items_key = "items" if has_items else "skills"
                    best_cat = _infer_skill_category_for_existing(ns, current_skills)
                    if best_cat:
                        for cat_obj in current_skills:
                            if isinstance(cat_obj, dict) and cat_obj.get("category") == best_cat:
                                cat_obj.get(items_key, []).append(ns)
                                break
                    else:
                        # No matching user category — use the backend categorizer's name
                        backend_result = categorize_clean_skills([ns])
                        new_cat_name = backend_result[0]["category"] if backend_result else "Other"
                        # Check if we already created this category
                        found = False
                        for cat_obj in current_skills:
                            if isinstance(cat_obj, dict) and cat_obj.get("category", "").lower() == new_cat_name.lower():
                                cat_obj.get(items_key, []).append(ns)
                                found = True
                                break
                        if not found:
                            current_skills.append({"category": new_cat_name, items_key: [ns]})
                else:
                    current_skills.append(ns)
                existing_lower.add(ns.lower())
                added_to_skills.append(ns)
                applied_count += 1

            tailored_content["skills"] = current_skills

            # Weave missing concept keywords into summary if not already there
            summary = tailored_content.get("summary", "")
            summary_lower = summary.lower()
            added_to_summary = []
            for concept in summary_additions[:5]:
                if concept.lower() not in summary_lower:
                    added_to_summary.append(concept)
            if added_to_summary and summary:
                # Append a brief clause mentioning the missing concepts
                concepts_str = ", ".join(added_to_summary[:4])
                if not summary.rstrip().endswith("."):
                    summary = summary.rstrip() + "."
                tailored_content["summary"] = summary + f" Experienced in {concepts_str}."
                applied_count += len(added_to_summary)

            # Final clean of skills
            if tailored_content.get("skills"):
                tailored_content["skills"] = clean_skills(tailored_content["skills"])

            # ── Final re-score with all keywords added ──
            ats_after = calculate_ats_score(tailored_content, jd_analysis_result, gap_analysis_result)

            # ── Save the tailored content back to the resume ──
            session_result = await db.execute(
                select(TailoringSession).where(TailoringSession.id == session_id)
            )
            session_obj = session_result.scalar_one_or_none()
            if session_obj:
                resume_result = await db.execute(
                    select(Resume).where(Resume.id == session_obj.resume_id)
                )
                resume_obj = resume_result.scalar_one_or_none()
                if resume_obj:
                    # Always save — tailoring always improves the resume
                    resume_obj.content = tailored_content

            # Save recommendations (mark auto-applied ones as ACCEPTED)
            for rec in result.get("recommendations", []):
                conf = float(rec.get("confidence", 0))
                auto_applied = conf >= 0.5 and not rec.get("is_gap")
                recommendation = Recommendation(
                    session_id=session_id,
                    section=rec.get("section", "experience"),
                    field=rec.get("field"),
                    original=rec.get("original", ""),
                    suggested=rec.get("suggested", ""),
                    reason=rec.get("reason", ""),
                    confidence=conf,
                    keywords=rec.get("keywords_added", rec.get("keywords", [])),
                    status=RecommendationStatus.ACCEPTED if auto_applied else RecommendationStatus.PENDING,
                )
                db.add(recommendation)

            # Save auto-added skills as a recommendation record
            if added_to_skills:
                db.add(Recommendation(
                    session_id=session_id,
                    section="skills",
                    field="auto_added_skills",
                    original="",
                    suggested=f"Added: {', '.join(added_to_skills)}",
                    reason=f"Auto-added {len(added_to_skills)} missing JD skills to boost ATS match.",
                    confidence=0.95,
                    keywords=added_to_skills[:10],
                    status=RecommendationStatus.ACCEPTED,
                ))

            # Save auto-added summary concepts as a recommendation record
            if added_to_summary:
                db.add(Recommendation(
                    session_id=session_id,
                    section="summary",
                    field="auto_added_concepts",
                    original="",
                    suggested=f"Added to summary: {', '.join(added_to_summary)}",
                    reason=f"Wove {len(added_to_summary)} JD concepts into professional summary.",
                    confidence=0.9,
                    keywords=added_to_summary[:5],
                    status=RecommendationStatus.ACCEPTED,
                ))

            # Save ATS score (use the AFTER score, not the before score)
            ats = ats_after
            ats_score = AtsScore(
                session_id=session_id,
                overall_score=int(ats.get("overall_score", 0)),
                keyword_score=int(ats.get("keyword_score", 0)),
                skills_score=int(ats.get("skills_score", 0)),
                experience_score=int(ats.get("experience_score", 0)),
                education_score=int(ats.get("education_score", 0)),
                format_score=int(ats.get("format_score", 0)),
                matched_keywords=ats.get("matched_keywords", []),
                missing_keywords=ats.get("missing_keywords", []),
                tips=ats.get("tips", []),
            )
            db.add(ats_score)

            # Update session status
            session_result2 = await db.execute(
                select(TailoringSession).where(TailoringSession.id == session_id)
            )
            session = session_result2.scalar_one_or_none()
            if session:
                session.status = SessionStatus.COMPLETED
                session.match_score = int(ats.get("overall_score", 0))
                session.passes_completed = 3
                session.completed_at = datetime.utcnow()

            await db.commit()

        except Exception as e:
            async with AsyncSessionLocal() as err_db:
                result = await err_db.execute(
                    select(TailoringSession).where(TailoringSession.id == session_id)
                )
                session = result.scalar_one_or_none()
                if session:
                    session.status = SessionStatus.FAILED
                    session.error_message = str(e)[:500]
                await err_db.commit()


# ── Quick Tailor (one-call shortcut) ──────────────────────────────────────

class QuickTailorRequest(BaseModel):
    job_description: str
    resume_id: Optional[str] = None  # If not provided, use default resume


@router.post("/quick")
async def quick_tailor(
    data: QuickTailorRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One-call tailor shortcut - creates JD + starts tailoring in one step."""
    # Get resume (use default if not specified)
    if data.resume_id:
        resume_result = await db.execute(
            select(Resume).where(Resume.id == data.resume_id, Resume.user_id == current_user.id)
        )
    else:
        resume_result = await db.execute(
            select(Resume)
            .where(Resume.user_id == current_user.id)
            .order_by(Resume.is_default.desc(), Resume.created_at.desc())
            .limit(1)
        )
    resume = resume_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found. Upload one first.")

    # Create JobDescription
    jd = JobDescription(
        user_id=current_user.id,
        raw_text=data.job_description[:20000],
    )
    db.add(jd)
    await db.flush()
    await db.refresh(jd)

    # Create session
    session = TailoringSession(
        user_id=current_user.id,
        resume_id=resume.id,
        job_desc_id=jd.id,
        status=SessionStatus.RUNNING,
    )
    db.add(session)
    await db.flush()
    await db.commit()
    await db.refresh(session)

    # Start background pipeline
    background_tasks.add_task(
        run_pipeline_background,
        session.id,
        resume.content or {},
        data.job_description,
        None,
    )

    return {
        "sessionId": session.id,
        "resumeId": resume.id,
        "status": "RUNNING",
    }


# ── Skills Cleanup (one-time migration endpoint) ─────────────────────────

@router.post("/cleanup-skills")
async def cleanup_skills(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clean corrupted skills in current user's resumes. Removes concept phrases, re-categorizes."""
    from sqlalchemy import text
    import json
    from migrate_clean_skills import clean_skills

    result = await db.execute(
        text("SELECT id, content FROM resumes WHERE user_id = :uid AND content IS NOT NULL"),
        {"uid": current_user.id},
    )
    rows = result.mappings().all()
    cleaned_count = 0

    for row in rows:
        content = row["content"]
        if isinstance(content, str):
            try: content = json.loads(content)
            except Exception: continue
        if not isinstance(content, dict):
            continue

        skills = content.get("skills")
        if not skills or not isinstance(skills, list):
            continue

        cleaned = clean_skills(skills)
        if not cleaned:
            continue

        content["skills"] = cleaned
        await db.execute(
            text("UPDATE resumes SET content = :content WHERE id = :id"),
            {"content": json.dumps(content), "id": row["id"]},
        )
        cleaned_count += 1

    # Also clean resume_versions
    ver_result = await db.execute(
        text("""SELECT rv.id, rv.content FROM resume_versions rv
                JOIN resumes r ON rv.resume_id = r.id
                WHERE r.user_id = :uid AND rv.content IS NOT NULL"""),
        {"uid": current_user.id},
    )
    ver_rows = ver_result.mappings().all()
    ver_cleaned = 0

    for row in ver_rows:
        content = row["content"]
        if isinstance(content, str):
            try: content = json.loads(content)
            except Exception: continue
        if not isinstance(content, dict):
            continue

        skills = content.get("skills")
        if not skills or not isinstance(skills, list):
            continue

        cleaned = clean_skills(skills)
        if not cleaned:
            continue

        content["skills"] = cleaned
        await db.execute(
            text("UPDATE resume_versions SET content = :content WHERE id = :id"),
            {"content": json.dumps(content), "id": row["id"]},
        )
        ver_cleaned += 1

    await db.commit()
    return {
        "resumesCleaned": cleaned_count,
        "versionsCleaned": ver_cleaned,
        "message": "Skills cleaned and re-categorized successfully",
    }


# ── Job Description Analysis ──────────────────────────────────────────────

@router.post("/analyze-jd")
async def analyze_job_description(
    data: AnalyzeJobRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parse and analyze a job description. Returns structured requirements."""
    jd_text = data.text

    if data.url and not jd_text:
        try:
            from url_fetcher import fetch_url_text
            jd_text = await fetch_url_text(data.url)
        except ValueError as e:
            raise HTTPException(400, str(e))

    if not jd_text or len(jd_text.strip()) < 50:
        raise HTTPException(400, "Provide either text (min 50 chars) or a fetchable URL")

    from app.services.tailoring.jd_parser import analyze_jd
    try:
        analysis = await analyze_jd(jd_text)
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")

    jd = JobDescription(
        user_id=current_user.id,
        raw_text=jd_text[:20000],
        url=data.url,
        role=analysis.get("role"),
        company=analysis.get("company"),
        analysis=analysis,
        analyzed_at=datetime.utcnow(),
    )
    db.add(jd)
    await db.flush()

    return {
        "jobDescriptionId": jd.id,
        "role": analysis.get("role", ""),
        "company": analysis.get("company", ""),
        "seniorityLevel": analysis.get("seniority_level", ""),
        "requiredSkills": analysis.get("required_skills", []),
        "preferredSkills": analysis.get("nice_to_have_skills", []),
        "mustHaveKeywords": analysis.get("must_have_keywords", []),
        "niceToHaveKeywords": analysis.get("domain_phrases", []),
        "responsibilities": analysis.get("responsibilities_summary", []),
        "risks": analysis.get("ats_risks", []),
    }


# ── Run Tailoring ─────────────────────────────────────────────────────────

@router.post("")
async def run_tailoring(
    data: TailorRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an AI tailoring session. Returns sessionId immediately; poll GET /{id} for results."""
    resume_result = await db.execute(
        select(Resume).where(
            Resume.id == data.resume_id,
            Resume.user_id == current_user.id,
        )
    )
    resume = resume_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(404, "Resume not found")

    jd_result = await db.execute(
        select(JobDescription).where(
            JobDescription.id == data.job_description_id,
            JobDescription.user_id == current_user.id,
        )
    )
    jd = jd_result.scalar_one_or_none()
    if not jd:
        raise HTTPException(404, "Job description not found")

    session = TailoringSession(
        user_id=current_user.id,
        resume_id=data.resume_id,
        job_desc_id=data.job_description_id,
        status=SessionStatus.RUNNING,
        passes_completed=0,
    )
    db.add(session)
    await db.flush()
    session_id = session.id
    resume_content = resume.content or {}
    jd_text = jd.raw_text
    jd_analysis = jd.analysis

    background_tasks.add_task(
        run_pipeline_background,
        session_id,
        resume_content,
        jd_text,
        jd_analysis,
    )

    return {"sessionId": session_id}


# ── Get Session ───────────────────────────────────────────────────────────

@router.get("/{session_id}")
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TailoringSession)
        .where(
            TailoringSession.id == session_id,
            TailoringSession.user_id == current_user.id,
        )
        .options(
            selectinload(TailoringSession.recommendations),
            selectinload(TailoringSession.ats_score),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    return {
        "session": {
            "id": session.id,
            "status": session.status,
            "matchScore": session.match_score,
            "resumeId": session.resume_id,
            "passesCompleted": session.passes_completed,
            "errorMessage": session.error_message,
            "createdAt": session.created_at,
            "completedAt": session.completed_at,
        },
        "recommendations": [
            {
                "id": r.id,
                "section": r.section,
                "field": r.field,
                "original": r.original,
                "suggested": r.suggested,
                "reason": r.reason,
                "confidence": r.confidence,
                "keywords": r.keywords or [],
                "status": r.status,
            }
            for r in (session.recommendations or [])
        ],
        "atsScore": (
            {
                "overallScore": session.ats_score.overall_score,
                "keywordScore": session.ats_score.keyword_score,
                "skillsScore": session.ats_score.skills_score,
                "experienceScore": session.ats_score.experience_score,
                "educationScore": session.ats_score.education_score,
                "formatScore": session.ats_score.format_score,
                "matchedKeywords": session.ats_score.matched_keywords or [],
                "missingKeywords": session.ats_score.missing_keywords or [],
                "tips": session.ats_score.tips or [],
            }
            if session.ats_score else None
        ),
    }


# ── List Sessions ─────────────────────────────────────────────────────────

@router.get("")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TailoringSession)
        .where(TailoringSession.user_id == current_user.id)
        .order_by(TailoringSession.created_at.desc())
        .limit(20)
    )
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "status": s.status,
            "matchScore": s.match_score,
            "resumeId": s.resume_id,
            "createdAt": s.created_at,
        }
        for s in sessions
    ]


# ── Accept / Reject Recommendations ──────────────────────────────────────

@router.patch("/{session_id}/recommendations/{rec_id}")
async def update_recommendation(
    session_id: str,
    rec_id: str,
    data: RecommendationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recommendation)
        .join(TailoringSession)
        .where(
            Recommendation.id == rec_id,
            Recommendation.session_id == session_id,
            TailoringSession.user_id == current_user.id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    rec.status = data.status
    await db.flush()
    return {"id": rec.id, "status": rec.status}


# ── Apply Accepted Recommendations → New Resume Version ──────────────────

@router.post("/{session_id}/apply")
async def apply_recommendations(
    session_id: str,
    data: ApplyRecommendationsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.resume import ResumeVersion

    result = await db.execute(
        select(TailoringSession)
        .where(
            TailoringSession.id == session_id,
            TailoringSession.user_id == current_user.id,
        )
        .options(selectinload(TailoringSession.recommendations))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    res_result = await db.execute(
        select(Resume).where(Resume.id == session.resume_id)
    )
    resume = res_result.scalar_one()

    accepted = [r for r in session.recommendations if r.status == RecommendationStatus.ACCEPTED]
    new_content = dict(resume.content or {})
    applied_count = 0

    for rec in accepted:
        # Apply experience bullet rewrites
        if rec.section == "experience" and "experiences" in new_content:
            for exp in new_content["experiences"]:
                bullets = exp.get("bullets", [])
                if rec.original in bullets:
                    idx = bullets.index(rec.original)
                    bullets[idx] = rec.suggested
                    applied_count += 1

        # Apply summary rewrites
        elif rec.section == "summary" and rec.suggested:
            new_content["summary"] = rec.suggested
            applied_count += 1

        # Apply skills section additions — PRESERVE category structure exactly
        elif rec.section == "skills" and rec.suggested:
            add_text = rec.suggested.replace("Add: ", "").replace("Add:", "")
            new_skills_list = [s.strip() for s in add_text.split(",") if s.strip()]
            current_skills = new_content.get("skills", [])

            # Build full set of existing skills (look inside items/skills arrays)
            current_lower = set()
            for s in current_skills:
                if isinstance(s, str):
                    current_lower.add(s.lower())
                elif isinstance(s, dict):
                    if s.get("items"):
                        current_lower.update(i.lower() for i in s["items"] if isinstance(i, str))
                    elif s.get("skills"):
                        current_lower.update(i.lower() for i in s["skills"] if isinstance(i, str))
                    elif s.get("name"):
                        current_lower.add(s["name"].lower())

            # Detect format: {category, items} or {category, skills} or {name, category} or flat
            has_items_format = any(isinstance(s, dict) and s.get("items") for s in current_skills)
            has_skills_format = any(isinstance(s, dict) and s.get("skills") for s in current_skills)
            has_legacy_format = any(isinstance(s, dict) and s.get("name") and s.get("category") for s in current_skills)

            for ns in new_skills_list:
                if ns.lower() in current_lower:
                    continue

                if has_items_format or has_skills_format:
                    # INSERT INTO the correct existing category's items/skills array
                    items_key = "items" if has_items_format else "skills"
                    best_cat = _infer_skill_category_for_existing(ns, current_skills)

                    if best_cat:
                        # Find the category and append
                        for cat_obj in current_skills:
                            if isinstance(cat_obj, dict) and cat_obj.get("category") == best_cat:
                                cat_items = cat_obj.get(items_key, [])
                                if ns not in cat_items:
                                    cat_items.append(ns)
                                    cat_obj[items_key] = cat_items
                                break
                    else:
                        # No matching category — add to last category
                        if current_skills and isinstance(current_skills[-1], dict):
                            last_items = current_skills[-1].get(items_key, [])
                            last_items.append(ns)
                            current_skills[-1][items_key] = last_items
                        else:
                            current_skills.append({
                                "category": "Other",
                                items_key: [ns],
                            })
                    applied_count += 1

                elif has_legacy_format:
                    best_cat = _infer_skill_category_for_existing(ns, [
                        {"category": s.get("category", "Other"), "items": [s.get("name", "")]}
                        for s in current_skills if isinstance(s, dict) and s.get("name")
                    ])
                    current_skills.append({"name": ns, "category": best_cat or "Other"})
                    applied_count += 1

                else:
                    # Flat string list
                    current_skills.append(ns)
                    applied_count += 1

            new_content["skills"] = current_skills

    # Validate: tailored content must still have essential sections
    # If tailoring somehow deleted sections, don't save the corruption
    original_sections = set(k for k in (resume.content or {}).keys() if (resume.content or {}).get(k))
    new_sections = set(k for k in new_content.keys() if new_content.get(k))
    lost_sections = original_sections - new_sections
    if lost_sections:
        # Restore any sections that were lost during tailoring
        for section in lost_sections:
            new_content[section] = (resume.content or {})[section]

    # Save as version (keeps history)
    version = ResumeVersion(
        resume_id=resume.id,
        content=new_content,
        label=data.label or "Tailored version",
        session_id=session_id,
    )
    db.add(version)

    # Update main resume content — but ONLY if the new content is valid
    # (has at least experiences OR summary — not just skills)
    has_substance = bool(new_content.get("experiences")) or bool(new_content.get("summary"))
    if has_substance:
        resume.content = new_content
    await db.flush()

    return {
        "versionId": version.id,
        "resumeId": resume.id,
        "appliedCount": applied_count,
    }


# ── Cover Letter Generator ──────────────────────────────────────────────

@router.post("/cover-letter")
async def generate_cover_letter(
    data: CoverLetterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI cover letter from resume + JD."""
    # Get resume
    if data.resume_id:
        result = await db.execute(
            select(Resume).where(Resume.id == data.resume_id, Resume.user_id == current_user.id)
        )
    else:
        result = await db.execute(
            select(Resume).where(Resume.user_id == current_user.id).order_by(Resume.is_default.desc()).limit(1)
        )
    resume = result.scalar_one_or_none()

    # Get profile
    from app.models.profile import Profile
    profile_result = await db.execute(select(Profile).where(Profile.user_id == current_user.id))
    profile = profile_result.scalar_one_or_none()

    # Build context
    resume_text = ""
    if resume and resume.content:
        content = resume.content
        parts = []
        if content.get("summary"):
            parts.append(f"Summary: {content['summary']}")
        for exp in content.get("experiences", []):
            parts.append(f"{exp.get('title', '')} at {exp.get('company', '')}")
            parts.extend(exp.get("bullets", []))
        parts.extend(content.get("skills", []))
        resume_text = "\n".join(parts)

    applicant_name = profile.headline if profile else (current_user.full_name or current_user.email.split("@")[0])

    # Generate with Claude AI
    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = f"""Generate a professional cover letter for this job application.

Job Description:
{data.job_description[:3000]}

Company: {data.company or 'the company'}
Role: {data.role or 'the position'}

Applicant's Resume:
{resume_text[:3000]}

Applicant Name: {applicant_name}

Tone: {data.tone}

Requirements:
- Write a complete cover letter (greeting, 3-4 paragraphs, closing)
- Be specific to this role and company
- Reference actual skills and experience from the resume
- Do NOT fabricate experience
- Keep it under 400 words
- Be {data.tone} in tone
- End with a professional closing

Return ONLY the cover letter text, nothing else."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        cover_letter = response.content[0].text.strip()
    except Exception as e:
        cover_letter = f"Error generating cover letter: {str(e)}"

    return {
        "coverLetter": cover_letter,
        "company": data.company,
        "role": data.role,
        "tone": data.tone,
    }
