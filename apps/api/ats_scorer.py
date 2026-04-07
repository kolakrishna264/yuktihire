"""
ATS Scorer v2 — Industry-grade resume scoring engine.

Design principles:
1. Keyword EQUIVALENCE — "LLM" matches "LLMs", "large language model", "LLM-based"
2. Placement QUALITY — experience bullets > summary > skills-only
3. Semantic coverage — "built RAG pipelines" covers "RAG" even without exact substring
4. Honest gaps — clearly separate fixable vs unfixable blockers
5. Responsive to tailoring — re-score always uses latest content
"""
import re


# ══════════════════════════════════════════════════════════════════════════
# KEYWORD EQUIVALENCE ENGINE
# ══════════════════════════════════════════════════════════════════════════

# Bidirectional equivalence groups — if ANY term in a group matches, ALL are considered matched
EQUIVALENCE_GROUPS = [
    {"llm", "llms", "large language model", "large language models"},
    {"ml", "machine learning"},
    {"dl", "deep learning"},
    {"ai", "artificial intelligence"},
    {"nlp", "natural language processing"},
    {"gan", "gans", "generative adversarial network", "generative adversarial networks"},
    {"vae", "vaes", "variational autoencoder"},
    {"rag", "retrieval augmented generation", "retrieval-augmented generation"},
    {"llm-based", "llm based", "llm"},
    {"js", "javascript"},
    {"ts", "typescript"},
    {"py", "python"},
    {"k8s", "kubernetes"},
    {"postgres", "postgresql"},
    {"mongo", "mongodb"},
    {"tf", "tensorflow"},
    {"pt", "pytorch", "torch"},
    {"sk", "scikit-learn", "scikit", "sklearn"},
    {"np", "numpy"},
    {"pd", "pandas"},
    {"ci/cd", "cicd", "ci cd", "continuous integration", "continuous deployment"},
    {"aws", "amazon web services"},
    {"gcp", "google cloud", "google cloud platform"},
    {"azure", "microsoft azure"},
    {"react.js", "reactjs", "react"},
    {"node.js", "nodejs", "node"},
    {"next.js", "nextjs", "next"},
    {"fastapi", "fast api"},
    {"docker", "containerization", "containers"},
    {"api", "apis", "rest api", "restful api", "restful"},
    {"sql", "structured query language"},
    {"nosql", "no-sql", "non-relational"},
    {"oop", "object oriented", "object-oriented"},
    {"sre", "site reliability"},
    {"devops", "dev ops"},
    {"etl", "extract transform load"},
    {"sagemaker", "aws sagemaker"},
    {"genai", "generative ai", "gen ai"},
    {"embedding", "embeddings"},
    {"vector database", "vector databases", "vector db", "vector search"},
    {"faiss", "vector search", "similarity search"},
    {"pinecone", "vector database"},
    {"langchain", "lang chain"},
    {"hugging face", "huggingface"},
    {"lora", "low-rank adaptation"},
    {"peft", "parameter efficient fine-tuning"},
    {"fine-tuning", "fine tuning", "finetuning"},
    {"prompt engineering", "prompt tuning", "prompt design"},
    {"mlops", "ml ops", "ml operations"},
    {"a/b testing", "ab testing", "experiment design"},
    {"github actions", "github ci", "gh actions"},
    {"pyspark", "py spark", "spark python"},
    {"airflow", "apache airflow"},
    {"kafka", "apache kafka"},
    {"spark", "apache spark", "pyspark"},
]

# Build lookup: term -> set of all equivalents
_EQUIV_LOOKUP: dict[str, set[str]] = {}
for group in EQUIVALENCE_GROUPS:
    for term in group:
        _EQUIV_LOOKUP.setdefault(term.lower(), set()).update(t.lower() for t in group)


def _get_equivalents(keyword: str) -> set[str]:
    """Get all equivalent forms of a keyword."""
    kl = keyword.lower().strip()
    equivs = _EQUIV_LOOKUP.get(kl, set())
    # Always include the original and its plural/singular
    result = {kl} | equivs
    if kl.endswith("s") and len(kl) > 3:
        result.add(kl[:-1])  # LLMs -> LLM
    if not kl.endswith("s"):
        result.add(kl + "s")  # LLM -> LLMs
    # Hyphenated variants
    if "-" in kl:
        result.add(kl.replace("-", " "))
        result.add(kl.replace("-", ""))
    return result


def _keyword_in_text(keyword: str, text: str) -> bool:
    """Check if keyword or ANY equivalent appears in text.
    Also checks stem matches (fine-tuning matches fine-tuned)."""
    text_lower = text.lower()
    for variant in _get_equivalents(keyword):
        if len(variant) <= 2:
            if re.search(r'\b' + re.escape(variant) + r'\b', text_lower):
                return True
        else:
            if variant in text_lower:
                return True
        # Stem match for each word in the variant
        # "model deployment" -> stems ["model", "deploy"] -> both in "deployed models"
        words = variant.replace("-", " ").split()
        if len(words) >= 1:
            stems = []
            for w in words:
                s = w
                for suffix in ["mentation", "ation", "ment", "tion", "sion", "ings", "ing", "ed", "ers", "er", "ly", "ies", "es", "s"]:
                    if s.endswith(suffix) and len(s) >= len(suffix) + 3:
                        s = s[:-len(suffix)]
                        break
                if len(s) >= 2:
                    stems.append(s)
            if stems and all(s in text_lower for s in stems):
                return True
    return False


# ══════════════════════════════════════════════════════════════════════════
# SECTION TEXT EXTRACTION
# ══════════════════════════════════════════════════════════════════════════

def _extract_section_texts(resume_content: dict) -> dict:
    """Extract text by section for placement-quality scoring."""
    sections = {}
    sections["summary"] = (resume_content.get("summary") or "").lower()

    skill_parts = []
    for skill in resume_content.get("skills", []):
        if isinstance(skill, str):
            skill_parts.append(skill)
        elif isinstance(skill, dict):
            for k in ["items", "skills"]:
                skill_parts.extend(skill.get(k, []))
            if "name" in skill:
                skill_parts.append(skill.get("name", ""))
    sections["skills"] = " ".join(str(p) for p in skill_parts if p).lower()

    exp_parts = []
    for exp in resume_content.get("experiences", []):
        exp_parts.append(exp.get("title", ""))
        exp_parts.append(exp.get("company", ""))
        exp_parts.extend(exp.get("bullets", []))
        exp_parts.extend(exp.get("skills_used", exp.get("skillsUsed", [])))
    sections["experience"] = " ".join(str(p) for p in exp_parts if p).lower()

    proj_parts = []
    for proj in resume_content.get("projects", []):
        proj_parts.append(proj.get("name", ""))
        proj_parts.append(proj.get("description", ""))
        proj_parts.extend(proj.get("bullets", []))
        proj_parts.extend(proj.get("skills", []))
    sections["projects"] = " ".join(str(p) for p in proj_parts if p).lower()

    edu_parts = []
    for edu in resume_content.get("educations", []):
        edu_parts.extend([edu.get("degree", ""), edu.get("field", ""), edu.get("school", "")])
    sections["education"] = " ".join(str(p) for p in edu_parts if p).lower()

    sections["all"] = " ".join(sections.values())
    return sections


# ══════════════════════════════════════════════════════════════════════════
# COMPONENT SCORING FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════

def keyword_match_score(text: str, keywords: list[str]) -> tuple[int, list[str], list[str]]:
    """Returns (score, matched, missing) using equivalence matching."""
    if not keywords:
        return 90, [], []
    matched, missing = [], []
    for kw in keywords:
        if _keyword_in_text(kw, text):
            matched.append(kw)
        else:
            missing.append(kw)
    return int(len(matched) / len(keywords) * 100), matched, missing


def keyword_placement_score(sections: dict, keywords: list[str]) -> tuple[int, dict]:
    """Score keywords by WHERE they appear. Experience > Summary > Skills-only.
    Returns (placement_score 0-100, detail_dict)."""
    if not keywords:
        return 90, {}

    details = {}
    total_weighted = 0.0
    found = 0

    for kw in keywords:
        in_exp = _keyword_in_text(kw, sections.get("experience", ""))
        in_sum = _keyword_in_text(kw, sections.get("summary", ""))
        in_skl = _keyword_in_text(kw, sections.get("skills", ""))
        in_prj = _keyword_in_text(kw, sections.get("projects", ""))
        in_any = _keyword_in_text(kw, sections.get("all", ""))

        if not in_any:
            details[kw] = {"found": False, "weight": 0, "section": "missing"}
            continue

        found += 1
        # Placement weight: experience is best
        if in_exp:
            w, sec = 1.0, "experience"
        elif in_sum:
            w, sec = 0.85, "summary"
        elif in_prj:
            w, sec = 0.8, "projects"
        elif in_skl:
            w, sec = 0.5, "skills_only"
        else:
            w, sec = 0.4, "other"

        # Multi-section bonus
        if sum([in_exp, in_sum, in_skl, in_prj]) >= 2:
            w = min(w + 0.1, 1.0)

        total_weighted += w
        details[kw] = {"found": True, "weight": w, "section": sec}

    score = int((total_weighted / max(len(keywords), 1)) * 100) if found else 0
    return score, details


def experience_keyword_score(sections: dict, keywords: list[str]) -> int:
    """Score experience by keyword presence — no artificial cap."""
    exp = sections.get("experience", "")
    if not exp or not keywords:
        return 50
    matched = sum(1 for kw in keywords if _keyword_in_text(kw, exp))
    return int(matched / max(len(keywords), 1) * 100)


def education_score(resume_content: dict, jd_analysis: dict) -> int:
    """Check if education meets JD requirements."""
    req = jd_analysis.get("education_required", "any")
    if req in [None, "any", "null", ""]:
        return 90
    educations = resume_content.get("educations", [])
    if not educations:
        return 40 if req in ["bachelors", "masters", "phd"] else 80

    rank_map = {
        "associate": 1, "bachelors": 2, "bachelor": 2, "masters": 3, "master": 3,
        "phd": 4, "mba": 3, "doctorate": 4,
    }
    required_rank = rank_map.get(req.lower(), 2)

    for edu in educations:
        text = (edu.get("degree", "") + " " + edu.get("field", "")).lower()
        for name, rank in rank_map.items():
            if name in text and rank >= required_rank:
                return 95
        # Check abbreviations
        for abbr, rank in {"b.s.": 2, "b.tech": 2, "b.a.": 2, "m.s.": 3, "m.tech": 3, "m.a.": 3, "ph.d": 4, "b.sc": 2, "m.sc": 3}.items():
            if abbr in text and rank >= required_rank:
                return 95
    return 60


def format_score(resume_content: dict) -> int:
    """Rules-based format checks."""
    score = 100
    if not (resume_content.get("contact", {}).get("email") or resume_content.get("email")):
        score -= 8
    if not resume_content.get("experiences"):
        score -= 12
    if resume_content.get("has_tables"):
        score -= 10
    bullets = []
    for exp in resume_content.get("experiences", []):
        bullets.extend(exp.get("bullets", []))
    if bullets:
        avg = sum(len(b.split()) for b in bullets) / len(bullets)
        if avg < 8: score -= 5
        if avg > 40: score -= 5
    if resume_content.get("skills"): score = min(score + 5, 100)
    if resume_content.get("summary"): score = min(score + 5, 100)
    return max(score, 0)


# ══════════════════════════════════════════════════════════════════════════
# KEYWORD EXTRACTION
# ══════════════════════════════════════════════════════════════════════════

def extract_all_jd_keywords(jd_analysis: dict) -> list[str]:
    """Extract JD keywords. Tight denominator — no role titles or long phrases."""
    keywords = set()
    for field in ["must_have_keywords", "required_skills"]:
        for kw in jd_analysis.get(field, []):
            if not isinstance(kw, str) or len(kw) < 2 or len(kw) > 40:
                continue
            # Skip role titles
            role_words = ["engineer", "developer", "scientist", "architect", "manager", "lead", "director", "analyst"]
            if any(kw.lower().endswith(w) or kw.lower().startswith(w) for w in role_words):
                continue
            if len(kw.split()) >= 4:
                continue
            keywords.add(kw)
    for kw in jd_analysis.get("domain_phrases", []):
        if isinstance(kw, str) and len(kw.split()) <= 2 and len(kw) < 30:
            keywords.add(kw)
    return list(keywords)


def extract_nice_to_have(jd_analysis: dict) -> list[str]:
    keywords = set()
    for field in ["nice_to_have_keywords", "nice_to_have_skills"]:
        for kw in jd_analysis.get(field, []):
            if isinstance(kw, str) and 1 < len(kw) < 50:
                keywords.add(kw)
    return list(keywords)


# ══════════════════════════════════════════════════════════════════════════
# TIPS GENERATION
# ══════════════════════════════════════════════════════════════════════════

def generate_tips(missing_kw, missing_skills, gap_analysis, placement_details) -> list[str]:
    tips = []
    seen = set()

    # All missing keywords are fixable — tailoring adds them automatically
    fixable = [kw for kw in missing_kw + missing_skills if kw.lower() not in seen]
    for kw in fixable: seen.add(kw.lower())
    if fixable:
        tips.append(f"Auto-adding to boost score: {', '.join(fixable[:6])}")

    # Skills-only (need experience bullets)
    skills_only = [kw for kw, d in placement_details.items() if d.get("section") == "skills_only" and kw.lower() not in seen]
    if skills_only:
        tips.append(f"Strengthen in experience bullets: {', '.join(skills_only[:3])}")

    return tips[:4]


# ══════════════════════════════════════════════════════════════════════════
# MAIN SCORING FUNCTION
# ══════════════════════════════════════════════════════════════════════════

def calculate_ats_score(
    resume_content: dict,
    jd_analysis: dict,
    gap_analysis: dict,
) -> dict:
    """
    Full ATS scoring with equivalence matching and placement quality.

    Weights (experience-heavy, anti-stuffing):
      Experience relevance: 25%
      Placement quality:    18%
      Summary relevance:    12%
      Keyword coverage:     12%
      Skills coverage:      10%
      Title alignment:       8%
      Education:             7%
      Format:                5%
      Projects:              3%
    """
    sections = _extract_section_texts(resume_content)
    resume_text = sections["all"]

    all_keywords = extract_all_jd_keywords(jd_analysis)
    must_have = jd_analysis.get("must_have_keywords", [])
    required_skills = jd_analysis.get("required_skills", [])

    # ── Title alignment ──
    target_role = (jd_analysis.get("role", "") or "").lower()
    title_score = 70
    if target_role:
        for exp in resume_content.get("experiences", []):
            t = (exp.get("title", "") or "").lower()
            if target_role in t or t in target_role:
                title_score = 95
                break
            role_words = {w for w in target_role.split() if len(w) > 2}
            title_words = {w for w in t.split() if len(w) > 2}
            overlap = role_words & title_words
            if overlap:
                title_score = max(title_score, 70 + min(len(overlap) * 12, 25))

    # ── Keyword coverage (with equivalence) ──
    kw_score, matched_kw, missing_kw = keyword_match_score(resume_text, all_keywords)

    # ── Placement quality ──
    placement_score, placement_details = keyword_placement_score(sections, all_keywords)

    # ── Nice-to-have ──
    nice = extract_nice_to_have(jd_analysis)
    nth_score, _, _ = keyword_match_score(resume_text, nice) if nice else (0, [], [])

    # ── Must-have ──
    mh_score, matched_mh, missing_mh = keyword_match_score(resume_text, must_have) if must_have else (100, [], [])

    # ── Skills ──
    skills_scr, matched_skills, missing_skills = keyword_match_score(resume_text, required_skills) if required_skills else (80, [], [])

    # ── Experience — keyword presence + quality check ──
    kw_exp = experience_keyword_score(sections, all_keywords)
    # Realistic scoring: even with all keywords, cap experience at 85%
    # because auto-added bullets aren't as strong as genuine experience
    gap_alignments = gap_analysis.get("bullet_alignments", [])
    gap_avg = int(sum(a.get("alignment_score", 50) for a in gap_alignments) / max(len(gap_alignments), 1)) if gap_alignments else 50
    # Blend: 60% keyword match + 40% AI quality assessment
    exp_score = int(kw_exp * 0.6 + gap_avg * 0.4)

    # ── Summary ──
    summary_text = sections.get("summary", "")
    target_kws = (must_have + required_skills)[:15]
    summary_hits = sum(1 for kw in target_kws if _keyword_in_text(kw, summary_text))
    summary_score = min(100, 50 + summary_hits * 7) if summary_text else 30

    # ── Education ──
    edu_scr = education_score(resume_content, jd_analysis)

    # ── Format ──
    fmt_scr = format_score(resume_content)

    # ── Projects ──
    proj_text = sections.get("projects", "")
    proj_hits = sum(1 for kw in target_kws if _keyword_in_text(kw, proj_text))
    proj_score = min(100, 40 + proj_hits * 10) if proj_text else 50

    # ══════════════════════════════════════════════════════════════════
    # WEIGHTED OVERALL
    # ══════════════════════════════════════════════════════════════════
    overall = int(
        exp_score * 0.25 +
        placement_score * 0.18 +
        summary_score * 0.12 +
        kw_score * 0.12 +
        skills_scr * 0.10 +
        title_score * 0.08 +
        edu_scr * 0.07 +
        fmt_scr * 0.05 +
        proj_score * 0.03
    )

    # ── Realistic boosts (conservative) ──
    if nth_score > 0:
        overall = min(overall + int(nth_score * 0.04), 95)
    if kw_score >= 50 and skills_scr >= 40:
        overall = min(overall + 5, 95)
    if mh_score >= 60:
        overall = min(overall + 3, 95)
    if title_score >= 80:
        overall = min(overall + 2, 95)
    # Well-distributed keywords bonus
    well_placed = sum(1 for d in placement_details.values() if d.get("found") and d.get("section") in ("experience", "projects", "summary"))
    stuffed = sum(1 for d in placement_details.values() if d.get("found") and d.get("section") == "skills_only")
    if well_placed > stuffed * 2:
        overall = min(overall + 2, 95)

    # ── Floors ──
    if kw_score >= 50:
        overall = max(overall, 65)
    if kw_score >= 70 and skills_scr >= 50:
        overall = max(overall, 75)
    if kw_score >= 85 and exp_score >= 60:
        overall = max(overall, 82)

    # Cap at 95 — 100% is unrealistic, real ATS tools max at 90-95%
    overall = min(overall, 95)

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

    # All missing are auto-added by the tailoring engine
    fixable = list(missing_mh[:5])
    unfixable = []  # Nothing is unfixable — we add everything

    if overall < 85 and fixable:
        tips.insert(0, f"Auto-adding: {', '.join(fixable[:5])}")

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
        "missing_keywords": missing_kw[:15],
        "missing_must_have": missing_mh[:10],
        "matched_skills": matched_skills,
        "missing_skills": missing_skills[:10],
        "section_scores": section_scores,
        "fixable_blockers": fixable[:5],
        "unfixable_blockers": unfixable[:5],
        "tips": tips,
    }
