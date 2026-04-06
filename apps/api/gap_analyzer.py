"""
Pass 2: Gap Analysis
Compares resume content against JD requirements.
Identifies alignment opportunities without fabricating experience.
Extracts resume structure metadata for structure-preserving tailoring.
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
2. NEVER suggest inventing metrics, percentages, team sizes, or timeframes not in the source
3. Only flag "rewrite_opportunity: true" if the bullet can be improved using EXISTING content
4. If a required skill is genuinely missing, flag it as a "true_gap" — do not suggest faking it
5. "addable_keywords" means keywords that COULD be added through honest rephrasing of existing content
6. For "unhighlighted_skills": ONLY list real tool/library/platform/language names (e.g. "Docker", "PyTorch", "Kafka").
   Do NOT include generic concepts like "distributed systems", "observability", "incident response",
   "product thinking", "full lifecycle" — those belong in experience bullets, not the skills section.
7. For "role_relevance": rate each experience 0-100 for how relevant this specific role is to the JD.
   Highly relevant roles should keep more bullets. Weakly relevant roles can be compressed."""

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
  "role_relevance": [
    {{
      "experience_index": 0,
      "title": "job title",
      "relevance_score": 85,
      "recommended_bullet_count": 8,
      "key_alignment_areas": ["area1", "area2"]
    }}
  ],
  "true_skill_gaps": ["skills completely absent from candidate profile — ONLY real tool/technology names"],
  "unhighlighted_skills": ["ONLY real tool/library/platform names the candidate has but didn't list in skills section — no concepts, no responsibilities, no generic phrases"],
  "concept_keywords_for_bullets": ["concepts like 'distributed systems', 'observability', 'incident response' that should go into experience bullets, NOT the skills section"],
  "summary_keywords": ["top 3-5 strongest JD keywords that should appear in the professional summary"],
  "summary_score": 0,
  "overall_fit_score": 0,
  "top_strengths": ["what makes this candidate a good fit"],
  "top_gaps": ["most significant missing requirements"]
}}

IMPORTANT scoring guide:
- alignment_score 0-100: how well this bullet demonstrates the JD requirement
- truthfulness_check: "safe" = rewrite freely, "needs_evidence" = add metric if real, "cannot_add" = missing skill
- role_relevance: how relevant each experience is to this specific JD (0-100)
- recommended_bullet_count: for highly relevant roles (80+) keep 6-10 bullets; moderate (50-79) keep 4-6; low (<50) keep 2-4
- unhighlighted_skills: STRICTLY real tools/libraries/platforms only (Python, Docker, AWS, etc.) — never generic concepts
- concept_keywords_for_bullets: JD phrases that should be woven into experience bullets naturally, not stuffed into skills
- overall_fit_score: honest assessment of candidate-job match"""


def build_profile_summary(resume_content: dict) -> dict:
    """Extract structured data for gap analysis — includes structure metadata."""
    # Extract skill category names (user's original grouping)
    skill_categories = []
    skills_raw = resume_content.get("skills", [])
    if skills_raw:
        for s in skills_raw:
            if isinstance(s, dict):
                if s.get("items"):
                    skill_categories.append({
                        "category": s.get("category", "Other"),
                        "items": s["items"],
                    })
                elif s.get("skills"):
                    skill_categories.append({
                        "category": s.get("category", "Other"),
                        "items": s["skills"],
                    })

    return {
        "experiences": [
            {
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "bullets": exp.get("bullets", []),
                "skills_used": exp.get("skillsUsed", exp.get("skills_used", [])),
                "bullet_count": len(exp.get("bullets", [])),
                "index": i,
            }
            for i, exp in enumerate(resume_content.get("experiences", []))
        ],
        "skill_categories": skill_categories,
        "skills_flat": [
            (s if isinstance(s, str) else s.get("name", ""))
            for s in skills_raw
            if isinstance(s, str) or (isinstance(s, dict) and s.get("name"))
        ],
        "summary": resume_content.get("summary", ""),
        "projects": [
            {
                "name": p.get("name", ""),
                "bullets": p.get("bullets", []),
            }
            for p in resume_content.get("projects", [])
        ],
    }


def extract_resume_structure(resume_content: dict) -> dict:
    """Extract structural metadata that must be preserved during tailoring."""
    skills = resume_content.get("skills", [])

    # Detect skill format and extract category names with their items
    skill_category_names = []
    skill_category_map = {}  # category -> [items]
    skill_format = "flat"
    if skills:
        if any(isinstance(s, dict) and s.get("items") for s in skills):
            skill_format = "categorized_items"
            for s in skills:
                if isinstance(s, dict) and s.get("items"):
                    cat = s.get("category", "Other")
                    skill_category_names.append(cat)
                    skill_category_map[cat] = s["items"]
        elif any(isinstance(s, dict) and s.get("skills") for s in skills):
            skill_format = "categorized_skills"
            for s in skills:
                if isinstance(s, dict) and s.get("skills"):
                    cat = s.get("category", "Other")
                    skill_category_names.append(cat)
                    skill_category_map[cat] = s["skills"]
        elif any(isinstance(s, dict) and s.get("name") for s in skills):
            skill_format = "legacy_name"

    # Section order
    sections_present = []
    if resume_content.get("summary"):
        sections_present.append("summary")
    if resume_content.get("experiences"):
        sections_present.append("experiences")
    if resume_content.get("skills"):
        sections_present.append("skills")
    if resume_content.get("projects"):
        sections_present.append("projects")
    if resume_content.get("educations"):
        sections_present.append("educations")
    if resume_content.get("certifications"):
        sections_present.append("certifications")

    # Bullet counts per experience
    bullet_counts = [
        len(exp.get("bullets", []))
        for exp in resume_content.get("experiences", [])
    ]

    return {
        "skill_format": skill_format,
        "skill_category_names": skill_category_names,
        "skill_category_map": skill_category_map,
        "sections_present": sections_present,
        "bullet_counts": bullet_counts,
        "has_projects": bool(resume_content.get("projects")),
        "has_certifications": bool(resume_content.get("certifications")),
        "total_experiences": len(resume_content.get("experiences", [])),
    }


async def analyze_gaps(resume_content: dict, jd_analysis: dict) -> dict:
    """
    Pass 2: Compare resume against JD requirements.
    Returns gap analysis with per-bullet alignment scores and structure metadata.
    """
    profile_summary = build_profile_summary(resume_content)
    resume_structure = extract_resume_structure(resume_content)

    if not profile_summary["experiences"]:
        return {
            "bullet_alignments": [],
            "role_relevance": [],
            "true_skill_gaps": jd_analysis.get("required_skills", []),
            "unhighlighted_skills": [],
            "concept_keywords_for_bullets": [],
            "summary_keywords": jd_analysis.get("must_have_keywords", [])[:5],
            "summary_score": 0,
            "overall_fit_score": 0,
            "top_strengths": [],
            "top_gaps": ["No work experience found in resume"],
            "resume_structure": resume_structure,
        }

    # Use more token budget — don't truncate aggressively
    profile_json = json.dumps(profile_summary, indent=2)[:6000]
    jd_json = json.dumps({
        "role": jd_analysis.get("role", ""),
        "required_skills": jd_analysis.get("required_skills", []),
        "must_have_keywords": jd_analysis.get("must_have_keywords", []),
        "nice_to_have_skills": jd_analysis.get("nice_to_have_skills", []),
        "seniority_level": jd_analysis.get("seniority_level", "mid"),
        "responsibilities_summary": jd_analysis.get("responsibilities_summary", []),
        "domain_phrases": jd_analysis.get("domain_phrases", []),
    }, indent=2)

    from app.services.tailoring.jd_parser import extract_json_safe

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
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

    # Normalize all fields
    result.setdefault("bullet_alignments", [])
    result.setdefault("role_relevance", [])
    result.setdefault("true_skill_gaps", [])
    result.setdefault("unhighlighted_skills", [])
    result.setdefault("concept_keywords_for_bullets", [])
    result.setdefault("summary_keywords", [])
    result.setdefault("summary_score", 50)
    result.setdefault("overall_fit_score", 50)
    result.setdefault("top_strengths", [])
    result.setdefault("top_gaps", [])

    # Hard filter: validate unhighlighted_skills are real tool names, not concepts
    validated_skills = []
    concept_words = {
        # Engineering concepts
        "distributed systems", "observability", "incident response", "reliability",
        "error propagation", "error handling", "sandboxing", "production systems",
        "system design", "api design", "full lifecycle", "cloud-native",
        "client library", "scalability", "high availability", "fault tolerance",
        "performance optimization", "code review", "cloud-native engineering",
        "full lifecycle engineering", "model capabilities", "model deployment",
        "model serving", "model monitoring", "penetration testing",
        "security assessment", "threat modeling", "vulnerability assessment",
        # Product/business
        "product thinking", "go-to-market", "product instincts", "product engineering",
        "stakeholder management", "cross-functional collaboration", "strategic thinking",
        "business requirements", "customer-facing", "user-facing",
        # Soft skills
        "mentoring", "leadership", "communication", "problem solving",
        "critical thinking", "team management", "project management",
        "technical leadership", "people management",
        # Process
        "data structures", "algorithms", "microservices", "best practices",
        "continuous improvement", "data-driven", "real-time", "end-to-end",
        "technical depth", "cross-functional", "stakeholder",
        "cross-team collaboration", "stakeholder communication",
    }
    for skill in result["unhighlighted_skills"]:
        if not isinstance(skill, str):
            continue
        skill_clean = skill.strip()
        # Reject if it's a concept, not a tool
        if skill_clean.lower() in concept_words:
            if skill_clean not in result["concept_keywords_for_bullets"]:
                result["concept_keywords_for_bullets"].append(skill_clean)
            continue
        # Reject if too long (>4 words = probably a phrase, not a tool name)
        if len(skill_clean.split()) > 4:
            if skill_clean not in result["concept_keywords_for_bullets"]:
                result["concept_keywords_for_bullets"].append(skill_clean)
            continue
        # Reject if >40 chars
        if len(skill_clean) > 40:
            continue
        validated_skills.append(skill_clean)
    result["unhighlighted_skills"] = validated_skills

    # Attach structure metadata
    result["resume_structure"] = resume_structure

    return result
