"""Answers Router — AI-generated application answers grounded in user profile + JD."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.resume import Resume

router = APIRouter(prefix="/answers", tags=["answers"])


class AnswerRequest(BaseModel):
    question: str
    job_description: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    resume_id: Optional[str] = None
    tone: str = "professional"
    answer_shape: str = "essay"  # boolean, numeric, short_text, location, date_or_timeline, enum_choice, essay


# ── Question classifier ──

def _classify_question(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["authorize", "authorized", "eligible to work", "legally", "work permit"]):
        return "authorization"
    if any(w in q for w in ["sponsor", "visa", "h1b", "h-1b", "immigration"]):
        return "sponsorship"
    if any(w in q for w in ["salary", "compensation", "pay expectation", "expected salary", "desired salary"]):
        return "salary"
    if any(w in q for w in ["start date", "available to start", "notice period", "when can you start", "earliest start"]):
        return "availability"
    if any(w in q for w in ["relocat", "willing to move", "open to moving"]):
        return "relocation"
    if any(w in q for w in ["why this company", "why do you want to work", "what interests you about", "what attracts you"]):
        return "why_company"
    if any(w in q for w in ["why this role", "why this position", "interest in this role", "why are you applying"]):
        return "why_role"
    if any(w in q for w in ["experience with", "proficien", "familiar with", "knowledge of", "expertise in"]):
        return "technical"
    if any(w in q for w in ["project", "built", "developed", "piece of work", "most proud", "technical achievement"]):
        return "project"
    if any(w in q for w in ["lead", "manage", "leadership", "mentor"]):
        return "leadership"
    if any(w in q for w in ["challenge", "difficult", "conflict", "disagree", "mistake", "failure"]):
        return "behavioral"
    if any(w in q for w in ["strength", "weakness", "best quality"]):
        return "self_assessment"
    if any(w in q for w in ["anything else", "additional", "share with us", "is there anything"]):
        return "open_ended"
    return "general"


# ── Shape-aware length instructions ──

SHAPE_INSTRUCTIONS = {
    "boolean": "Reply with ONLY 'Yes' or 'No'. Nothing else.",
    "numeric": "Reply with ONLY a number or short numeric phrase (e.g. '5' or '3-5 years'). Nothing else.",
    "short_text": "Reply in 1-15 words maximum. Be concise.",
    "location": "Reply with ONLY a city/state (e.g. 'Arlington, TX'). Nothing else.",
    "date_or_timeline": "Reply with ONLY a short timeline (e.g. '2 weeks from offer' or 'Immediately'). Nothing else.",
    "enum_choice": "Reply with ONLY the single best matching option text. Nothing else.",
    "essay": "Write a thoughtful, specific answer in 100-250 words. Use first person. Be professional.",
}

# ── Type-specific instructions ──

TYPE_INSTRUCTIONS = {
    "authorization": "Answer clearly about work authorization. Use the applicant's actual status from their profile.",
    "sponsorship": "Answer clearly about sponsorship needs. Use the applicant's actual visa/sponsorship status.",
    "salary": "Suggest a reasonable salary range for this specific role and location. Be diplomatic but confident.",
    "availability": "Give a clear answer about start date. If not specified, say 'Available within 2 weeks of offer acceptance.'",
    "relocation": "Answer honestly about relocation willingness.",
    "why_company": "Explain genuine interest in this SPECIFIC company. Reference what they do, their mission, or products. Connect to the applicant's background. Do NOT be generic.",
    "why_role": "Explain genuine interest in this SPECIFIC role. Connect the role's responsibilities to the applicant's actual experience. Do NOT be generic.",
    "technical": "Reference SPECIFIC technologies and experiences from the resume. Give concrete examples with outcomes.",
    "project": "Describe a REAL project from the resume. Include technologies used, your role, and measurable impact.",
    "leadership": "Use a REAL example from the resume showing leadership, mentoring, or team coordination.",
    "behavioral": "Use STAR format (Situation, Task, Action, Result) with a real experience from the resume.",
    "self_assessment": "Give an honest, self-aware answer grounded in the resume.",
    "open_ended": "Share something relevant from the resume that hasn't been covered. Keep it positive.",
    "general": "Give a thoughtful, specific answer grounded in the resume.",
}


def _build_resume_context(content: dict) -> str:
    """Build clean resume context string for the AI prompt."""
    parts = []
    if content.get("summary"):
        parts.append(f"Summary: {content['summary']}")
    for exp in content.get("experiences", [])[:3]:
        role_line = f"\n{exp.get('title', '')} at {exp.get('company', '')}"
        if exp.get("start_date"):
            role_line += f" ({exp.get('start_date', '')} – {exp.get('end_date', 'Present')})"
        parts.append(role_line)
        for b in exp.get("bullets", [])[:6]:
            parts.append(f"  - {b}")
    # Flatten skills properly
    for skill in content.get("skills", []):
        if isinstance(skill, str):
            parts.append(f"Skill: {skill}")
        elif isinstance(skill, dict):
            cat = skill.get("category", "")
            items = skill.get("items", skill.get("skills", []))
            if cat and items:
                parts.append(f"{cat}: {', '.join(str(i) for i in items)}")
    for edu in content.get("educations", [])[:2]:
        parts.append(f"Education: {edu.get('degree', '')} in {edu.get('field', '')} from {edu.get('school', '')}")
    return "\n".join(parts)


@router.post("/generate")
async def generate_answer(
    data: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a grounded, shape-aware answer for a job application question."""

    # ── Load resume context (use default if no resume_id) ──
    resume_context = ""
    try:
        if data.resume_id:
            result = await db.execute(select(Resume).where(Resume.id == data.resume_id, Resume.user_id == current_user.id))
        else:
            result = await db.execute(
                select(Resume).where(Resume.user_id == current_user.id)
                .order_by(Resume.is_default.desc(), Resume.updated_at.desc()).limit(1)
            )
        resume = result.scalar_one_or_none()
        if resume and resume.content:
            resume_context = _build_resume_context(resume.content)
    except Exception:
        pass

    # ── Load profile for additional context ──
    profile_context = ""
    try:
        profile_result = await db.execute(text("SELECT * FROM profiles WHERE user_id = :uid"), {"uid": current_user.id})
        profile = profile_result.mappings().first()
        if profile:
            parts = []
            if profile.get("location"): parts.append(f"Location: {profile['location']}")
            if profile.get("headline"): parts.append(f"Headline: {profile['headline']}")
            profile_context = " | ".join(parts)
    except Exception:
        pass

    # ── Classify and get instructions ──
    question_type = _classify_question(data.question)
    type_instruction = TYPE_INSTRUCTIONS.get(question_type, TYPE_INSTRUCTIONS["general"])
    shape_instruction = SHAPE_INSTRUCTIONS.get(data.answer_shape, SHAPE_INSTRUCTIONS["essay"])

    # ── Determine max tokens by shape ──
    max_tokens_map = {
        "boolean": 10,
        "numeric": 20,
        "short_text": 50,
        "location": 30,
        "date_or_timeline": 40,
        "enum_choice": 30,
        "essay": 800,
    }
    max_tokens = max_tokens_map.get(data.answer_shape, 800)

    # ── Build prompt ──
    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    system_prompt = f"""You are answering a job application question on behalf of the applicant.

FORMAT: {shape_instruction}
APPROACH: {type_instruction}
TONE: {data.tone}

Rules:
- Answer in FIRST PERSON ("I have...", "My experience...")
- Use ONLY real details from the resume. Do NOT fabricate.
- For yes/no questions, answer with just Yes or No.
- For short answers, be concise. For essays, be thorough but focused.
- If the question has Options listed, pick the BEST matching option and reply with ONLY that text.
- Be specific to THIS company and role when mentioned."""

    user_prompt = f"""Question: {data.question}

{f'Company: {data.company}' if data.company else ''}
{f'Role: {data.role}' if data.role else ''}
{f'Job Description excerpt: {data.job_description[:1500]}' if data.job_description else ''}

Applicant Background:
{resume_context[:2500] if resume_context else 'No resume loaded.'}
{profile_context}

Answer the question now. Follow the FORMAT instruction exactly."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        answer = response.content[0].text.strip()
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"

    return {
        "question": data.question,
        "questionType": question_type,
        "answer": answer,
        "answerShape": data.answer_shape,
        "tone": data.tone,
        "company": data.company,
        "role": data.role,
    }


@router.get("/templates")
async def get_question_templates():
    """Return common application question templates."""
    return {"templates": {
        "why_company": "Why do you want to work at {company}?",
        "why_role": "Why are you interested in this role?",
        "experience": "Tell us about your relevant experience.",
        "project": "Describe a challenging project you worked on.",
        "leadership": "Give an example of leadership.",
        "salary": "What are your salary expectations?",
        "availability": "When can you start?",
    }}
