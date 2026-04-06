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
    # Handle both flat and categorized skill formats
    for skill in resume_content.get("skills", []):
        if isinstance(skill, str):
            parts.append(skill)
        elif isinstance(skill, dict):
            if "items" in skill:
                # Categorized format: {category: "Languages", items: ["Python", ...]}
                parts.extend(skill.get("items", []))
            elif "name" in skill:
                # Legacy format: {name: "Python", category: "Languages"}
                parts.append(skill.get("name", ""))
    for edu in resume_content.get("educations", []):
        parts.append(edu.get("degree", ""))
        parts.append(edu.get("field", ""))
        parts.append(edu.get("school", ""))
    for proj in resume_content.get("projects", []):
        parts.extend(proj.get("bullets", []))
        parts.extend(proj.get("skills", []))
    return " ".join(str(p) for p in parts if p).lower()


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


def extract_all_jd_keywords(jd_analysis: dict) -> list[str]:
    """Extract meaningful keywords — ONLY must-have and required skills (not nice-to-have).
    Nice-to-have dilutes the score by inflating the denominator."""
    keywords = set()
    # ONLY primary required keywords — this keeps the denominator realistic
    for field in ["must_have_keywords", "required_skills"]:
        for kw in jd_analysis.get(field, []):
            if isinstance(kw, str) and 1 < len(kw) < 50:
                keywords.add(kw)
    # Add domain phrases only if short (technical terms, not sentences)
    for kw in jd_analysis.get("domain_phrases", []):
        if isinstance(kw, str) and len(kw.split()) <= 3 and len(kw) < 40:
            keywords.add(kw)
    return list(keywords)


def extract_nice_to_have(jd_analysis: dict) -> list[str]:
    """Extract nice-to-have keywords separately — scored with lower weight."""
    keywords = set()
    for field in ["nice_to_have_keywords", "nice_to_have_skills"]:
        for kw in jd_analysis.get(field, []):
            if isinstance(kw, str) and 1 < len(kw) < 50:
                keywords.add(kw)
    return list(keywords)


def calculate_ats_score(
    resume_content: dict,
    jd_analysis: dict,
    gap_analysis: dict,
) -> dict:
    """
    Full ATS scoring. Returns complete score breakdown.
    Designed to give actionable scores — adding suggested keywords should push to 85%+.
    """
    resume_text = extract_resume_text(resume_content)

    # Extract keywords
    all_keywords = extract_all_jd_keywords(jd_analysis)
    must_have = jd_analysis.get("must_have_keywords", [])
    required_skills = jd_analysis.get("required_skills", [])

    # ── Component scores (inspired by Jobscan/Simplify scoring) ──

    # Title alignment — does resume title match JD role?
    target_role = (jd_analysis.get("role", "") or "").lower()
    title_score = 70  # Default: most resumes have somewhat relevant titles
    if target_role:
        for exp in resume_content.get("experiences", []):
            exp_title = (exp.get("title", "") or "").lower()
            if target_role in exp_title or exp_title in target_role:
                title_score = 95
                break
            role_words = set(w for w in target_role.split() if len(w) > 2)
            title_words = set(w for w in exp_title.split() if len(w) > 2)
            overlap = role_words & title_words
            if overlap:
                title_score = max(title_score, 70 + len(overlap) * 10)

    # Must-have keyword score (PRIMARY — this is what ATS actually checks)
    kw_score, matched_kw, missing_kw = keyword_match_score(resume_text, all_keywords)

    # Nice-to-have bonus (doesn't penalize, only adds)
    nice_to_have = extract_nice_to_have(jd_analysis)
    nth_score, matched_nth, _ = keyword_match_score(resume_text, nice_to_have) if nice_to_have else (0, [], [])

    # Must-have separate tracking
    mh_score, matched_mh, missing_mh = keyword_match_score(resume_text, must_have) if must_have else (100, [], [])

    # Skills score — required skills only
    skills_scr, matched_skills, missing_skills = skills_match_score(resume_text, required_skills)

    # Experience score — from gap analysis, generous floor
    exp_score = max(experience_score_from_gaps(gap_analysis), 55)

    # Summary relevance
    summary = (resume_content.get("summary", "") or "").lower()
    summary_kw_count = sum(1 for kw in (must_have + required_skills)[:10] if kw.lower() in summary)
    summary_score = min(95, 55 + summary_kw_count * 8) if summary else 30

    # Education score
    edu_scr = education_score(resume_content, jd_analysis)

    # Format score
    fmt_scr = format_score(resume_content)

    # ── Weighted overall — designed to reach 75-85% for well-matched resumes ──
    # Inspired by how Jobscan/Simplify weight components
    overall = int(
        kw_score * 0.25 +       # Must-have keywords: 25% (most important)
        skills_scr * 0.20 +     # Required skills: 20%
        exp_score * 0.15 +      # Experience relevance: 15%
        title_score * 0.10 +    # Title alignment: 10%
        summary_score * 0.10 +  # Summary relevance: 10%
        edu_scr * 0.10 +        # Education: 10%
        fmt_scr * 0.10          # Format: 10%
    )

    # Nice-to-have bonus (up to +10)
    if nth_score > 0:
        overall = min(overall + int(nth_score * 0.10), 100)

    # Boosts for strong profiles
    if kw_score >= 60 and skills_scr >= 50:
        overall = min(overall + 8, 100)
    if mh_score >= 70:
        overall = min(overall + 5, 100)
    if title_score >= 80:
        overall = min(overall + 3, 100)

    # Floor: if resume has relevant experience, minimum 50%
    if exp_score >= 55 and skills_scr >= 30:
        overall = max(overall, 50)
    # If keywords match well, minimum 60%
    if kw_score >= 50:
        overall = max(overall, 58)

    section_scores = {
        "summary": summary_score,
        "experience": exp_score,
        "skills": skills_scr,
        "education": edu_scr,
        "format": fmt_scr,
        "keywords": kw_score,
        "mustHave": mh_score,
        "titleAlignment": title_score,
    }

    tips = generate_tips(missing_kw, missing_skills, gap_analysis, [])

    # Separate blockers: what can be fixed vs what requires real experience
    true_gaps = gap_analysis.get("true_skill_gaps", [])
    fixable_blockers = []
    unfixable_blockers = []
    for kw in missing_mh[:5]:
        # Check if the missing must-have is a skill the user could add vs genuinely doesn't have
        if any(kw.lower() in tg.lower() for tg in true_gaps):
            unfixable_blockers.append(kw)
        else:
            fixable_blockers.append(kw)

    if overall < 85:
        if fixable_blockers:
            tips.insert(0, f"Add these keywords to boost score: {', '.join(fixable_blockers[:5])}")
        if unfixable_blockers:
            tips.append(f"Missing experience in: {', '.join(unfixable_blockers[:3])} (cannot fix with resume edits)")

    return {
        "overall_score": min(overall, 100),
        "keyword_score": kw_score,
        "skills_score": skills_scr,
        "experience_score": exp_score,
        "education_score": edu_scr,
        "format_score": fmt_scr,
        "must_have_score": mh_score,
        "matched_keywords": matched_kw,
        "missing_keywords": missing_kw[:20],
        "missing_must_have": missing_mh[:10],
        "matched_skills": matched_skills,
        "missing_skills": missing_skills[:15],
        "section_scores": section_scores,
        "fixable_blockers": fixable_blockers[:5],
        "unfixable_blockers": unfixable_blockers[:5],
        "tips": tips,
    }
