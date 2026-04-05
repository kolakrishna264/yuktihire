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

            result = await execute_pipeline(
                resume_content=resume_content,
                jd_text=jd_text,
                cached_jd_analysis=jd_analysis,
            )

            # Save recommendations
            for rec in result.get("recommendations", []):
                recommendation = Recommendation(
                    session_id=session_id,
                    section=rec.get("section", "experience"),
                    field=rec.get("field"),
                    original=rec.get("original", ""),
                    suggested=rec.get("suggested", ""),
                    reason=rec.get("reason", ""),
                    confidence=float(rec.get("confidence", 0.8)),
                    keywords=rec.get("keywords", []),
                )
                db.add(recommendation)

            # Save ATS score
            ats = result.get("ats_score", {})
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
            session_result = await db.execute(
                select(TailoringSession).where(TailoringSession.id == session_id)
            )
            session = session_result.scalar_one_or_none()
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

        # Apply skills section additions
        elif rec.section == "skills" and rec.suggested:
            # Parse "Add: skill1, skill2, skill3" format
            add_text = rec.suggested.replace("Add: ", "").replace("Add:", "")
            new_skills_list = [s.strip() for s in add_text.split(",") if s.strip()]
            current_skills = new_content.get("skills", [])
            current_lower = set()
            for s in current_skills:
                if isinstance(s, str):
                    current_lower.add(s.lower())
                elif isinstance(s, dict):
                    current_lower.add((s.get("name", "") or "").lower())

            for ns in new_skills_list:
                if ns.lower() not in current_lower:
                    # Match existing format (string or dict)
                    if current_skills and isinstance(current_skills[0], dict):
                        current_skills.append({"name": ns})
                    else:
                        current_skills.append(ns)
                    applied_count += 1
            new_content["skills"] = current_skills

    version = ResumeVersion(
        resume_id=resume.id,
        content=new_content,
        label=data.label or "Tailored version",
        session_id=session_id,
    )
    db.add(version)
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
