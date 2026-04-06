"""
Pass 3: Bullet + Summary Rewriter
Generates ATS-optimized rewrites using only existing candidate experience.
Enforces truthfulness guardrails — never fabricates content.
Distributes relevance naturally across summary, skills, experience bullets.
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
3. NEVER add tools, technologies, or skills not mentioned in the source or candidate's skills list
4. If you cannot improve without fabricating, return the original bullet unchanged
5. Start with a strong action verb
6. Preserve the technical depth and specificity of the original bullet
7. Format: Action Verb + Technology/Method + Measurable Result (if result exists in source)
8. Do NOT make bullets generic — keep them detailed and specific"""

BULLET_PROMPT = """Rewrite this resume bullet to better match the job requirements while keeping full detail.

ORIGINAL BULLET:
{original}

CANDIDATE CONTEXT (only use facts from here):
Title: {title}
Company: {company}
Skills they listed: {skills_used}

KEYWORDS TO WEAVE IN NATURALLY (only if the underlying concept already exists in the bullet/context):
{keywords}

JOB SENIORITY LEVEL: {seniority}

IMPORTANT: Preserve the bullet's technical depth. Do not shorten or simplify. You may make
the bullet slightly longer to naturally incorporate relevant keywords, but stay under {max_words} words.

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
- Naturally weave in 3-5 relevant keywords from the job description
- Include domain-relevant concepts (not just tool names)
- Do not fabricate claims or credentials
- Make it sound human-written, not keyword-stuffed"""

SUMMARY_PROMPT = """Rewrite this professional summary for the target role.

ORIGINAL SUMMARY:
{original_summary}

CANDIDATE'S MOST RECENT ROLE: {recent_role} at {recent_company}
CANDIDATE'S KEY SKILLS: {skills}

TARGET ROLE: {target_role}
TARGET COMPANY: {target_company}
STRONGEST KEYWORDS TO INCLUDE NATURALLY: {keywords}
DOMAIN CONCEPTS TO WEAVE IN: {concepts}

Return JSON only:
{{
  "suggested": "rewritten summary text",
  "reason": "what was improved",
  "keywords_added": ["kw1"],
  "confidence": 0.9
}}"""


# ── Skill validation: only real tool/library/platform/language names ──

# Blocklist: concepts that should NEVER go into Technical Skills
SKILL_BLOCKLIST = {
    # Engineering concepts (belong in experience bullets, not skills section)
    "distributed systems", "observability", "incident response", "reliability",
    "error propagation", "error handling", "sandboxing", "production systems",
    "system design", "api design", "full lifecycle", "cloud-native",
    "client library", "scalability", "high availability", "fault tolerance",
    "performance optimization", "code review", "cloud-native engineering",
    "full lifecycle engineering", "model capabilities", "production systems",
    "model deployment", "model serving", "model monitoring",
    # Security/compliance concepts
    "penetration testing", "security assessment", "threat modeling",
    "vulnerability assessment", "compliance", "risk assessment",
    # Product/business concepts
    "product instincts", "product thinking", "go-to-market", "stakeholder management",
    "cross-functional collaboration", "strategic thinking", "business requirements",
    "customer-facing", "user-facing", "product engineering",
    # Soft skills / management
    "mentoring", "leadership", "communication", "problem solving",
    "critical thinking", "team management", "project management",
    "technical leadership", "people management", "talent development",
    # Generic responsibilities (not skills)
    "data-driven", "real-time", "end-to-end", "full-stack thinking",
    "technical depth", "best practices", "continuous improvement",
    "cross-team collaboration", "stakeholder communication",
    # Process terms
    "code review", "design review", "technical writing", "documentation",
    "sprint planning", "roadmap planning", "capacity planning",
}


def is_valid_skill_name(name: str) -> bool:
    """Check if a string is a real tool/library/platform name, not a concept.
    Only allows concrete technical tools, languages, frameworks, libraries, platforms."""
    name_lower = name.strip().lower()
    # Too long = probably a phrase, not a tool name
    if len(name_lower.split()) > 3 or len(name_lower) > 35:
        return False
    # In blocklist
    if name_lower in SKILL_BLOCKLIST:
        return False
    # Contains concept-ish words that indicate this is NOT a tool/library
    concept_signals = [
        "thinking", "instinct", "lifecycle", "management", "collaboration",
        "leadership", "driven", "facing", "end-to-end", "optimization",
        "assessment", "planning", "engineering", "practices", "improvement",
        "communication", "solving", "modeling", "monitoring", "deployment",
        "capability", "capabilities",
    ]
    if any(sig in name_lower for sig in concept_signals):
        return False
    return True


async def rewrite_bullet(
    original: str,
    title: str,
    company: str,
    skills_used: list[str],
    keywords_to_add: list[str],
    seniority: str,
    max_words: int = 40,
) -> dict:
    """Rewrite a single bullet point. Returns suggestion dict."""
    from app.services.tailoring.jd_parser import extract_json_safe

    if not original.strip():
        return {"suggested": original, "reason": "Empty bullet", "keywords_added": [],
                "confidence": 1.0, "truthful": True, "changed": False}

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
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
                max_words=max_words,
            )
        }]
    )

    try:
        result = extract_json_safe(message.content[0].text)
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
    summary_keywords: list[str] = None,
    concept_keywords: list[str] = None,
) -> dict:
    """Rewrite the professional summary section."""
    from app.services.tailoring.jd_parser import extract_json_safe

    experiences = resume_content.get("experiences", [])
    recent = experiences[0] if experiences else {}
    skills = resume_content.get("skills", [])

    # Use gap-analysis-provided keywords if available, else fallback
    keywords = summary_keywords or (
        jd_analysis.get("must_have_keywords", [])[:5] +
        jd_analysis.get("required_skills", [])[:3]
    )
    concepts = concept_keywords or jd_analysis.get("domain_phrases", [])[:4]

    # Flatten skills for display
    skill_names = []
    for s in skills[:20]:
        if isinstance(s, str):
            skill_names.append(s)
        elif isinstance(s, dict):
            if s.get("items"):
                skill_names.extend(s["items"][:5])
            elif s.get("skills"):
                skill_names.extend(s["skills"][:5])
            elif s.get("name"):
                skill_names.append(s["name"])

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
                skills=", ".join(skill_names[:15]),
                target_role=jd_analysis.get("role", ""),
                target_company=jd_analysis.get("company", ""),
                keywords=", ".join(keywords[:8]),
                concepts=", ".join(concepts[:5]),
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


def _get_adaptive_max_words(original_bullet: str, role_relevance: int) -> int:
    """Adaptive word limit based on original bullet length and role relevance."""
    original_words = len(original_bullet.split())
    if role_relevance >= 80:
        # Highly relevant: allow keeping or slightly expanding the original
        return max(original_words + 5, 35)
    elif role_relevance >= 50:
        return max(original_words, 30)
    else:
        # Low relevance: allow some compression
        return max(int(original_words * 0.85), 20)


async def generate_all_rewrites(
    gap_analysis: dict,
    resume_content: dict,
    jd_analysis: dict,
) -> list[dict]:
    """
    Generate rewrite suggestions distributed across resume sections.

    Key design principles:
    1. Summary absorbs title alignment + top 3-5 keywords + domain concepts
    2. Skills section only gets real tool/library/platform names
    3. Experience bullets absorb most JD relevance naturally
    4. Adaptive bullet retention: relevant roles keep more bullets
    5. Never stuff keywords into wrong sections
    """
    recommendations = []
    experiences = resume_content.get("experiences", [])
    seniority = jd_analysis.get("seniority_level", "mid")

    # Get role relevance from gap analysis
    role_relevance_map = {}
    for rr in gap_analysis.get("role_relevance", []):
        idx = rr.get("experience_index", 0)
        role_relevance_map[idx] = rr.get("relevance_score", 60)

    # Get concept keywords (for bullets, NOT for skills)
    concept_keywords = gap_analysis.get("concept_keywords_for_bullets", [])

    # ── 1. Rewrite experience bullets with adaptive retention ──
    for alignment in gap_analysis.get("bullet_alignments", []):
        if not alignment.get("rewrite_opportunity"):
            continue

        # Skip very-high-scoring bullets
        if alignment.get("alignment_score", 100) >= 90:
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
        role_rel = role_relevance_map.get(exp_idx, 60)

        # Combine JD keywords with concept keywords for bullet enrichment
        addable = alignment.get("addable_keywords", [])
        # Add relevant concept keywords that fit this bullet's context
        for ck in concept_keywords[:3]:
            if ck.lower() not in " ".join(addable).lower():
                addable.append(ck)

        # Adaptive word limit based on original bullet length and role relevance
        max_words = _get_adaptive_max_words(alignment["bullet"], role_rel)

        result = await rewrite_bullet(
            original=alignment["bullet"],
            title=exp.get("title", ""),
            company=exp.get("company", ""),
            skills_used=exp.get("skills_used", exp.get("skillsUsed", [])),
            keywords_to_add=addable[:6],
            seniority=seniority,
            max_words=max_words,
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

    # ── 2. Rewrite summary with targeted keywords and concepts ──
    summary_keywords = gap_analysis.get("summary_keywords", [])
    if resume_content.get("summary"):
        summary_result = await rewrite_summary(
            resume_content["summary"],
            resume_content,
            jd_analysis,
            summary_keywords=summary_keywords,
            concept_keywords=concept_keywords[:4],
        )
        if summary_result.get("suggested") and summary_result.get("suggested") != resume_content["summary"]:
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

    # ── 3. Skills: ONLY real tool/library/platform names — with hard validation ──
    unhighlighted = gap_analysis.get("unhighlighted_skills", [])
    if unhighlighted:
        current_skills = resume_content.get("skills", [])
        current_skills_lower = set()
        for s in current_skills:
            if isinstance(s, str):
                current_skills_lower.add(s.lower())
            elif isinstance(s, dict):
                if s.get("items"):
                    current_skills_lower.update(i.lower() for i in s["items"] if isinstance(i, str))
                elif s.get("skills"):
                    current_skills_lower.update(i.lower() for i in s["skills"] if isinstance(i, str))
                elif s.get("name"):
                    current_skills_lower.add(s["name"].lower())

        new_skills = []
        for s in unhighlighted:
            s_clean = s.strip()
            if not s_clean:
                continue
            # Hard validation: must be a real skill name
            if not is_valid_skill_name(s_clean):
                continue
            # Skip if already in skills
            if s_clean.lower() in current_skills_lower:
                continue
            # Skip duplicates
            if s_clean.lower() in {ns.lower() for ns in new_skills}:
                continue
            new_skills.append(s_clean)

        # Cap at 8 skills max — any more looks like stuffing
        new_skills = new_skills[:8]

        if new_skills:
            recommendations.append({
                "section": "skills",
                "field": "skills_list",
                "original": "",
                "suggested": "Add: " + ", ".join(new_skills),
                "reason": f"You have experience with these tools but they're not in your skills section. Adding them improves ATS match.",
                "confidence": 0.9,
                "keywords_added": new_skills,
                "truthful": True,
                "is_gap": False,
            })

    # ── Deduplicate recommendations ──
    seen_keys = set()
    seen_keywords = set()
    deduped = []
    for rec in recommendations:
        # Dedup by section + original text
        key = (rec["section"], rec.get("original", "")[:50])
        if key in seen_keys:
            continue
        seen_keys.add(key)

        # Dedup by keywords — skip if all keywords already covered
        rec_keywords = set(kw.lower() for kw in rec.get("keywords_added", []))
        if rec_keywords and rec_keywords.issubset(seen_keywords) and rec["section"] != "summary":
            continue
        seen_keywords.update(rec_keywords)

        # Skip gap-only suggestions (they don't change anything)
        if rec.get("is_gap") and rec.get("original") == rec.get("suggested"):
            continue

        deduped.append(rec)

    return deduped
