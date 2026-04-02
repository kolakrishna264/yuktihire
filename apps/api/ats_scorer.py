"""
ATS Scorer — Rules-based, deterministic, no AI needed.
Fast, consistent, explainable scoring against JD requirements.
"""
import re


def extract_resume_text(resume_content: dict) -> str:
    """Flatten all resume text into one searchable string."""
    parts = []
    if resume_content.get("summary"):
        parts.append(resume_content["summary"])
    for exp in resume_content.get("experiences", []):
        parts.append(exp.get("title", ""))
        parts.append(exp.get("company", ""))
        parts.extend(exp.get("bullets", []))
        parts.extend(exp.get("skills_used", exp.get("skillsUsed", [])))
    parts.extend(resume_content.get("skills", []))
    for edu in resume_content.get("educations", []):
        parts.append(edu.get("degree", ""))
        parts.append(edu.get("field", ""))
        parts.append(edu.get("school", ""))
    for proj in resume_content.get("projects", []):
        parts.extend(proj.get("bullets", []))
        parts.extend(proj.get("skills", []))
    return " ".join(p for p in parts if p).lower()


def keyword_match_score(resume_text: str, keywords: list[str]) -> tuple[int, list[str], list[str]]:
    """Returns (score, matched, missing)."""
    if not keywords:
        return 85, [], []
    matched = []
    missing = []
    for kw in keywords:
        # Flexible match: partial words, case-insensitive
        pattern = re.compile(re.escape(kw.lower()), re.IGNORECASE)
        if pattern.search(resume_text):
            matched.append(kw)
        else:
            missing.append(kw)
    score = int(len(matched) / len(keywords) * 100)
    return score, matched, missing


def skills_match_score(resume_text: str, required_skills: list[str]) -> tuple[int, list[str], list[str]]:
    """Match required skills against resume text."""
    if not required_skills:
        return 80, [], []
    matched = []
    missing = []
    for skill in required_skills:
        # Handle multi-word skills and abbreviations
        skill_lower = skill.lower()
        if skill_lower in resume_text:
            matched.append(skill)
        else:
            # Try first word match for things like "Python (3.x)" -> "python"
            first_word = skill_lower.split()[0]
            if len(first_word) > 2 and first_word in resume_text:
                matched.append(skill)
            else:
                missing.append(skill)
    score = int(len(matched) / len(required_skills) * 100)
    return score, matched, missing


def experience_score_from_gaps(gap_analysis: dict) -> int:
    """Derive experience score from gap analysis bullet alignment scores."""
    alignments = gap_analysis.get("bullet_alignments", [])
    if not alignments:
        return 50
    scores = [a.get("alignment_score", 50) for a in alignments]
    return int(sum(scores) / len(scores))


def education_score(resume_content: dict, jd_analysis: dict) -> int:
    """Check if education meets JD requirements."""
    required_edu = jd_analysis.get("education_required", "any")
    if required_edu in [None, "any", "null"]:
        return 90

    educations = resume_content.get("educations", [])
    if not educations:
        return 40 if required_edu in ["bachelors", "masters", "phd"] else 80

    # Check if highest degree meets requirement
    degree_rank = {"associate": 1, "bachelors": 2, "masters": 3, "phd": 4, "mba": 3}
    required_rank = degree_rank.get(required_edu.lower(), 2)

    for edu in educations:
        degree_text = (edu.get("degree", "") + " " + edu.get("field", "")).lower()
        for deg_name, rank in degree_rank.items():
            if deg_name in degree_text and rank >= required_rank:
                return 95
    return 60


def format_score(resume_content: dict) -> int:
    """Rules-based format checks for ATS compatibility."""
    score = 100
    deductions = []

    content = resume_content

    # Must have contact info
    contact = content.get("contact", {})
    if not contact.get("email") and not content.get("email"):
        score -= 15
        deductions.append("Missing email address")

    # Must have work experience section
    if not content.get("experiences"):
        score -= 20
        deductions.append("No work experience section")

    # Check for ATS-unfriendly elements
    if content.get("has_tables"):
        score -= 20
        deductions.append("Tables detected — ATS cannot read tables")

    if content.get("has_images"):
        score -= 10
        deductions.append("Images detected — ATS ignores images")

    if content.get("has_columns"):
        score -= 10
        deductions.append("Multi-column layout may confuse ATS parsers")

    # Check bullet quality
    all_bullets = []
    for exp in content.get("experiences", []):
        all_bullets.extend(exp.get("bullets", []))

    if all_bullets:
        avg_len = sum(len(b.split()) for b in all_bullets) / len(all_bullets)
        if avg_len < 8:
            score -= 5
            deductions.append("Bullets too short (aim for 15-25 words)")
        if avg_len > 40:
            score -= 5
            deductions.append("Bullets too long (aim for 15-25 words)")

    return max(score, 0)


def generate_tips(
    missing_keywords: list[str],
    missing_skills: list[str],
    gap_analysis: dict,
    format_issues: list[str],
) -> list[str]:
    tips = []
    if missing_keywords[:3]:
        tips.append(f"Add these keywords: {', '.join(missing_keywords[:3])}")
    if missing_skills[:3]:
        tips.append(f"Missing required skills: {', '.join(missing_skills[:3])}")
    true_gaps = gap_analysis.get("true_skill_gaps", [])
    if true_gaps[:2]:
        tips.append(f"Skill gaps to address: {', '.join(true_gaps[:2])}")
    tips.extend(format_issues[:2])
    unhighlighted = gap_analysis.get("unhighlighted_skills", [])
    if unhighlighted:
        tips.append(f"You have these skills but didn't highlight them: {', '.join(unhighlighted[:3])}")
    return tips[:6]


def calculate_ats_score(
    resume_content: dict,
    jd_analysis: dict,
    gap_analysis: dict,
) -> dict:
    """
    Full ATS scoring. Deterministic, no AI.
    Returns complete score breakdown.
    """
    resume_text = extract_resume_text(resume_content)

    # Keyword score (30% weight)
    kw_score, matched_kw, missing_kw = keyword_match_score(
        resume_text, jd_analysis.get("must_have_keywords", [])
    )

    # Skills score (25% weight)
    skills_scr, matched_skills, missing_skills = skills_match_score(
        resume_text, jd_analysis.get("required_skills", [])
    )

    # Experience score (25% weight) — from gap analysis
    exp_score = experience_score_from_gaps(gap_analysis)

    # Education score (10% weight)
    edu_scr = education_score(resume_content, jd_analysis)

    # Format score (10% weight)
    fmt_scr = format_score(resume_content)

    # Weighted overall
    overall = int(
        kw_score * 0.30 +
        skills_scr * 0.25 +
        exp_score * 0.25 +
        edu_scr * 0.10 +
        fmt_scr * 0.10
    )

    # Section scores
    section_scores = {
        "summary": gap_analysis.get("summary_score", 60),
        "experience": exp_score,
        "skills": skills_scr,
        "education": edu_scr,
        "format": fmt_scr,
    }

    tips = generate_tips(missing_kw, missing_skills, gap_analysis, [])

    return {
        "overall_score": min(overall, 100),
        "keyword_score": kw_score,
        "skills_score": skills_scr,
        "experience_score": exp_score,
        "education_score": edu_scr,
        "format_score": fmt_scr,
        "matched_keywords": matched_kw,
        "missing_keywords": missing_kw[:10],
        "matched_skills": matched_skills,
        "missing_skills": missing_skills[:10],
        "section_scores": section_scores,
        "tips": tips,
    }
