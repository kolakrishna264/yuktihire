"""
ResumeAI Tailoring Engine — Main Pipeline Orchestrator
Three passes: JD Analysis → Gap Analysis → Rewrites + ATS Score
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
            ats_score: complete scoring breakdown,
            gap_analysis: raw gap data,
            jd_analysis: parsed JD data,
        }
    """

    # Pass 1: JD Analysis (use cache if available)
    if cached_jd_analysis and cached_jd_analysis.get("required_skills"):
        jd_analysis = cached_jd_analysis
    else:
        jd_analysis = await analyze_jd(jd_text)

    # Pass 2: Gap Analysis
    gap_analysis = await analyze_gaps(resume_content, jd_analysis)

    # Pass 3: Rewrites (run concurrently with ATS scoring)
    rewrites_task = asyncio.create_task(
        generate_all_rewrites(gap_analysis, resume_content, jd_analysis)
    )

    # ATS Score (synchronous, no AI needed)
    ats_score = calculate_ats_score(resume_content, jd_analysis, gap_analysis)

    # Wait for rewrites
    recommendations = await rewrites_task

    return {
        "recommendations": recommendations,
        "ats_score": ats_score,
        "gap_analysis": gap_analysis,
        "jd_analysis": jd_analysis,
    }
