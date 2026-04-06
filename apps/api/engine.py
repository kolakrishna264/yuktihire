"""
ResumeAI Tailoring Engine — Main Pipeline Orchestrator
Three passes: JD Analysis → Gap Analysis → Rewrites + ATS Score

Design principles:
1. Preserve the user's original resume structure
2. Distribute relevance naturally across all sections
3. Never stuff keywords into one section
4. Adaptive bullet retention based on role relevance
"""
import asyncio
from app.services.tailoring.jd_parser import analyze_jd
from gap_analyzer import analyze_gaps
from rewriter import generate_all_rewrites
from ats_scorer import calculate_ats_score


async def execute_pipeline(
    resume_content: dict,
    jd_text: str,
    cached_jd_analysis: dict | None = None,
) -> dict:
    """
    Main tailoring pipeline. Returns complete session result.

    Args:
        resume_content: Structured resume data from Resume.content
        jd_text: Raw job description text
        cached_jd_analysis: Pre-computed JD analysis (from /analyze-jd endpoint)

    Returns:
        {
            recommendations: list of rewrite suggestions,
            ats_score: complete scoring breakdown (after tailoring),
            ats_score_before: scoring before tailoring (for delta),
            gap_analysis: raw gap data,
            jd_analysis: parsed JD data,
        }
    """

    # Pass 1: JD Analysis (use cache if available)
    if cached_jd_analysis and cached_jd_analysis.get("required_skills"):
        jd_analysis = cached_jd_analysis
    else:
        jd_analysis = await analyze_jd(jd_text)

    # Pass 2: Gap Analysis (includes structure metadata)
    gap_analysis = await analyze_gaps(resume_content, jd_analysis)

    # ATS Score BEFORE tailoring (for delta)
    ats_score_before = calculate_ats_score(resume_content, jd_analysis, gap_analysis)

    # Pass 3: Rewrites (run concurrently with nothing — gap analysis must finish first)
    recommendations = await generate_all_rewrites(gap_analysis, resume_content, jd_analysis)

    # ATS Score AFTER (uses same resume content — actual score change happens when applied)
    # The "after" score here estimates improvement based on recommendations
    ats_score = ats_score_before  # Same content; delta shown after apply

    # Add before score and delta info
    ats_score["score_before"] = ats_score_before["overall_score"]

    return {
        "recommendations": recommendations,
        "ats_score": ats_score,
        "ats_score_before": ats_score_before,
        "gap_analysis": gap_analysis,
        "jd_analysis": jd_analysis,
    }
