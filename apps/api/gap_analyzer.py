"""
Pass 2: Gap Analysis
Compares resume content against JD requirements.
Identifies alignment opportunities without fabricating experience.
"""
import json
from anthropic import AsyncAnthropic
from app.core.config import get_settings

settings = get_settings()
client = AsyncAnthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """You are a precise resume-to-job-description alignment analyst.

Your job is to compare a candidate's existing experience against job requirements
and identify where existing bullets can be REPHRASED (not fabricated) to better
highlight relevant skills.

CRITICAL RULES:
1. NEVER suggest adding skills, tools, or experiences the candidate does not have
2. NEVER suggest inventing metrics or numbers
3. Only flag "rewrite_opportunity: true" if the bullet can be improved using EXISTING content
4. If a required skill is genuinely missing, flag it as a "true_gap" — do not suggest faking it
5. "missing_keywords" means keywords that COULD be added through honest rephrasing of existing content"""

USER_PROMPT = """Compare this candidate's resume against the job requirements.

CANDIDATE PROFILE:
{profile_json}

JOB REQUIREMENTS:
{jd_analysis_json}

Analyze each bullet point and return this JSON:
{{
  "bullet_alignments": [
    {{
      "bullet": "exact original bullet text",
      "experience_index": 0,
      "bullet_index": 0,
      "alignment_score": 0,
      "matched_keywords": [],
      "addable_keywords": [],
      "rewrite_opportunity": false,
      "truthfulness_check": "safe|needs_evidence|cannot_add",
      "reason": "brief explanation"
    }}
  ],
  "true_skill_gaps": ["skills completely absent from candidate profile"],
  "unhighlighted_skills": ["candidate has these but didn't emphasize for this role"],
  "summary_score": 0,
  "overall_fit_score": 0,
  "top_strengths": ["what makes this candidate a good fit"],
  "top_gaps": ["most significant missing requirements"]
}}

Scoring guide:
- alignment_score 0-100: how well this bullet demonstrates the requirement
- truthfulness_check: "safe" = rewrite freely, "needs_evidence" = add metric if real, "cannot_add" = missing skill
- overall_fit_score: honest assessment of candidate-job match"""


def build_profile_summary(resume_content: dict) -> dict:
    """Extract just what's needed for gap analysis — keep tokens lean."""
    return {
        "experiences": [
            {
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "bullets": exp.get("bullets", []),
                "skills_used": exp.get("skillsUsed", exp.get("skills_used", [])),
                "index": i,
            }
            for i, exp in enumerate(resume_content.get("experiences", []))
        ],
        "skills": resume_content.get("skills", []),
        "summary": resume_content.get("summary", ""),
    }


async def analyze_gaps(resume_content: dict, jd_analysis: dict) -> dict:
    """
    Pass 2: Compare resume against JD requirements.
    Returns gap analysis with per-bullet alignment scores.
    """
    profile_summary = build_profile_summary(resume_content)

    if not profile_summary["experiences"]:
        return {
            "bullet_alignments": [],
            "true_skill_gaps": jd_analysis.get("required_skills", []),
            "unhighlighted_skills": [],
            "summary_score": 0,
            "overall_fit_score": 0,
            "top_strengths": [],
            "top_gaps": ["No work experience found in resume"],
        }

    # Limit token size
    profile_json = json.dumps(profile_summary, indent=2)[:3000]
    jd_json = json.dumps({
        "required_skills": jd_analysis.get("required_skills", []),
        "must_have_keywords": jd_analysis.get("must_have_keywords", []),
        "nice_to_have_skills": jd_analysis.get("nice_to_have_skills", []),
        "seniority_level": jd_analysis.get("seniority_level", "mid"),
        "responsibilities_summary": jd_analysis.get("responsibilities_summary", []),
    }, indent=2)

    from app.services.tailoring.jd_parser import extract_json_safe

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": USER_PROMPT.format(
                profile_json=profile_json,
                jd_analysis_json=jd_json,
            )
        }]
    )

    raw = message.content[0].text
    result = extract_json_safe(raw)

    # Normalize
    result.setdefault("bullet_alignments", [])
    result.setdefault("true_skill_gaps", [])
    result.setdefault("unhighlighted_skills", [])
    result.setdefault("summary_score", 50)
    result.setdefault("overall_fit_score", 50)
    result.setdefault("top_strengths", [])
    result.setdefault("top_gaps", [])

    return result
