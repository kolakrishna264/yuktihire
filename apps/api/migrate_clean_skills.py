"""
One-time migration: Clean corrupted skills in all resumes and resume_versions.

Problem: Previous tailoring runs stuffed concept phrases like "error handling",
"distributed systems", "product thinking" into the skills array. This script:

1. Reads every resume.content.skills and resume_versions.content.skills
2. Extracts all skill strings (from any format: flat, {name}, {category,items}, {category,skills})
3. Filters out concept phrases using the shared blocklist
4. Re-categorizes clean skills using the backend categorizer
5. Saves back in {category, items} format

Run once:  python migrate_clean_skills.py
"""
import asyncio
import json
import sys
import os

# Add project root to path so imports work
sys.path.insert(0, os.path.dirname(__file__))


# ── Shared concept blocklist (single source of truth) ──

CONCEPT_BLOCKLIST = {
    # Engineering concepts
    "error handling", "incident response", "observability", "reliability",
    "error propagation", "sandboxing", "production systems", "client library",
    "distributed systems", "system design", "api design", "full lifecycle",
    "cloud-native", "scalability", "high availability", "fault tolerance",
    "performance optimization", "code review", "cloud-native engineering",
    "full lifecycle engineering", "cloud-native ai/ml engineering",
    "full lifecycle product engineering", "model capabilities",
    "model deployment", "model serving", "model monitoring",
    "penetration testing", "security assessment", "threat modeling",
    "vulnerability assessment",
    # Product/business
    "product instincts", "product thinking", "go-to-market",
    "product instincts and product thinking", "product engineering",
    "stakeholder management", "cross-functional collaboration",
    "strategic thinking", "business requirements", "customer-facing",
    "user-facing",
    # Soft skills
    "mentoring", "leadership", "communication", "problem solving",
    "critical thinking", "team management", "project management",
    "technical leadership", "people management",
    # Generic concepts / responsibilities
    "data-driven", "real-time", "end-to-end", "technical depth",
    "best practices", "continuous improvement", "cross-team collaboration",
    "stakeholder communication", "agile methodologies",
    "agentic ai framework development", "generative ai solution delivery",
    "llm fine-tuning and prompt engineering",
    "retrieval-augmented generation pipelines",
    "ai-powered cybersecurity products", "experimentation frameworks",
    "big data technologies", "ml libraries", "data structures",
    "algorithms", "microservices", "documentation", "technical writing",
    "sdlc", "paas", "faas", "sdk",
}

CONCEPT_SIGNALS = [
    "engineering", "lifecycle", "instinct", "thinking", "management",
    "collaboration", "driven", "facing", "solution delivery",
    "framework development", "methodologies", "capabilities",
]


def is_valid_skill(name: str) -> bool:
    """Return True only if name is a real tool/library/platform, not a concept."""
    if not name or not isinstance(name, str):
        return False
    nl = name.lower().strip()
    if not nl or len(nl) > 60:
        return False
    # Exact blocklist match
    if nl in CONCEPT_BLOCKLIST:
        return False
    # Multi-word concept signal
    if len(nl.split()) > 2 and any(sig in nl for sig in CONCEPT_SIGNALS):
        return False
    # Too many words = likely a phrase, not a tool
    if len(nl.split()) > 5:
        return False
    # Degree fragments
    if any(d in nl for d in ["degree", "(ms)", "(bs)", "(phd)", "(mba)"]):
        return False
    return True


def extract_flat_skills(skills_data: list) -> list[str]:
    """Extract all skill names from any format into a flat deduplicated list."""
    flat = []
    seen = set()
    for item in skills_data:
        names = []
        if isinstance(item, str):
            names = [item]
        elif isinstance(item, dict):
            # {category, items: [...]}
            if "items" in item:
                names = [i for i in item["items"] if isinstance(i, str)]
            # {category, skills: [...]}
            elif "skills" in item:
                names = [i for i in item["skills"] if isinstance(i, str)]
            # {name: "Python", category: "Languages"}
            elif "name" in item:
                names = [item["name"]]
        for n in names:
            n = n.strip()
            if n and n.lower() not in seen:
                seen.add(n.lower())
                flat.append(n)
    return flat


def categorize_clean_skills(flat_skills: list[str]) -> list[dict]:
    """Categorize skills into groups. Returns [{category, items}] format.
    Does NOT merge small categories into large ones — uses 'Other' instead."""

    CATEGORIES = [
        ("Languages", [
            "python", "java", "javascript", "typescript", "c#", "c++", "golang", "go",
            "ruby", "rust", "scala", "julia", "sql", "bash", "php", "swift", "kotlin",
            "perl", "matlab", "r", "lua", "dart", "elixir", "haskell", "groovy",
            "html", "css", "nosql",
        ]),
        ("AI/ML", [
            "pytorch", "tensorflow", "keras", "scikit-learn", "scikit", "xgboost",
            "lightgbm", "catboost", "hugging face", "transformers", "opencv", "spacy",
            "nltk", "langchain", "llamaindex", "openai", "anthropic", "claude", "gemini",
            "llama", "gpt", "bert", "faiss", "pinecone", "weaviate", "chroma", "milvus",
            "onnx", "mlflow", "wandb", "tensorboard", "machine learning", "deep learning",
            "neural network", "computer vision", "nlp", "natural language", "llm", "rag",
            "fine-tuning", "fine tuning", "prompt engineering", "embedding", "generative ai",
            "agentic ai", "ai agent", "ai agents", "reinforcement learning", "gan",
            "diffusion", "recommendation", "anomaly detection", "feature engineering",
            "model training", "classification", "regression", "clustering",
            "vector database", "sentiment", "ner",
        ]),
        ("Cloud Platforms", [
            "aws", "amazon web services", "azure", "microsoft azure", "gcp",
            "google cloud", "ec2", "s3", "lambda", "sagemaker", "bedrock",
            "cloudformation", "cloudwatch", "ecs", "eks", "fargate", "rds",
            "dynamodb", "redshift", "kinesis", "sns", "sqs", "azure devops",
            "azure ml", "cloud functions", "cloud run", "vertex ai", "bigquery",
            "heroku", "vercel", "netlify", "railway", "digitalocean",
        ]),
        ("DevOps & Infrastructure", [
            "docker", "kubernetes", "k8s", "terraform", "ansible", "puppet", "chef",
            "ci/cd", "github actions", "gitlab ci", "jenkins", "circleci", "helm",
            "istio", "nginx", "devops", "devsecops", "linux", "unix", "prometheus",
            "grafana", "datadog", "new relic", "splunk", "elk",
        ]),
        ("Databases & Storage", [
            "postgresql", "postgres", "mysql", "mariadb", "sqlite", "mongodb", "redis",
            "elasticsearch", "opensearch", "cassandra", "couchbase", "neo4j", "snowflake",
            "databricks", "duckdb", "clickhouse", "supabase", "firebase", "memcached",
            "vector databases",
        ]),
        ("Web Frameworks", [
            "react", "angular", "vue", "svelte", "next.js", "nextjs", "nuxt", "gatsby",
            "node", "nodejs", "express", "fastapi", "flask", "django", "spring",
            "spring boot", ".net", ".net core", "asp.net", "rails", "ruby on rails",
            "laravel", "rest api", "graphql", "grpc", "websocket",
        ]),
        ("Data Engineering", [
            "spark", "pyspark", "kafka", "airflow", "prefect", "dagster", "dbt",
            "hadoop", "hive", "flink", "beam", "etl", "elt", "data pipeline",
            "pandas", "numpy", "polars", "dask", "matplotlib", "seaborn", "plotly",
            "streamlit", "gradio", "tableau",
        ]),
        ("Security", [
            "cybersecurity", "owasp", "siem", "edr", "soar",
            "encryption", "tls", "ssl", "oauth", "jwt", "saml", "sso",
        ]),
        ("Testing & QA", [
            "jest", "mocha", "pytest", "unittest", "cypress", "selenium", "playwright",
            "tdd", "bdd", "postman", "insomnia",
        ]),
        ("Tools & Practices", [
            "git", "github", "gitlab", "bitbucket", "jira", "jupyter", "colab",
            "intellij", "pycharm", "vs code", "vim", "rabbitmq",
            "oop", "functional programming", "design patterns", "solid",
            "agile", "scrum", "kanban",
        ]),
    ]

    categorized: dict[str, list[str]] = {}
    used: set[str] = set()

    for skill in flat_skills:
        if not is_valid_skill(skill):
            continue
        name = skill.strip()
        if name.lower() in used:
            continue
        used.add(name.lower())

        placed = False
        nl = name.lower()
        for cat_name, patterns in CATEGORIES:
            for p in patterns:
                if nl == p or nl.startswith(p + " ") or nl.endswith(" " + p) or (" " + p + " ") in (" " + nl + " "):
                    categorized.setdefault(cat_name, []).append(name)
                    placed = True
                    break
            if placed:
                break

        if not placed:
            # Goes to "Other" — NEVER merged into Languages or any real category
            categorized.setdefault("Other", []).append(name)

    # Build result in category order
    result = []
    for cat_name, _ in CATEGORIES:
        if cat_name in categorized and categorized[cat_name]:
            result.append({"category": cat_name, "items": categorized[cat_name]})
    if "Other" in categorized and categorized["Other"]:
        result.append({"category": "Other", "items": categorized["Other"]})

    return result


def clean_skills(skills_data: list | None) -> list[dict]:
    """Full cleanup: extract → filter → re-categorize. Returns [{category, items}]."""
    if not skills_data or not isinstance(skills_data, list):
        return []
    flat = extract_flat_skills(skills_data)
    return categorize_clean_skills(flat)


async def migrate():
    """Run the migration on all resumes and resume_versions."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        # ── Clean resumes.content.skills ──
        result = await db.execute(text("SELECT id, content FROM resumes WHERE content IS NOT NULL"))
        rows = result.mappings().all()
        resume_count = 0
        resume_cleaned = 0

        for row in rows:
            resume_count += 1
            content = row["content"]
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                except Exception:
                    continue
            if not isinstance(content, dict):
                continue

            skills = content.get("skills")
            if not skills or not isinstance(skills, list):
                continue

            # Check if already clean (all items are {category, items} with no concept phrases)
            already_clean = all(
                isinstance(s, dict) and s.get("items") and
                all(is_valid_skill(i) for i in s["items"] if isinstance(i, str))
                for s in skills
                if isinstance(s, dict)
            )
            if already_clean and all(isinstance(s, dict) and s.get("items") for s in skills):
                continue

            # Clean and re-categorize
            cleaned = clean_skills(skills)
            if not cleaned:
                continue

            content["skills"] = cleaned
            await db.execute(
                text("UPDATE resumes SET content = :content WHERE id = :id"),
                {"content": json.dumps(content), "id": row["id"]},
            )
            resume_cleaned += 1
            print(f"  Cleaned resume {row['id']}: {len(skills)} items → {sum(len(c['items']) for c in cleaned)} clean skills in {len(cleaned)} categories")

        print(f"\nResumes: {resume_count} total, {resume_cleaned} cleaned")

        # ── Clean resume_versions.content.skills ──
        result = await db.execute(text("SELECT id, content FROM resume_versions WHERE content IS NOT NULL"))
        rows = result.mappings().all()
        version_count = 0
        version_cleaned = 0

        for row in rows:
            version_count += 1
            content = row["content"]
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                except Exception:
                    continue
            if not isinstance(content, dict):
                continue

            skills = content.get("skills")
            if not skills or not isinstance(skills, list):
                continue

            already_clean = all(
                isinstance(s, dict) and s.get("items") and
                all(is_valid_skill(i) for i in s["items"] if isinstance(i, str))
                for s in skills
                if isinstance(s, dict)
            )
            if already_clean and all(isinstance(s, dict) and s.get("items") for s in skills):
                continue

            cleaned = clean_skills(skills)
            if not cleaned:
                continue

            content["skills"] = cleaned
            await db.execute(
                text("UPDATE resume_versions SET content = :content WHERE id = :id"),
                {"content": json.dumps(content), "id": row["id"]},
            )
            version_cleaned += 1
            print(f"  Cleaned version {row['id']}: {len(skills)} items → {sum(len(c['items']) for c in cleaned)} clean skills")

        print(f"\nVersions: {version_count} total, {version_cleaned} cleaned")

        await db.commit()
        print("\nMigration complete. All skills cleaned and re-categorized.")


if __name__ == "__main__":
    print("=" * 60)
    print("Skills Cleanup Migration")
    print("=" * 60)
    asyncio.run(migrate())
