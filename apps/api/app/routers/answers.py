"""Answers Router — AI-generated application answers."""
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
    tone: str = "professional"  # professional, concise, technical, conversational


# Common questions with pre-built prompt strategies
QUESTION_TEMPLATES = {
    "why_company": "Why do you want to work at {company}?",
    "why_role": "Why are you interested in this role?",
    "experience": "Tell us about your relevant experience.",
    "strength": "What is your greatest strength?",
    "weakness": "What is your greatest weakness?",
    "project": "Describe a challenging project you worked on.",
    "leadership": "Give an example of a time you showed leadership.",
    "conflict": "How do you handle disagreements with team members?",
    "salary": "What are your salary expectations?",
    "availability": "When can you start?",
    "authorization": "Are you authorized to work in the US?",
    "sponsorship": "Do you require visa sponsorship?",
}


def _classify_question(question: str) -> str:
    """Classify application question type for better answer generation."""
    q = question.lower()
    if any(w in q for w in ["authorize", "authorized", "eligible to work", "legally", "work permit"]):
        return "authorization"
    if any(w in q for w in ["sponsor", "visa", "h1b", "h-1b", "immigration"]):
        return "sponsorship"
    if any(w in q for w in ["salary", "compensation", "pay", "expected"]):
        return "salary"
    if any(w in q for w in ["start date", "available", "notice period", "when can you"]):
        return "availability"
    if any(w in q for w in ["relocat", "willing to move"]):
        return "relocation"
    if any(w in q for w in ["why", "interest", "motivat", "what attracts"]):
        return "motivation"
    if any(w in q for w in ["experience with", "proficien", "familiar", "skill"]):
        return "technical"
    if any(w in q for w in ["project", "built", "developed", "created", "designed"]):
        return "project"
    if any(w in q for w in ["lead", "manage", "team", "mentor"]):
        return "leadership"
    if any(w in q for w in ["challenge", "difficult", "conflict", "disagree", "mistake"]):
        return "behavioral"
    if any(w in q for w in ["strength", "weakness", "best quality"]):
        return "self_assessment"
    if any(w in q for w in ["anything else", "additional", "share with us"]):
        return "open_ended"
    return "general"


# Specialized instructions per question type
_TYPE_INSTRUCTIONS = {
    "authorization": "Give a clear yes/no answer about work authorization status. Use profile data only -- do NOT guess.",
    "sponsorship": "Give a clear answer about sponsorship needs. Use profile data only -- do NOT guess.",
    "salary": "Suggest a reasonable salary range based on the role, location, and experience level. Be diplomatic.",
    "availability": "Give a clear answer about availability. If unknown, say 'available to start within 2 weeks of offer acceptance.'",
    "relocation": "Answer honestly about relocation. If unknown, say 'open to discussing relocation.'",
    "motivation": "Connect the candidate's actual background to the specific company and role. Be genuine, not generic.",
    "technical": "Reference specific technologies and experiences from the resume. Give concrete examples.",
    "project": "Describe a real project from the resume. Include specific impact, technologies, and outcomes.",
    "leadership": "Use a real example from the resume showing leadership or teamwork.",
    "behavioral": "Use STAR format (Situation, Task, Action, Result) with real experience from the resume.",
    "self_assessment": "Give an honest strength or weakness. For weaknesses, show self-awareness and improvement.",
    "open_ended": "Share something relevant and genuine that hasn't been covered. Keep it positive and relevant.",
    "general": "Give a thoughtful, specific answer grounded in the resume.",
}


@router.post("/generate")
async def generate_answer(
    data: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI answer for an application question."""
    # Get resume context
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
            parts.extend(c.get("skills", []))
            resume_text = "\n".join(p for p in parts if p)

    # Get profile
    try:
        profile_result = await db.execute(text("SELECT * FROM profiles WHERE user_id = :uid"), {"uid": current_user.id})
        profile = profile_result.mappings().first()
    except:
        profile = None

    # Classify question type for specialized prompts
    question_type = _classify_question(data.question)
    type_instruction = _TYPE_INSTRUCTIONS.get(question_type, _TYPE_INSTRUCTIONS["general"])

    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = f"""Answer this job application question. Give a direct, {data.tone} answer.

Question: {data.question}
Question Type: {question_type}

Special Instructions: {type_instruction}

{f'Company: {data.company}' if data.company else ''}
{f'Role: {data.role}' if data.role else ''}
{f'Job Description: {data.job_description[:2000]}' if data.job_description else ''}

Applicant's Resume/Background:
{resume_text[:2000] if resume_text else 'No resume provided -- give a general professional answer.'}

Rules:
- Answer in first person
- Be specific and use real details from the resume when available
- Do NOT fabricate experience or skills
- Keep under 200 words unless the question requires more
- Be {data.tone} in tone
- For yes/no questions (authorization, sponsorship), give a clear direct answer
- For salary questions, suggest a reasonable range based on the role
- Follow the Special Instructions above for this question type

Return ONLY the answer text."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = response.content[0].text.strip()
    except Exception as e:
        answer = f"Error: {str(e)}"

    return {
        "question": data.question,
        "questionType": question_type,
        "answer": answer,
        "tone": data.tone,
        "company": data.company,
        "role": data.role,
    }


@router.get("/templates")
async def get_question_templates():
    """Return common application question templates."""
    return {"templates": QUESTION_TEMPLATES}
