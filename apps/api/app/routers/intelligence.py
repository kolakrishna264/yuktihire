"""Intelligence Router — Interview prep, company research, recruiter outreach."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.resume import Resume

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


class IntelRequest(BaseModel):
    job_description: Optional[str] = None
    resume_id: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    tracker_id: Optional[str] = None


async def _get_context(data: IntelRequest, current_user: User, db: AsyncSession) -> dict:
    """Build common context from resume + JD + tracker job."""
    resume_text = ""
    if data.resume_id:
        result = await db.execute(select(Resume).where(Resume.id == data.resume_id, Resume.user_id == current_user.id))
        resume = result.scalar_one_or_none()
        if resume and resume.content:
            parts = []
            c = resume.content
            if c.get("summary"): parts.append(c["summary"])
            for exp in c.get("experiences", []):
                parts.append(f"{exp.get('title','')} at {exp.get('company','')}")
                parts.extend(exp.get("bullets", []))
            parts.extend([s if isinstance(s, str) else s.get("name","") for s in c.get("skills", [])])
            resume_text = "\n".join(p for p in parts if p)

    jd = data.job_description or ""
    company = data.company or ""
    role = data.role or ""

    # Try to get JD from tracker if not provided
    if data.tracker_id and not jd:
        try:
            result = await db.execute(text("SELECT role, company, notes, url FROM job_applications WHERE id = :id AND user_id = :uid"),
                                      {"id": data.tracker_id, "uid": current_user.id})
            row = result.mappings().first()
            if row:
                jd = row.get("notes") or ""
                if not company: company = row.get("company") or ""
                if not role: role = row.get("role") or ""
        except: pass

    return {"resume_text": resume_text[:3000], "jd": jd[:3000], "company": company, "role": role}


async def _call_ai(prompt: str) -> str:
    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        return f"Error: {str(e)}"


# ── Interview Prep ────────────────────────────────────────────────────────

@router.post("/interview-prep")
async def generate_interview_prep(
    data: IntelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await _get_context(data, current_user, db)

    prompt = f"""Generate interview preparation questions and suggested answers for this job application.

Role: {ctx['role']}
Company: {ctx['company']}

Job Description:
{ctx['jd']}

Candidate Resume:
{ctx['resume_text']}

Generate the following sections. For each question, provide a suggested answer based on the candidate's actual resume. Do NOT fabricate experience.

## Recruiter Screen Questions (3-4 questions + answers)
Common HR/recruiter questions for initial phone screen.

## Technical Questions (4-5 questions + answers)
Role-specific technical questions based on the JD requirements.

## Behavioral Questions (3-4 questions + answers)
STAR-format behavioral questions relevant to this role.

## System Design Questions (2-3 questions + brief approach)
Only if the role involves engineering/architecture. Skip if not relevant.

## Company-Specific Questions (2-3 questions to ASK the interviewer)
Smart questions the candidate should ask about the company/role.

Format each question as:
**Q: [question]**
**A: [suggested answer]**

Keep answers concise (2-4 sentences each). Use actual experience from the resume."""

    result = await _call_ai(prompt)
    return {"interviewPrep": result, "company": ctx["company"], "role": ctx["role"]}


# ── Company Research ──────────────────────────────────────────────────────

@router.post("/company-research")
async def generate_company_research(
    data: IntelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await _get_context(data, current_user, db)

    prompt = f"""Generate a company intelligence brief for a job applicant.

Company: {ctx['company']}
Role: {ctx['role']}

Job Description:
{ctx['jd']}

Candidate Resume:
{ctx['resume_text']}

Generate these sections:

## Company Overview
Brief description of what the company does, their products, and market position. (2-3 sentences)

## Products & Technology
What the company builds, their tech stack (inferred from JD), and technical focus areas.

## Why This Role Exists
What problem this hire solves for the company, based on the JD.

## Interview Difficulty Estimate
Rate as Easy / Medium / Hard / Very Hard with brief reasoning.

## Resume Focus Tips
Top 3 things from the candidate's resume to emphasize for THIS specific role.

## Key Talking Points
5 specific talking points the candidate should prepare, connecting their experience to this company's needs.

## Questions to Research Before Interview
3 things the candidate should research about the company before interviewing.

Be specific and actionable. Base everything on the JD and resume provided."""

    result = await _call_ai(prompt)
    return {"companyResearch": result, "company": ctx["company"], "role": ctx["role"]}


# ── Recruiter Outreach ────────────────────────────────────────────────────

@router.post("/recruiter-outreach")
async def generate_recruiter_outreach(
    data: IntelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await _get_context(data, current_user, db)

    # Get applicant name
    try:
        user_result = await db.execute(text("SELECT full_name, email FROM users WHERE id = :uid"), {"uid": current_user.id})
        user = user_result.mappings().first()
        name = (user.get("full_name") or user.get("email", "").split("@")[0]) if user else "the candidate"
    except:
        name = "the candidate"

    prompt = f"""Generate recruiter outreach messages for a job application.

Applicant: {name}
Company: {ctx['company']}
Role: {ctx['role']}

Job Description:
{ctx['jd']}

Applicant Resume:
{ctx['resume_text']}

Generate these 4 messages. Each must be personalized using the resume and JD. Keep them concise and professional.

## LinkedIn Connection Request (under 300 characters)
A brief connection request message for the recruiter/hiring manager.

## LinkedIn Follow-Up Message (100-150 words)
A follow-up message after connecting, expressing interest in the role.

## Cold Email to Recruiter (150-200 words)
A professional cold email expressing interest, highlighting relevant experience.

## Referral Request Message (100-150 words)
A message to a mutual connection asking for a referral to this role.

For each message:
- Be specific about the role and company
- Reference 1-2 relevant experiences from the resume
- Be professional but genuine
- Do NOT be generic or salesy"""

    result = await _call_ai(prompt)
    return {"outreachMessages": result, "company": ctx["company"], "role": ctx["role"], "applicantName": name}


# ── Apply Readiness Score ────────────────────────────────────────────────

@router.post("/readiness-score")
async def calculate_readiness(
    data: IntelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate apply readiness score for a tracked job."""
    score = 0
    details = {}

    if data.tracker_id:
        try:
            result = await db.execute(text("SELECT * FROM job_applications WHERE id = :id AND user_id = :uid"),
                                      {"id": data.tracker_id, "uid": current_user.id})
            job = result.mappings().first()
            if job:
                # Resume uploaded? (20 pts)
                has_resume = bool(job.get("resume_used") or job.get("resume_version_id"))
                details["resumeUploaded"] = has_resume
                if has_resume: score += 20

                # JD captured? (15 pts)
                has_jd = bool(job.get("notes") and len(job.get("notes", "")) > 50)
                details["jdCaptured"] = has_jd
                if has_jd: score += 15

                # Resume tailored? (25 pts)
                details["resumeTailored"] = has_resume  # Simplified — check if version exists
                if has_resume: score += 25

                # Profile complete? (15 pts)
                profile = await db.execute(text("SELECT completeness FROM profiles WHERE user_id = :uid"), {"uid": current_user.id})
                p = profile.mappings().first()
                profile_pct = p.get("completeness", 0) if p else 0
                details["profileComplete"] = profile_pct >= 60
                if profile_pct >= 60: score += 15

                # Has source URL? (10 pts)
                details["hasApplyLink"] = bool(job.get("url"))
                if job.get("url"): score += 10

                # Company researched? (15 pts) — simplified
                details["companyResearched"] = False
                score += 0  # User needs to generate research
        except Exception as e:
            print(f"[Readiness] Error: {e}")

    return {
        "score": min(score, 100),
        "details": details,
        "recommendation": "Ready to apply!" if score >= 70 else "Complete more steps before applying" if score >= 40 else "Start by tailoring your resume",
    }


# ── Apply Strategy ───────────────────────────────────────────────────────

@router.post("/apply-strategy")
async def generate_apply_strategy(
    data: IntelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI apply strategy for a specific job."""
    ctx = await _get_context(data, current_user, db)

    prompt = f"""Generate a strategic application plan for this job.

Role: {ctx['role']}
Company: {ctx['company']}

Job Description:
{ctx['jd']}

Candidate Resume:
{ctx['resume_text']}

Generate:

## Match Assessment
Rate the match as Strong / Good / Moderate / Weak with reasoning. (2-3 sentences)

## Top 3 Strengths to Highlight
Specific experiences from the resume that align with this role.

## Key Gaps to Address
Skills or experience the JD requires that the resume doesn't clearly show.

## Recommended Actions Before Applying
Numbered list of 3-5 actions (e.g., "Add X keyword to resume", "Prepare story about Y").

## Best Resume Strategy
Which sections of the resume to emphasize or modify for this specific role.

## Application Timing Tip
Brief advice on when/how to apply for best results.

Be specific and actionable."""

    result = await _call_ai(prompt)
    return {"strategy": result, "company": ctx["company"], "role": ctx["role"]}
