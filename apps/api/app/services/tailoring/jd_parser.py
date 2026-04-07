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

SYSTEM_PROMPT = """You are an expert ATS (Applicant Tracking System) analyst.
Extract ALL technical skills, tools, and requirements from job descriptions.
Be thorough — extract every technology, tool, methodology, and skill mentioned.
Return only valid JSON, no other text."""

USER_PROMPT = """Analyze this job description and extract ALL requirements for ATS matching.

JOB DESCRIPTION:
{jd_text}

Return this exact JSON structure (no markdown, no extra text):
{{
  "company": "company name or null",
  "role": "exact job title",
  "required_skills": ["every technical skill, tool, framework, language mentioned as required"],
  "nice_to_have_skills": ["skills marked as preferred/bonus/plus"],
  "must_have_keywords": ["ALL critical ATS keywords: tool names, technologies, methodologies, certifications — be thorough, extract 10-20+"],
  "nice_to_have_keywords": ["preferred/bonus keywords"],
  "domain_phrases": ["industry-specific 2-4 word technical phrases"],
  "seniority_level": "junior|mid|senior|staff|principal|director|vp",
  "years_required": null,
  "education_required": "bachelors|masters|phd|any|null",
  "ats_risks": ["specific issues that commonly fail ATS for this role"],
  "responsibilities_summary": ["top 5-8 core responsibilities as brief phrases"],
  "confidence": 0.0
}}

Rules:
- required_skills: Extract EVERY skill/tool/technology mentioned in qualifications or requirements. Include both explicit ("must have Python") and strongly implied skills. Be thorough — more is better for ATS matching.
- must_have_keywords: ALL terms an ATS would scan for. Include tool names (Python, AWS, Docker), methodologies (Agile, CI/CD), domains (machine learning, data engineering), and role-specific terms. Extract 10-20+ keywords minimum.
- nice_to_have_skills/keywords: Only items explicitly marked as "preferred", "bonus", "nice to have", "plus"
- domain_phrases: Short technical phrases (2-4 words) that signal domain expertise
- responsibilities_summary: Key duties — extract technical terms from each responsibility
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
    """Safely extract JSON from Claude response — handles truncated/markdown-wrapped."""
    text = text.strip()
    # Strip markdown code blocks
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```\s*$', '', text)
    text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try first { to last }
    start = text.find('{')
    end = text.rfind('}') + 1
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    # Try fixing truncated JSON — add missing brackets
    if start != -1:
        fragment = text[start:]
        # Count open/close braces and brackets
        open_braces = fragment.count('{') - fragment.count('}')
        open_brackets = fragment.count('[') - fragment.count(']')
        fixed = fragment
        # Close any open strings
        if fixed.count('"') % 2 != 0:
            fixed += '"'
        # Close arrays and objects
        fixed += ']' * max(0, open_brackets)
        fixed += '}' * max(0, open_braces)
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            pass

    # Return empty dict instead of crashing
    print(f"[JSON] WARNING: Could not parse response ({len(text)} chars), returning empty")
    return {}


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
    analysis["nice_to_have_keywords"] = analysis.get("nice_to_have_keywords") or []

    return analysis
