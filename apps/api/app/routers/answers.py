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

    from anthropic import AsyncAnthropic
    from app.core.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = f"""Answer this job application question. Give a direct, {data.tone} answer.

Question: {data.question}

{f'Company: {data.company}' if data.company else ''}
{f'Role: {data.role}' if data.role else ''}
{f'Job Description: {data.job_description[:2000]}' if data.job_description else ''}

Applicant's Resume/Background:
{resume_text[:2000] if resume_text else 'No resume provided — give a general professional answer.'}

Rules:
- Answer in first person
- Be specific and use real details from the resume when available
- Do NOT fabricate experience or skills
- Keep under 200 words unless the question requires more
- Be {data.tone} in tone
- For yes/no questions (authorization, sponsorship), give a clear direct answer
- For salary questions, suggest a reasonable range based on the role

Return ONLY the answer text."""

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = response.content[0].text.strip()
    except Exception as e:
        answer = f"Error: {str(e)}"

    return {
        "question": data.question,
        "answer": answer,
        "tone": data.tone,
        "company": data.company,
        "role": data.role,
    }


@router.get("/templates")
async def get_question_templates():
    """Return common application question templates."""
    return {"templates": QUESTION_TEMPLATES}
