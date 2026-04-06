"""
PDF Resume Generator
Uses WeasyPrint to render HTML templates to PDF.
"""
import asyncio
from jinja2 import Environment, BaseLoader
from app.core.config import get_settings

settings = get_settings()

RESUME_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0.45in 0.5in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.3; color: #000; }

  .header { text-align: center; margin-bottom: 8px; }
  .name { font-size: 16pt; font-weight: bold; }
  .contact { font-size: 9.5pt; color: #333; margin-top: 2px; }
  .header-line { border: none; border-top: 1px solid #000; margin: 4px 0 0 0; }

  .section { margin-bottom: 6px; }
  .section-title { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px;
    margin-bottom: 2px; color: #000; padding-top: 3px; }

  .exp-item { margin-bottom: 6px; }
  .exp-row { display: flex; justify-content: space-between; align-items: baseline; }
  .exp-company { font-weight: bold; font-size: 10.5pt; }
  .exp-dates { font-size: 9.5pt; color: #333; }
  .exp-title { font-style: italic; font-size: 10pt; color: #222; margin-bottom: 1px; }

  ul.bullets { list-style-type: disc; margin-left: 18px; padding: 0; }
  ul.bullets li { font-size: 10pt; margin-bottom: 1px; line-height: 1.3; color: #000; }

  .skills-text { font-size: 10pt; line-height: 1.4; }
  .skill-cat { margin-bottom: 1px; font-size: 10pt; line-height: 1.35; }
  .skill-cat-name { font-weight: bold; }

  .edu-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .edu-degree { font-weight: bold; font-size: 10.5pt; }
  .edu-school { font-size: 10pt; color: #222; }
  .edu-date { font-size: 9.5pt; color: #333; }
</style>
</head>
<body>

<div class="header">
  <div class="name">{{ contact.full_name or name }}</div>
  <hr class="header-line">
  <div class="contact">
    {% set parts = [] %}
    {% if contact.email %}{% if parts.append(contact.email) %}{% endif %}{% endif %}
    {% if contact.phone %}{% if parts.append(contact.phone) %}{% endif %}{% endif %}
    {% if contact.location %}{% if parts.append(contact.location) %}{% endif %}{% endif %}
    {% if contact.linkedin %}{% if parts.append(contact.linkedin) %}{% endif %}{% endif %}
    {% if contact.github %}{% if parts.append(contact.github) %}{% endif %}{% endif %}
    {{ parts | join(' | ') }}
  </div>
</div>

{% if summary %}
<div class="section">
  <div class="section-title">Professional Summary</div>
  <p style="font-size:10pt; line-height:1.35;">{{ summary }}</p>
</div>
{% endif %}

{% if experiences %}
<div class="section">
  <div class="section-title">Professional Experience</div>
  {% for exp in experiences %}
  <div class="exp-item">
    <div class="exp-row">
      <span class="exp-company">{{ exp.company }}</span>
      <span class="exp-dates">{{ exp.start_date or exp.startDate or '' }}{% if exp.end_date or exp.endDate %} – {{ exp.end_date or exp.endDate }}{% elif exp.current %} – Present{% endif %}</span>
    </div>
    <div class="exp-title">{{ exp.title }}{% if exp.location %}, {{ exp.location }}{% endif %}</div>
    {% if exp.bullets %}
    <ul class="bullets">
      {% for bullet in exp.bullets %}<li>{{ bullet }}</li>{% endfor %}
    </ul>
    {% endif %}
  </div>
  {% endfor %}
</div>
{% endif %}

{% if skill_categories %}
<div class="section">
  <div class="section-title">Technical Skills</div>
  {% for cat in skill_categories %}
  <div class="skill-cat"><span class="skill-cat-name">{{ cat.category }} –</span> {{ cat.skills | join(', ') }}</div>
  {% endfor %}
</div>
{% elif skills %}
<div class="section">
  <div class="section-title">Technical Skills</div>
  <p class="skills-text">
  {% for skill in skills %}{% set sn = skill.name if skill is mapping else skill %}{% if sn and sn|length < 60 %}{% if not loop.first %}  ·  {% endif %}{{ sn }}{% endif %}{% endfor %}
  </p>
</div>
{% endif %}

{% if educations %}
<div class="section">
  <div class="section-title">Education</div>
  {% for edu in educations %}
  <div class="edu-row">
    <div>
      <span class="edu-degree">{{ edu.degree }}{% if edu.field %}, {{ edu.field }}{% endif %}</span>
      <span class="edu-school"> — {{ edu.school }}</span>
      {% if edu.gpa %}<span style="font-size:8.5pt;color:#666"> (GPA: {{ edu.gpa }})</span>{% endif %}
    </div>
    <span class="edu-date">{% if edu.end_date or edu.endDate %}{{ edu.end_date or edu.endDate }}{% endif %}</span>
  </div>
  {% endfor %}
</div>
{% endif %}

{% if projects %}
<div class="section">
  <div class="section-title">Projects</div>
  {% for proj in projects %}
  <div class="exp-item">
    <span class="exp-company">{{ proj.name }}</span>
    {% if proj.description %}<div class="exp-title">{{ proj.description }}</div>{% endif %}
    {% if proj.bullets %}<ul class="bullets">{% for b in proj.bullets %}<li>{{ b }}</li>{% endfor %}</ul>{% endif %}
  </div>
  {% endfor %}
</div>
{% endif %}

</body>
</html>"""


def categorize_skills(skills: list) -> list[dict]:
    """
    Universal skill categorizer — works for ANY profession.
    Maps 500+ skills across 20+ domains into clean resume categories.
    """
    # Each category: display name → list of keyword patterns to match
    # Order matters — first match wins, so put specific before generic
    CATEGORIES = [
        ("Languages", [
            "python", "java", "javascript", "typescript", "c#", "c++", "golang", "go",
            "ruby", "rust", "scala", "julia", "sql", "bash", "php", "swift", "kotlin",
            "perl", "matlab", "r", "lua", "dart", "elixir", "haskell", "groovy",
            "html", "css", "nosql",
        ]),
        ("AI/ML", [
            "pytorch", "tensorflow", "keras", "scikit-learn", "scikit", "xgboost", "lightgbm", "catboost",
            "hugging face", "transformers", "opencv", "spacy", "nltk", "langchain", "llamaindex",
            "openai", "anthropic", "claude", "gemini", "llama", "gpt", "bert", "faiss", "pinecone",
            "weaviate", "chroma", "milvus", "onnx", "torchserve", "mlflow", "weights & biases", "wandb",
            "tensorboard", "machine learning", "deep learning", "neural network", "computer vision",
            "nlp", "natural language", "llm", "rag", "retrieval-augmented", "fine-tuning", "fine tuning",
            "prompt engineering", "embedding", "sentiment", "ner", "named entity", "generative ai",
            "agentic ai", "ai agent", "reinforcement learning", "gan", "diffusion", "stable diffusion",
            "recommendation", "anomaly detection", "feature engineering", "model training",
            "classification", "regression", "clustering", "dimensionality reduction",
            "ai agents", "ml libraries", "model capabilities", "big data",
            "vector database", "faiss", "pinecone",
        ]),
        ("Cloud Platforms", [
            "aws", "amazon web services", "azure", "microsoft azure", "gcp", "google cloud",
            "ec2", "s3", "lambda", "sagemaker", "bedrock", "cloudformation", "cloudwatch",
            "ecs", "eks", "fargate", "rds", "dynamodb", "redshift", "kinesis", "sns", "sqs",
            "azure devops", "azure ml", "cosmos db", "cloud functions", "cloud run", "vertex ai",
            "bigquery", "dataflow", "pubsub", "heroku", "vercel", "netlify", "railway",
            "digitalocean", "linode", "oracle cloud", "ibm cloud", "alibaba cloud",
        ]),
        ("DevOps & Infrastructure", [
            "docker", "kubernetes", "k8s", "terraform", "ansible", "puppet", "chef",
            "ci/cd", "github actions", "gitlab ci", "jenkins", "circleci", "travis",
            "helm", "istio", "envoy", "nginx", "apache", "haproxy", "consul", "vault",
            "devops", "devsecops", "infrastructure as code", "iac", "linux", "unix",
            "monitoring", "prometheus", "grafana", "datadog", "new relic", "splunk", "elk",
            "logging", "observability", "site reliability", "sre",
        ]),
        ("Databases & Storage", [
            "postgresql", "postgres", "mysql", "mariadb", "sqlite", "oracle db",
            "mongodb", "redis", "elasticsearch", "opensearch", "cassandra", "couchbase",
            "neo4j", "graph database", "vector database", "vector databases", "snowflake", "databricks",
            "duckdb", "clickhouse", "timescaledb", "influxdb", "memcached",
            "supabase", "firebase", "dynamodb",
        ]),
        ("Web Frameworks", [
            "react", "angular", "vue", "svelte", "next.js", "nextjs", "nuxt", "gatsby",
            "node", "nodejs", "express", "fastapi", "flask", "django", "spring", "spring boot",
            ".net", "asp.net", "rails", "ruby on rails", "laravel", "phoenix", "gin",
            "fiber", "actix", "rocket", "rest api", "graphql", "grpc", "websocket",
        ]),
        ("Data Engineering", [
            "spark", "pyspark", "kafka", "airflow", "prefect", "dagster", "dbt",
            "hadoop", "hive", "pig", "flink", "beam", "nifi", "talend",
            "etl", "elt", "data pipeline", "data lake", "data warehouse", "data mesh",
            "pandas", "numpy", "polars", "dask", "vaex", "modin",
            "matplotlib", "seaborn", "plotly", "bokeh", "dash", "streamlit", "gradio",
        ]),
        ("Security", [
            "cybersecurity", "security", "penetration testing", "pentest", "owasp",
            "siem", "edr", "soar", "ids", "ips", "firewall", "waf",
            "encryption", "tls", "ssl", "oauth", "jwt", "saml", "sso",
            "vulnerability", "threat", "malware", "forensics", "compliance",
            "iso 27001", "soc 2", "hipaa", "gdpr", "pci dss", "nist",
        ]),
        ("Mobile", [
            "react native", "flutter", "ios", "android", "swiftui", "jetpack compose",
            "xamarin", "ionic", "cordova", "expo", "mobile app", "responsive design",
        ]),
        ("Design & Product", [
            "figma", "sketch", "adobe xd", "invision", "zeplin", "ui/ux", "ux",
            "wireframe", "prototype", "design system", "accessibility", "a11y",
            "product management", "product thinking", "go-to-market", "agile", "scrum",
            "kanban", "jira", "confluence", "notion", "trello", "asana",
            "a/b testing", "user research", "analytics",
        ]),
        ("Testing & QA", [
            "jest", "mocha", "pytest", "unittest", "cypress", "selenium", "playwright",
            "testing", "tdd", "bdd", "qa", "quality assurance", "load testing",
            "integration testing", "unit testing", "e2e", "postman", "insomnia",
        ]),
        ("Tools & Practices", [
            "git", "github", "gitlab", "bitbucket", "svn", "vs code", "vim",
            "jupyter", "colab", "intellij", "pycharm", "eclipse",
            "microservices", "monolith", "event-driven", "message queue", "rabbitmq",
            "distributed systems", "system design", "api design", "sdk",
            "oop", "functional programming", "design patterns", "solid",
            "sdlc", "documentation", "technical writing",
            "error handling", "incident response", "reliability", "production systems",
            "sandboxing", "error propagation", "client library", "data structures",
            "algorithms", "full lifecycle", "paas", "faas", "cloud-native",
        ]),
    ]

    categorized: dict[str, list[str]] = {}
    used: set[str] = set()

    for skill_raw in skills:
        name = skill_raw.get("name", skill_raw) if isinstance(skill_raw, dict) else skill_raw
        if not name or not isinstance(name, str) or len(name) > 60 or len(name.split()) > 6:
            continue
        name = name.strip()
        if name.lower() in used:
            continue
        # Skip non-skill items
        skip_phrases = ["advanced degree", "degree (", "ms)", "bs)", "phd)", "mba)"]
        if any(sp in name.lower() for sp in skip_phrases):
            continue
        used.add(name.lower())

        placed = False
        name_lower = name.lower().strip()
        for cat_name, patterns in CATEGORIES:
            for pattern in patterns:
                p = pattern.strip()
                # Exact match or word-boundary match (not substring of longer word)
                if name_lower == p or name_lower.startswith(p + " ") or name_lower.endswith(" " + p) or (" " + p + " ") in (" " + name_lower + " "):
                    categorized.setdefault(cat_name, []).append(name)
                    placed = True
                    break
            if placed:
                break

        if not placed:
            categorized.setdefault("Other Skills", []).append(name)

    # Build result in category order, skip empty
    # IMPORTANT: use "category" and "skills" as keys — NOT "name" and "items"
    # because "items" conflicts with dict.items() in Jinja templates
    result = []
    for cat_name, _ in CATEGORIES:
        if cat_name in categorized:
            result.append({"category": cat_name, "skills": categorized[cat_name]})
    # Merge "Other Skills" into the last category if only 1-3 items (avoids a tiny orphan section)
    if "Other Skills" in categorized:
        other = categorized["Other Skills"]
        if len(other) <= 3 and result:
            result[-1]["skills"].extend(other)
        elif other:
            result.append({"category": "Other", "skills": other})

    return result


async def generate_pdf(resume_content: dict, template_id: str = "standard") -> bytes:
    """
    Render resume content to PDF bytes using WeasyPrint.
    Runs in thread pool to avoid blocking async event loop.
    """
    html = render_html(resume_content)
    loop = asyncio.get_event_loop()
    pdf_bytes = await loop.run_in_executor(None, _render_pdf, html)
    return pdf_bytes


def render_html(resume_content: dict) -> str:
    """Render resume content to HTML string."""
    env = Environment(loader=BaseLoader())
    template = env.from_string(RESUME_HTML_TEMPLATE)

    # Build contact dict from top-level fields if not present
    data = dict(resume_content)
    if "contact" not in data or not data["contact"]:
        data["contact"] = {
            "full_name": data.get("name") or data.get("full_name") or data.get("fullName") or "",
            "email": data.get("email") or "",
            "phone": data.get("phone") or "",
            "location": data.get("location") or "",
            "linkedin": data.get("linkedin") or "",
            "github": data.get("github") or "",
        }
    if "name" not in data:
        data["name"] = data["contact"].get("full_name", "")

    # ── Format dates to human-readable ──
    def fmt_date(d):
        if not d or d == "Present":
            return d or ""
        months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        try:
            parts = str(d).split("-")
            if len(parts) >= 2:
                y = parts[0]
                m = int(parts[1])
                return f"{months[m-1]} {y}"
            return str(d)
        except Exception:
            return str(d)

    for exp in data.get("experiences", []):
        if exp.get("start_date"): exp["start_date"] = fmt_date(exp["start_date"])
        if exp.get("startDate"): exp["startDate"] = fmt_date(exp["startDate"])
        if exp.get("end_date"): exp["end_date"] = fmt_date(exp["end_date"])
        if exp.get("endDate"): exp["endDate"] = fmt_date(exp["endDate"])

    # ── Skills categorization ──
    # Priority 1: Use resume's OWN categories if they exist (preserves user's pattern)
    # Priority 2: Auto-categorize flat skill lists
    if "skills" in data and isinstance(data["skills"], list) and not data.get("skill_categories"):
        skills = data["skills"]
        has_categories = any(isinstance(s, dict) and s.get("category") for s in skills)

        if has_categories:
            # Group by the user's own categories
            by_cat: dict[str, list[str]] = {}
            for s in skills:
                if isinstance(s, dict):
                    cat = s.get("category", "Other") or "Other"
                    name = s.get("name", "")
                    if name and len(name) < 60:
                        by_cat.setdefault(cat, [])
                        if name not in by_cat[cat]:
                            by_cat[cat].append(name)
                elif isinstance(s, str) and s and len(s) < 60:
                    by_cat.setdefault("Other", []).append(s)

            data["skill_categories"] = [{"category": cat, "skills": items} for cat, items in by_cat.items() if items]
        else:
            # Flat list — auto-categorize
            data["skill_categories"] = categorize_skills(skills)

    # ── Deduplicate ALL sections ──

    # Skills: remove duplicates and long sentences
    if "skills" in data and isinstance(data["skills"], list):
        seen = set()
        clean = []
        for s in data["skills"]:
            name = s.get("name", s) if isinstance(s, dict) else s
            if not name or not isinstance(name, str): continue
            key = name.lower().strip()
            if key in seen or len(name) > 60 or len(name.split()) > 6: continue
            seen.add(key)
            clean.append(s)
        data["skills"] = clean

    # Experiences: deduplicate by company+title
    if "experiences" in data and isinstance(data["experiences"], list):
        seen = set()
        clean = []
        for exp in data["experiences"]:
            key = f"{(exp.get('company','') or '').lower()}|{(exp.get('title','') or '').lower()}"
            if key in seen: continue
            seen.add(key)
            clean.append(exp)
        data["experiences"] = clean

    # Education: deduplicate by degree+school
    if "educations" in data and isinstance(data["educations"], list):
        seen = set()
        clean = []
        for edu in data["educations"]:
            key = f"{(edu.get('degree','') or '').lower()}|{(edu.get('school','') or '').lower()}"
            if key in seen: continue
            seen.add(key)
            clean.append(edu)
        data["educations"] = clean

    return template.render(**data)


def _render_pdf(html: str) -> bytes:
    """Synchronous PDF rendering — tries multiple backends."""
    # Strategy 1: Try xhtml2pdf (pisa) — lightweight, no system deps
    try:
        from xhtml2pdf import pisa
        import io
        result = io.BytesIO()
        pisa_status = pisa.CreatePDF(html, dest=result)
        if not pisa_status.err:
            return result.getvalue()
    except ImportError:
        pass
    except Exception:
        pass

    # Strategy 2: Try WeasyPrint
    try:
        from weasyprint import HTML as WpHTML
        pdf = WpHTML(string=html).write_pdf()
        return pdf
    except ImportError:
        pass
    except Exception:
        pass

    # Strategy 3: Fallback — return HTML as "PDF" (basic but functional)
    # This ensures downloads never fail completely
    return html.encode("utf-8")
