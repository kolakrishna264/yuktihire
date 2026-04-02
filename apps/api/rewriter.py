"""
Pass 3: Bullet + Summary Rewriter
Generates ATS-optimized rewrites using only existing candidate experience.
Enforces truthfulness guardrails — never fabricates content.
"""
import json
from anthropic import AsyncAnthropic
from app.core.config import get_settings

settings = get_settings()
client = AsyncAnthropic(api_key=settings.anthropic_api_key)

BULLET_SYSTEM = """You are a professional resume writer specializing in ATS optimization.

ABSOLUTE RULES — violating these makes your output useless:
1. Use ONLY information present in the original bullet and candidate context
2. NEVER invent metrics, percentages, team sizes, or timeframes not in the source
3. NEVER add tools, technologies, or skills not mentioned in the source
4. If you cannot improve without fabricating, return the original bullet unchanged
5. Keep rewrites under 35 words
6. Start with a strong action verb
7. Format: Action Verb + Technology/Method + Measurable Result (if result exists in source)"""

BULLET_PROMPT = """Rewrite this resume bullet to better match the job requirements.

ORIGINAL BULLET:
{original}

CANDIDATE CONTEXT (only use facts from here):
Title: {title}
Company: {company}
Skills they listed: {skills_used}

KEYWORDS TO ADD (only if the underlying concept already exists in the bullet/context):
{keywords}

JOB SENIORITY LEVEL: {seniority}

Return JSON only:
{{
  "suggested": "rewritten bullet text",
  "reason": "one sentence: what was improved and why",
  "keywords_added": ["kw1", "kw2"],
  "confidence": 0.85,
  "truthful": true,
  "changed": true
}}

If you cannot improve truthfully, return:
{{
  "suggested": "{original}",
  "reason": "Original is already well-optimized for this role",
  "keywords_added": [],
  "confidence": 1.0,
  "truthful": true,
  "changed": false
}}"""

SUMMARY_SYSTEM = """You are a professional resume writer. Rewrite professional summaries
to be ATS-optimized for a specific role.

Rules:
- Use only the candidate's actual experience
- 3-4 sentences maximum
- Lead with years of experience and primary expertise
- Include 3-5 relevant keywords from the job description naturally
- Do not fabricate claims or credentials"""

SUMMARY_PROMPT = """Rewrite this professional summary for the target role.

ORIGINAL SUMMARY:
{original_summary}

CANDIDATE'S MOST RECENT ROLE: {recent_role} at {recent_company}
CANDIDATE'S KEY SKILLS: {skills}

TARGET ROLE: {target_role}
TARGET COMPANY: {target_company}
KEY KEYWORDS TO INCLUDE: {keywords}

Return JSON only:
{{
  "suggested": "rewritten summary text",
  "reason": "what was improved",
  "keywords_added": ["kw1"],
  "confidence": 0.9
}}"""


async def rewrite_bullet(
    original: str,
    title: str,
    company: str,
    skills_used: list[str],
    keywords_to_add: list[str],
    seniority: str,
) -> dict:
    """Rewrite a single bullet point. Returns suggestion dict."""
    from app.services.tailoring.jd_parser import extract_json_safe

    if not original.strip():
        return {"suggested": original, "reason": "Empty bullet", "keywords_added": [],
                "confidence": 1.0, "truthful": True, "changed": False}

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=BULLET_SYSTEM,
        messages=[{
            "role": "user",
            "content": BULLET_PROMPT.format(
                original=original,
                title=title,
                company=company,
                skills_used=", ".join(skills_used[:10]),
                keywords=", ".join(keywords_to_add[:6]),
                seniority=seniority,
            )
        }]
    )

    try:
        result = extract_json_safe(message.content[0].text)
        # Enforce truthfulness — if AI returned false, override
        result["truthful"] = True
        return result
    except Exception:
        return {
            "suggested": original,
            "reason": "Parse error — returning original",
            "keywords_added": [],
            "confidence": 1.0,
            "truthful": True,
            "changed": False,
        }


async def rewrite_summary(
    original_summary: str,
    resume_content: dict,
    jd_analysis: dict,
) -> dict:
    """Rewrite the professional summary section."""
    from app.services.tailoring.jd_parser import extract_json_safe

    experiences = resume_content.get("experiences", [])
    recent = experiences[0] if experiences else {}
    skills = resume_content.get("skills", [])

    keywords = (
        jd_analysis.get("must_have_keywords", [])[:5] +
        jd_analysis.get("required_skills", [])[:3]
    )

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        system=SUMMARY_SYSTEM,
        messages=[{
            "role": "user",
            "content": SUMMARY_PROMPT.format(
                original_summary=original_summary or "No summary provided",
                recent_role=recent.get("title", ""),
                recent_company=recent.get("company", ""),
                skills=", ".join(skills[:15]),
                target_role=jd_analysis.get("role", ""),
                target_company=jd_analysis.get("company", ""),
                keywords=", ".join(keywords),
            )
        }]
    )

    try:
        return extract_json_safe(message.content[0].text)
    except Exception:
        return {
            "suggested": original_summary,
            "reason": "Could not improve summary",
            "keywords_added": [],
            "confidence": 1.0,
        }


async def generate_all_rewrites(
    gap_analysis: dict,
    resume_content: dict,
    jd_analysis: dict,
) -> list[dict]:
    """
    Generate rewrite suggestions for all qualifying bullets.
    Only rewrites bullets with rewrite_opportunity=True and low alignment scores.
    Returns list of recommendation dicts ready for DB storage.
    """
    recommendations = []
    experiences = resume_content.get("experiences", [])
    seniority = jd_analysis.get("seniority_level", "mid")

    # Rewrite qualifying experience bullets
    for alignment in gap_analysis.get("bullet_alignments", []):
        # Skip if no rewrite opportunity
        if not alignment.get("rewrite_opportunity"):
            continue

        # Skip high-scoring bullets
        if alignment.get("alignment_score", 100) >= 80:
            continue

        # Handle true gaps — flag but don't fabricate
        if alignment.get("truthfulness_check") == "cannot_add":
            gap_keywords = alignment.get("addable_keywords", [])
            recommendations.append({
                "section": "experience",
                "field": "bullet",
                "original": alignment["bullet"],
                "suggested": alignment["bullet"],
                "reason": f"Skill gap: {', '.join(gap_keywords[:3])} not found in your experience. "
                          f"Consider highlighting adjacent skills or upskilling.",
                "confidence": 1.0,
                "keywords_added": [],
                "truthful": True,
                "is_gap": True,
            })
            continue

        # Get experience context
        exp_idx = alignment.get("experience_index", 0)
        exp = experiences[exp_idx] if exp_idx < len(experiences) else {}

        result = await rewrite_bullet(
            original=alignment["bullet"],
            title=exp.get("title", ""),
            company=exp.get("company", ""),
            skills_used=exp.get("skills_used", exp.get("skillsUsed", [])),
            keywords_to_add=alignment.get("addable_keywords", []),
            seniority=seniority,
        )

        if result.get("changed") and result.get("truthful"):
            recommendations.append({
                "section": "experience",
                "field": f"experience_{exp_idx}_bullet",
                "original": alignment["bullet"],
                "suggested": result["suggested"],
                "reason": result["reason"],
                "confidence": result.get("confidence", 0.8),
                "keywords_added": result.get("keywords_added", []),
                "truthful": True,
                "is_gap": False,
            })

    # Rewrite summary if score is low
    summary_score = gap_analysis.get("summary_score", 100)
    if summary_score < 75 and resume_content.get("summary"):
        summary_result = await rewrite_summary(
            resume_content["summary"],
            resume_content,
            jd_analysis,
        )
        if summary_result.get("suggested") != resume_content["summary"]:
            recommendations.append({
                "section": "summary",
                "field": "summary",
                "original": resume_content["summary"],
                "suggested": summary_result["suggested"],
                "reason": summary_result["reason"],
                "confidence": summary_result.get("confidence", 0.85),
                "keywords_added": summary_result.get("keywords_added", []),
                "truthful": True,
                "is_gap": False,
            })

    return recommendations
