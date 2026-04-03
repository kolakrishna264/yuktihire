"""Extract skills from job tags and description text."""

# Common tech skills dictionary
SKILL_ALIASES = {
    "js": "JavaScript", "javascript": "JavaScript", "ts": "TypeScript", "typescript": "TypeScript",
    "py": "Python", "python": "Python", "react": "React", "reactjs": "React", "react.js": "React",
    "node": "Node.js", "nodejs": "Node.js", "node.js": "Node.js",
    "vue": "Vue.js", "vuejs": "Vue.js", "angular": "Angular", "angularjs": "Angular",
    "go": "Go", "golang": "Go", "rust": "Rust", "java": "Java", "kotlin": "Kotlin",
    "swift": "Swift", "c#": "C#", "csharp": "C#", "c++": "C++", "cpp": "C++",
    "ruby": "Ruby", "rails": "Ruby on Rails", "php": "PHP", "laravel": "Laravel",
    "sql": "SQL", "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "mysql": "MySQL",
    "mongodb": "MongoDB", "mongo": "MongoDB", "redis": "Redis",
    "aws": "AWS", "azure": "Azure", "gcp": "GCP", "docker": "Docker", "kubernetes": "Kubernetes",
    "k8s": "Kubernetes", "terraform": "Terraform", "ci/cd": "CI/CD", "cicd": "CI/CD",
    "git": "Git", "linux": "Linux", "graphql": "GraphQL",
    "tensorflow": "TensorFlow", "pytorch": "PyTorch", "ml": "Machine Learning",
    "machine learning": "Machine Learning", "ai": "AI", "deep learning": "Deep Learning",
    "nlp": "NLP", "data science": "Data Science",
    "figma": "Figma", "sketch": "Sketch", "css": "CSS", "html": "HTML",
    "tailwind": "Tailwind CSS", "sass": "Sass", "next.js": "Next.js", "nextjs": "Next.js",
    "fastapi": "FastAPI", "flask": "Flask", "django": "Django",
    "spring": "Spring", "spring boot": "Spring Boot",
}


def canonicalize_skill(raw: str) -> str:
    """Return canonical skill name."""
    key = raw.lower().strip()
    return SKILL_ALIASES.get(key, raw.strip())


def extract_skills_from_tags(tags: list[str]) -> list[tuple[str, str]]:
    """Extract (skill_name, canonical) pairs from source tags."""
    results = []
    seen = set()
    for tag in tags:
        canonical = canonicalize_skill(tag)
        if canonical.lower() not in seen:
            seen.add(canonical.lower())
            results.append((tag.strip(), canonical))
    return results
