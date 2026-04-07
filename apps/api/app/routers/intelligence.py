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
            for sk in c.get("skills", []):
                if isinstance(sk, str): parts.append(sk)
                elif isinstance(sk, dict):
                    cat = sk.get("category", "")
                    items = sk.get("items", sk.get("skills", []))
                    if cat and items: parts.append(f"{cat}: {', '.join(str(i) for i in items)}")
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
            model="claude-sonnet-4-6",
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


# ══════════════════════════════════════════════════════════════════════════
# MOCK INTERVIEW — Interactive chat-based interview practice
# ══════════════════════════════════════════════════════════════════════════

class MockInterviewStartRequest(BaseModel):
    resume_id: Optional[str] = None
    job_description: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    tracker_id: Optional[str] = None
    interview_type: str = "full"  # full, recruiter, technical, behavioral, final


class MockInterviewReplyRequest(BaseModel):
    session_context: str  # The conversation so far (JSON)
    user_answer: str
    resume_id: Optional[str] = None
    job_description: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None


INTERVIEW_SYSTEM = """You are an expert interviewer conducting a realistic mock interview.

You are interviewing a candidate for the role of {role} at {company}.

Your style:
- Act as a real interviewer — professional, warm but probing
- Ask ONE question at a time
- Wait for the candidate's response before moving on
- Ask follow-up questions based on their answers (like a real interviewer would)
- Mix question types: opening/rapport, behavioral, technical, situational, role-specific
- Calibrate difficulty to the seniority level implied by the JD

Interview structure:
1. Start with a warm greeting and opening question ("Tell me about yourself" or "Walk me through your background")
2. Then ask 2-3 role-specific technical questions based on the JD
3. Then 1-2 behavioral questions (STAR format expected)
4. Then 1 situational/problem-solving question
5. End with "Do you have any questions for us?"

When the candidate answers:
- Acknowledge their answer briefly (like a real interviewer: "That's interesting" or "Good example")
- Then ask the next question naturally

CRITICAL: Only ask ONE question per message. Wait for the response."""

FEEDBACK_SYSTEM = """You are an expert interview coach providing feedback on a candidate's answer.

Evaluate the answer on:
1. RELEVANCE (0-10): Does it answer the question asked?
2. SPECIFICITY (0-10): Does it use concrete examples, numbers, technologies?
3. STRUCTURE (0-10): Is it well-organized (STAR for behavioral, clear for technical)?
4. CONFIDENCE (0-10): Does it sound confident and professional?

Provide:
- Overall score (average of 4 dimensions)
- 1-2 specific strengths
- 1-2 specific improvements
- A suggested stronger answer (100-150 words)

Be constructive, not harsh. This is practice."""


@router.post("/mock-interview/start")
async def start_mock_interview(
    data: MockInterviewStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a mock interview. Returns the first question."""
    ctx = await _get_context(
        IntelRequest(resume_id=data.resume_id, job_description=data.job_description,
                     company=data.company, role=data.role, tracker_id=data.tracker_id),
        current_user, db
    )

    company = ctx["company"] or "the company"
    role = ctx["role"] or "the position"

    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    system = INTERVIEW_SYSTEM.format(role=role, company=company)

    user_msg = f"""Begin the interview now. Here is the context:

Job Description:
{ctx['jd'][:2000] or 'No JD provided — ask general questions for this role.'}

Candidate's Resume:
{ctx['resume_text'][:2000] or 'No resume provided.'}

Interview Type: {data.interview_type}

Start with a warm greeting and your first question. Remember: only ONE question."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        first_question = response.content[0].text.strip()
    except Exception as e:
        first_question = f"Hello! Thank you for taking the time to interview with us today. Could you start by telling me a bit about yourself and what drew you to this {role} position at {company}?"

    return {
        "question": first_question,
        "questionNumber": 1,
        "interviewType": data.interview_type,
        "company": company,
        "role": role,
        "sessionContext": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": first_question},
        ],
    }


@router.post("/mock-interview/reply")
async def mock_interview_reply(
    data: MockInterviewReplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Continue the mock interview. Send candidate's answer, get next question."""
    import json

    try:
        session = json.loads(data.session_context) if isinstance(data.session_context, str) else data.session_context
    except:
        session = []

    # Add candidate's answer
    session.append({"role": "user", "content": data.user_answer})

    # Count questions asked so far
    q_count = sum(1 for m in session if m["role"] == "assistant")

    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    # Extract system message
    system_msg = ""
    api_messages = []
    for m in session:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            api_messages.append({"role": m["role"], "content": m["content"]})

    # After 6-7 questions, wrap up
    if q_count >= 7:
        api_messages.append({
            "role": "user",
            "content": "(System note: This is question 7+. Wrap up the interview naturally. Thank the candidate and ask if they have any questions for you.)"
        })

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            system=system_msg,
            messages=api_messages,
        )
        next_question = response.content[0].text.strip()
    except Exception as e:
        next_question = "Thank you for that answer. That's all the questions I have for now. Do you have any questions for us?"

    session.append({"role": "assistant", "content": next_question})

    is_complete = q_count >= 8 or "questions for us" in next_question.lower() or "questions for me" in next_question.lower()

    return {
        "question": next_question,
        "questionNumber": q_count + 1,
        "isComplete": is_complete,
        "sessionContext": session,
    }


@router.post("/mock-interview/feedback")
async def mock_interview_feedback(
    data: MockInterviewReplyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get feedback on a specific answer during the interview."""
    import json

    try:
        session = json.loads(data.session_context) if isinstance(data.session_context, str) else data.session_context
    except:
        session = []

    # Find the last interviewer question
    last_question = ""
    for m in reversed(session):
        if m["role"] == "assistant":
            last_question = m["content"]
            break

    # Get resume context for suggested answer
    ctx = await _get_context(
        IntelRequest(resume_id=data.resume_id, job_description=data.job_description,
                     company=data.company, role=data.role),
        current_user, db
    )

    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = f"""Interview Question: {last_question}

Candidate's Answer: {data.user_answer}

Candidate's Resume (for context):
{ctx['resume_text'][:1500]}

{FEEDBACK_SYSTEM}

Provide your feedback now in this format:
SCORE: X/10
STRENGTHS: ...
IMPROVEMENTS: ...
SUGGESTED ANSWER: ..."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        feedback = response.content[0].text.strip()
    except Exception as e:
        feedback = f"Error generating feedback: {str(e)}"

    return {
        "question": last_question,
        "userAnswer": data.user_answer,
        "feedback": feedback,
    }
