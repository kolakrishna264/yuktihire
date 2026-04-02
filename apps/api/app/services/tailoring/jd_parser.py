"""
Pass 1: Job Description Analysis
Extracts structured requirements from raw JD text using Claude.
"""
import json
import re
import hashlib
from anthropic import AsyncAnthropic
from app.core.config import get_settings

settings = get_settings()
client = AsyncAnthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """You are an expert ATS analyst and job requirements parser.
Extract precise, structured information from job descriptions.
Be conservative — only extract what is explicitly stated or strongly implied.
Return only valid JSON, no other text."""

USER_PROMPT = """Analyze this job description and extract structured requirements.

JOB DESCRIPTION:
{jd_text}

Return this exact JSON structure (no markdown, no extra text):
{{
  "company": "company name or null",
  "role": "exact job title",
  "required_skills": ["skill1", "skill2"],
  "nice_to_have_skills": ["skill1"],
  "must_have_keywords": ["keyword or phrase that must appear in ATS-optimized resume"],
  "domain_phrases": ["industry-specific terminology that signals domain expertise"],
  "seniority_level": "junior|mid|senior|staff|principal|director|vp",
  "years_required": null,
  "education_required": "bachelors|masters|phd|any|null",
  "ats_risks": ["specific format/content issues that commonly fail ATS for this role"],
  "responsibilities_summary": ["top 5 core responsibilities as brief phrases"],
  "confidence": 0.0
}}

Rules:
- required_skills: only skills marked as "required", "must have", or strongly implied as mandatory
- nice_to_have_skills: "preferred", "bonus", "plus" items only
- must_have_keywords: exact ATS-critical terms (tool names, certifications, methodology names)
- domain_phrases: 3-6 word phrases that signal deep expertise in this domain
- seniority_level: infer from title, years required, and responsibility scope
- ats_risks: common failure patterns for this specific role type
- confidence: your confidence in accuracy (0.0-1.0)"""


def clean_jd(text: str) -> str:
    """Clean HTML and normalize whitespace from JD text."""
    from bs4 import BeautifulSoup
    # Strip HTML if present
    if "<" in text and ">" in text:
        soup = BeautifulSoup(text, "lxml")
        text = soup.get_text(separator="\n")
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'([•\-\*])\s*', r'\n\1 ', text)
    return text.strip()


def extract_json_safe(text: str) -> dict:
    """Safely extract JSON from Claude response."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try code block
    match = re.search(r'```(?:json)?\s*([\s\S]+?)```', text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Try first { to last }
    start = text.find('{')
    end = text.rfind('}') + 1
    if start != -1 and end > 0:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Could not parse JSON from response: {text[:300]}")


async def analyze_jd(jd_text: str) -> dict:
    """
    Parse and analyze a job description.
    Returns structured JD analysis as dict.
    """
    cleaned = clean_jd(jd_text)

    if len(cleaned) < 100:
        raise ValueError("Job description too short for reliable analysis")

    # Truncate to avoid token limits
    truncated = cleaned[:6000]

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": USER_PROMPT.format(jd_text=truncated)
        }]
    )

    raw = message.content[0].text
    analysis = extract_json_safe(raw)

    # Normalize and add metadata
    analysis["raw_text_length"] = len(cleaned)
    analysis["required_skills"] = analysis.get("required_skills") or []
    analysis["nice_to_have_skills"] = analysis.get("nice_to_have_skills") or []
    analysis["must_have_keywords"] = analysis.get("must_have_keywords") or []
    analysis["domain_phrases"] = analysis.get("domain_phrases") or []
    analysis["ats_risks"] = analysis.get("ats_risks") or []
    analysis["responsibilities_summary"] = analysis.get("responsibilities_summary") or []

    return analysis
