"""
ATS Scorer — Rules-based, deterministic, no AI needed.
Fast, consistent, explainable scoring against JD requirements.

Key design principle: keyword PLACEMENT quality matters.
A keyword in a relevant experience bullet is worth more than one dumped into skills.
"""
import re


# Common tech synonyms — ATS systems often treat these as equivalent
SYNONYMS = {
    "ml": ["machine learning"],
    "machine learning": ["ml"],
    "ai": ["artificial intelligence"],
    "artificial intelligence": ["ai"],
    "nlp": ["natural language processing"],
    "natural language processing": ["nlp"],
    "dl": ["deep learning"],
    "deep learning": ["dl"],
    "js": ["javascript"],
    "javascript": ["js"],
    "ts": ["typescript"],
    "typescript": ["ts"],
    "k8s": ["kubernetes"],
    "kubernetes": ["k8s"],
    "postgres": ["postgresql"],
    "postgresql": ["postgres"],
    "ci/cd": ["cicd", "ci cd", "continuous integration", "continuous deployment"],
    "aws": ["amazon web services"],
    "amazon web services": ["aws"],
    "gcp": ["google cloud", "google cloud platform"],
    "google cloud": ["gcp"],
    "azure": ["microsoft azure"],
    "react.js": ["react", "reactjs"],
    "react": ["react.js", "reactjs"],
    "node.js": ["node", "nodejs"],
    "node": ["node.js", "nodejs"],
    "next.js": ["next", "nextjs"],
    "scikit-learn": ["scikit", "sklearn"],
    "tensorflow": ["tf"],
    "pytorch": ["torch"],
    "llm": ["large language model", "large language models"],
    "large language model": ["llm"],
    "rag": ["retrieval augmented generation", "retrieval-augmented generation"],
    "api": ["apis", "rest api", "restful"],
    "rest api": ["api", "restful api"],
    "sql": ["structured query language"],
    "nosql": ["no-sql", "non-relational"],
    "oop": ["object oriented", "object-oriented"],
    "sre": ["site reliability"],
    "devops": ["dev ops"],
    "etl": ["extract transform load"],
    "sagemaker": ["sage maker", "aws sagemaker"],
    "genai": ["generative ai", "gen ai"],
    "generative ai": ["genai", "gen ai"],
    "llms": ["llm", "large language models"],
}


def _extract_section_texts(resume_content: dict) -> dict:
    """Extract text by section for placement-quality scoring."""
    sections = {}

    # Summary
    sections["summary"] = (resume_content.get("summary") or "").lower()

    # Skills (flattened)
    skill_parts = []
    for skill in resume_content.get("skills", []):
        if isinstance(skill, str):
            skill_parts.append(skill)
        elif isinstance(skill, dict):
            if "items" in skill:
                skill_parts.extend(skill.get("items", []))
            elif "skills" in skill:
                skill_parts.extend(skill.get("skills", []))
            elif "name" in skill:
                skill_parts.append(skill.get("name", ""))
    sections["skills"] = " ".join(str(p) for p in skill_parts if p).lower()

    # Experience bullets
    exp_parts = []
    for exp in resume_content.get("experiences", []):
        exp_parts.append(exp.get("title", ""))
        exp_parts.append(exp.get("company", ""))
        exp_parts.extend(exp.get("bullets", []))
        exp_parts.extend(exp.get("skills_used", exp.get("skillsUsed", [])))
    sections["experience"] = " ".join(str(p) for p in exp_parts if p).lower()

    # Projects
    proj_parts = []
    for proj in resume_content.get("projects", []):
        proj_parts.append(proj.get("name", ""))
        proj_parts.append(proj.get("description", ""))
        proj_parts.extend(proj.get("bullets", []))
        proj_parts.extend(proj.get("skills", []))
    sections["projects"] = " ".join(str(p) for p in proj_parts if p).lower()

    # Education
    edu_parts = []
    for edu in resume_content.get("educations", []):
        edu_parts.append(edu.get("degree", ""))
        edu_parts.append(edu.get("field", ""))
        edu_parts.append(edu.get("school", ""))
    sections["education"] = " ".join(str(p) for p in edu_parts if p).lower()

    # All text combined
    sections["all"] = " ".join(sections.values())

    return sections


def _matches_with_synonyms(keyword: str, text: str) -> bool:
    """Check if keyword or any of its synonyms appear in text."""
    kw_lower = keyword.lower().strip()

    # Direct match
    if kw_lower in text:
        return True

    # Word-boundary match for short keywords
    if len(kw_lower) <= 3:
        pattern = r'\b' + re.escape(kw_lower) + r'\b'
        if re.search(pattern, text):
            return True

    # Synonym expansion
    for syn in SYNONYMS.get(kw_lower, []):
        if syn.lower() in text:
            return True

    # Multi-word partial: all significant words present
    words = kw_lower.split()
    if len(words) >= 2:
        sig_words = [w for w in words if len(w) > 2]
        if sig_words and all(w in text for w in sig_words):
            return True

    return False


def keyword_match_score(text: str, keywords: list[str]) -> tuple[int, list[str], list[str]]:
    """Returns (score, matched, missing) with synonym awareness."""
    if not keywords:
        return 85, [], []
    matched = []
    missing = []
    for kw in keywords:
        if _matches_with_synonyms(kw, text):
            matched.append(kw)
        else:
            missing.append(kw)
    score = int(len(matched) / len(keywords) * 100)
    return score, matched, missing


def keyword_placement_score(sections: dict, keywords: list[str]) -> tuple[int, dict]:
    """
    Score keywords by WHERE they appear, not just IF they appear.

    Placement weights:
    - In experience bullets: 1.0 (best — shows real usage)
    - In summary: 0.9 (good — shows awareness)
    - In skills section: 0.7 (acceptable — but can look like stuffing)
    - In projects: 0.85 (good — shows hands-on work)
    - Only in wrong section: 0.4 (penalized — keyword stuffing)

    Returns (placement_quality_score 0-100, detail_dict)
    """
    if not keywords:
        return 85, {}

    placement_details = {}
    total_weighted = 0
    found_count = 0

    for kw in keywords:
        in_exp = _matches_with_synonyms(kw, sections.get("experience", ""))
        in_summary = _matches_with_synonyms(kw, sections.get("summary", ""))
        in_skills = _matches_with_synonyms(kw, sections.get("skills", ""))
        in_projects = _matches_with_synonyms(kw, sections.get("projects", ""))
        in_any = _matches_with_synonyms(kw, sections.get("all", ""))

        if not in_any:
            placement_details[kw] = {"found": False, "weight": 0, "best_section": "missing"}
            continue

        found_count += 1

        # Calculate placement weight — experience >> summary >> skills-only
        # Skills-only gets very low weight to discourage keyword stuffing
        if in_exp:
            weight = 1.0
            best = "experience"
        elif in_summary:
            weight = 0.8
            best = "summary"
        elif in_projects:
            weight = 0.75
            best = "projects"
        elif in_skills:
            weight = 0.4   # Heavily penalized — keyword only in skills = likely stuffed
            best = "skills_only"
        else:
            weight = 0.3
            best = "other"

        # Bonus for appearing in multiple relevant sections
        section_count = sum([in_exp, in_summary, in_skills, in_projects])
        if section_count >= 2:
            weight = min(weight + 0.1, 1.0)

        total_weighted += weight
        placement_details[kw] = {"found": True, "weight": weight, "best_section": best}

    if found_count == 0:
        return 0, placement_details

    max_possible = len(keywords)
    placement_score = int((total_weighted / max_possible) * 100)
    return placement_score, placement_details


def skills_match_score(text: str, required_skills: list[str]) -> tuple[int, list[str], list[str]]:
    """Match required skills against text with synonym awareness."""
    if not required_skills:
        return 80, [], []
    matched = []
    missing = []
    for skill in required_skills:
        if _matches_with_synonyms(skill, text):
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

    degree_rank = {"associate": 1, "bachelors": 2, "masters": 3, "phd": 4, "mba": 3}
    required_rank = degree_rank.get(required_edu.lower(), 2)

    for edu in educations:
        degree_text = (edu.get("degree", "") + " " + edu.get("field", "")).lower()
        for deg_name, rank in degree_rank.items():
            if deg_name in degree_text and rank >= required_rank:
                return 95
        abbrevs = {"b.s.": 2, "b.tech": 2, "b.a.": 2, "m.s.": 3, "m.tech": 3, "m.a.": 3, "ph.d": 4}
        for abbr, rank in abbrevs.items():
            if abbr in degree_text and rank >= required_rank:
                return 95
    return 60


def format_score(resume_content: dict) -> int:
    """Rules-based format checks for ATS compatibility."""
    score = 100
    content = resume_content

    contact = content.get("contact", {})
    if not contact.get("email") and not content.get("email"):
        score -= 10

    if not content.get("experiences"):
        score -= 15

    if content.get("has_tables"):
        score -= 15
    if content.get("has_images"):
        score -= 5

    # Check bullet quality
    all_bullets = []
    for exp in content.get("experiences", []):
        all_bullets.extend(exp.get("bullets", []))

    if all_bullets:
        avg_len = sum(len(b.split()) for b in all_bullets) / len(all_bullets)
        if avg_len < 8:
            score -= 5
        if avg_len > 40:
            score -= 5

    if content.get("skills"):
        score = min(score + 5, 100)
    if content.get("summary"):
        score = min(score + 5, 100)

    return max(score, 0)


def generate_tips(
    missing_keywords: list[str],
    missing_skills: list[str],
    gap_analysis: dict,
    placement_details: dict,
) -> list[str]:
    """Generate actionable, deduplicated tips grouped by section."""
    tips = []
    seen = set()

    # Skills-only keywords (in skills but not in experience — potential stuffing)
    skills_only = [kw for kw, detail in placement_details.items()
                   if detail.get("best_section") == "skills_only"]
    if skills_only:
        tips.append(f"Strengthen these by adding them to experience bullets too: {', '.join(skills_only[:3])}")
        seen.update(s.lower() for s in skills_only[:3])

    # Missing keywords
    for kw in missing_keywords[:4]:
        if kw.lower() not in seen:
            tips.append(f"Add keyword: {kw}")
            seen.add(kw.lower())

    # Missing skills (real tools only)
    for skill in missing_skills[:3]:
        if skill.lower() not in seen:
            tips.append(f"Missing skill: {skill}")
            seen.add(skill.lower())

    # True gaps
    true_gaps = gap_analysis.get("true_skill_gaps", [])
    for gap in true_gaps[:2]:
        if gap.lower() not in seen:
            tips.append(f"Skill gap (needs real experience): {gap}")
            seen.add(gap.lower())

    # Unhighlighted
    unhighlighted = gap_analysis.get("unhighlighted_skills", [])
    if unhighlighted:
        uh = [s for s in unhighlighted[:3] if s.lower() not in seen]
        if uh:
            tips.append(f"You have these but didn't highlight them: {', '.join(uh)}")

    return tips[:8]


def extract_all_jd_keywords(jd_analysis: dict) -> list[str]:
    """Extract meaningful keywords — must-have, required skills, domain phrases."""
    keywords = set()
    for field in ["must_have_keywords", "required_skills"]:
        for kw in jd_analysis.get(field, []):
            if isinstance(kw, str) and 1 < len(kw) < 50:
                keywords.add(kw)
    for kw in jd_analysis.get("domain_phrases", []):
        if isinstance(kw, str) and len(kw.split()) <= 3 and len(kw) < 40:
            keywords.add(kw)
    # Technical terms from responsibilities
    for resp in jd_analysis.get("responsibilities_summary", []):
        if isinstance(resp, str):
            tech_terms = re.findall(r'\b[A-Z][a-zA-Z+#.]+(?:\s+[A-Z][a-zA-Z+#.]+)?\b', resp)
            for term in tech_terms:
                if 2 < len(term) < 30 and term.lower() not in {"the", "and", "for", "with", "our", "you", "your"}:
                    keywords.add(term)
    return list(keywords)


def extract_nice_to_have(jd_analysis: dict) -> list[str]:
    """Extract nice-to-have keywords separately."""
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
    Full ATS scoring with placement quality.

    Key difference from naive scoring: WHERE a keyword appears matters.
    Experience bullet match > Summary match > Skills-only match.
    This prevents keyword stuffing from inflating scores.
    """
    sections = _extract_section_texts(resume_content)
    resume_text = sections["all"]

    # Extract keywords
    all_keywords = extract_all_jd_keywords(jd_analysis)
    must_have = jd_analysis.get("must_have_keywords", [])
    required_skills = jd_analysis.get("required_skills", [])

    # ── Component scores ──

    # Title alignment
    target_role = (jd_analysis.get("role", "") or "").lower()
    title_score = 70
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
            for rw in role_words:
                for syn in SYNONYMS.get(rw, []):
                    if syn in exp_title:
                        title_score = max(title_score, 80)

    # Keyword match (basic: present anywhere)
    kw_score, matched_kw, missing_kw = keyword_match_score(resume_text, all_keywords)

    # Keyword placement quality (WHERE they appear — the anti-stuffing metric)
    placement_score, placement_details = keyword_placement_score(sections, all_keywords)

    # Nice-to-have bonus
    nice_to_have = extract_nice_to_have(jd_analysis)
    nth_score, matched_nth, _ = keyword_match_score(resume_text, nice_to_have) if nice_to_have else (0, [], [])

    # Must-have separate tracking
    mh_score, matched_mh, missing_mh = keyword_match_score(resume_text, must_have) if must_have else (100, [], [])

    # Skills score — required skills only
    skills_scr, matched_skills, missing_skills = skills_match_score(resume_text, required_skills)

    # Experience score from gap analysis
    exp_score = max(experience_score_from_gaps(gap_analysis), 55)

    # Summary relevance
    summary = sections.get("summary", "")
    target_kws = (must_have + required_skills)[:15]
    summary_kw_count = sum(1 for kw in target_kws if _matches_with_synonyms(kw, summary))
    summary_score = min(95, 50 + summary_kw_count * 7) if summary else 30

    # Education score
    edu_scr = education_score(resume_content, jd_analysis)

    # Format score
    fmt_scr = format_score(resume_content)

    # Project relevance
    proj_text = sections.get("projects", "")
    proj_kw_count = sum(1 for kw in target_kws if _matches_with_synonyms(kw, proj_text))
    proj_score = min(95, 40 + proj_kw_count * 10) if proj_text else 50

    # ── Weighted overall: experience > summary > skills ──
    # Experience and placement quality are the most important signals.
    # Skills presence alone contributes very little — prevents stuffing inflation.
    overall = int(
        exp_score * 0.25 +          # Experience relevance: 25% (highest)
        placement_score * 0.20 +    # Keyword placement quality: 20% (anti-stuffing)
        summary_score * 0.12 +      # Summary relevance: 12%
        skills_scr * 0.10 +         # Required skills: 10% (LOW — discourages stuffing)
        kw_score * 0.08 +           # Raw keyword presence: 8%
        title_score * 0.08 +        # Title alignment: 8%
        edu_scr * 0.07 +            # Education: 7%
        fmt_scr * 0.05 +            # Format: 5%
        proj_score * 0.05           # Project relevance: 5%
    )

    # Nice-to-have bonus (up to +8)
    if nth_score > 0:
        overall = min(overall + int(nth_score * 0.08), 100)

    # Boosts for strong profiles
    if kw_score >= 50 and skills_scr >= 40:
        overall = min(overall + 8, 100)
    elif kw_score >= 40 and skills_scr >= 30:
        overall = min(overall + 5, 100)

    if mh_score >= 60:
        overall = min(overall + 5, 100)
    if title_score >= 80:
        overall = min(overall + 3, 100)

    # Experience depth bonus
    alignments = gap_analysis.get("bullet_alignments", [])
    high_align = sum(1 for a in alignments if a.get("alignment_score", 0) >= 60)
    if high_align >= 5:
        overall = min(overall + 5, 100)
    elif high_align >= 3:
        overall = min(overall + 3, 100)

    # Unhighlighted skills boost
    unhighlighted = gap_analysis.get("unhighlighted_skills", [])
    if len(unhighlighted) >= 3:
        overall = min(overall + 3, 100)

    # Placement quality bonus: if keywords are well-distributed (not stuffed)
    well_placed = sum(1 for d in placement_details.values()
                      if d.get("found") and d.get("best_section") in ("experience", "projects", "summary"))
    stuffed = sum(1 for d in placement_details.values()
                  if d.get("found") and d.get("best_section") == "skills_only")
    if well_placed > stuffed * 2:
        overall = min(overall + 4, 100)

    # ── Floors ──
    if exp_score >= 55 and skills_scr >= 25:
        overall = max(overall, 55)
    if kw_score >= 40:
        overall = max(overall, 58)
    if mh_score >= 60:
        overall = max(overall, 65)
    if kw_score >= 60 and skills_scr >= 50:
        overall = max(overall, 70)

    section_scores = {
        "summary": summary_score,
        "experience": exp_score,
        "skills": skills_scr,
        "education": edu_scr,
        "format": fmt_scr,
        "keywords": kw_score,
        "mustHave": mh_score,
        "titleAlignment": title_score,
        "placementQuality": placement_score,
        "projectRelevance": proj_score,
    }

    tips = generate_tips(missing_kw, missing_skills, gap_analysis, placement_details)

    # Separate blockers
    true_gaps = gap_analysis.get("true_skill_gaps", [])
    fixable_blockers = []
    unfixable_blockers = []
    for kw in missing_mh[:5]:
        if any(kw.lower() in tg.lower() for tg in true_gaps):
            unfixable_blockers.append(kw)
        else:
            fixable_blockers.append(kw)

    if overall < 85:
        if fixable_blockers:
            tips.insert(0, f"Easy fix — add these keywords: {', '.join(fixable_blockers[:5])}")
        if unfixable_blockers:
            tips.append(f"Cannot fix with resume edits (need real experience): {', '.join(unfixable_blockers[:3])}")

    return {
        "overall_score": min(overall, 100),
        "keyword_score": kw_score,
        "placement_score": placement_score,
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
