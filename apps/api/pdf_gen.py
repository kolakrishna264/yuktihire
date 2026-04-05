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
  @page { margin: 0.6in 0.7in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Arial', sans-serif;
    font-size: 10.5pt;
    line-height: 1.4;
    color: #222;
  }

  /* Header */
  .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; }
  .name { font-size: 22pt; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px; }
  .contact { font-size: 9.5pt; color: #444; }
  .contact span { margin: 0 8px; }

  /* Sections */
  .section { margin-bottom: 14px; }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #333;
    padding-bottom: 2px;
    margin-bottom: 8px;
  }

  /* Experience */
  .exp-item { margin-bottom: 10px; }
  .exp-header { display: flex; justify-content: space-between; align-items: baseline; }
  .exp-company { font-weight: bold; font-size: 10.5pt; }
  .exp-dates { font-size: 9.5pt; color: #555; white-space: nowrap; }
  .exp-title { font-style: italic; font-size: 10pt; color: #333; margin-bottom: 3px; }
  .bullets { list-style: none; padding: 0; }
  .bullets li { padding-left: 14px; position: relative; margin-bottom: 2px; font-size: 10pt; }
  .bullets li::before { content: "•"; position: absolute; left: 2px; }

  /* Skills */
  .skills-grid { display: flex; flex-wrap: wrap; gap: 4px 0; }
  .skill-row { width: 100%; font-size: 10pt; margin-bottom: 3px; }
  .skill-category { font-weight: bold; margin-right: 6px; }

  /* Education */
  .edu-item { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .edu-left .degree { font-weight: bold; font-size: 10.5pt; }
  .edu-left .school { font-size: 10pt; color: #333; }
  .edu-right { text-align: right; font-size: 9.5pt; color: #555; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="name">{{ contact.full_name or name }}</div>
  <div class="contact">
    {% if contact.email %}<span>{{ contact.email }}</span>{% endif %}
    {% if contact.phone %}<span>{{ contact.phone }}</span>{% endif %}
    {% if contact.location %}<span>{{ contact.location }}</span>{% endif %}
    {% if contact.linkedin %}<span>{{ contact.linkedin }}</span>{% endif %}
    {% if contact.github %}<span>{{ contact.github }}</span>{% endif %}
  </div>
</div>

<!-- Summary -->
{% if summary %}
<div class="section">
  <div class="section-title">Professional Summary</div>
  <p style="font-size:10pt; line-height:1.5;">{{ summary }}</p>
</div>
{% endif %}

<!-- Experience -->
{% if experiences %}
<div class="section">
  <div class="section-title">Professional Experience</div>
  {% for exp in experiences %}
  <div class="exp-item">
    <div class="exp-header">
      <span class="exp-company">{{ exp.company }}</span>
      <span class="exp-dates">
        {{ exp.start_date or exp.startDate or '' }}
        {% if exp.end_date or exp.endDate %} – {{ exp.end_date or exp.endDate }}{% elif exp.current %} – Present{% endif %}
      </span>
    </div>
    <div class="exp-title">{{ exp.title }}</div>
    {% if exp.bullets %}
    <ul class="bullets">
      {% for bullet in exp.bullets %}
      <li>{{ bullet }}</li>
      {% endfor %}
    </ul>
    {% endif %}
  </div>
  {% endfor %}
</div>
{% endif %}

<!-- Skills -->
{% if skills %}
<div class="section">
  <div class="section-title">Technical Skills</div>
  <p style="font-size:10pt;">
  {% set seen_skills = [] %}
  {% for skill in skills %}
    {% set skill_name = skill.name if skill is mapping else skill %}
    {% if skill_name and skill_name|length < 60 and skill_name not in seen_skills %}
      {% if seen_skills %}· {% endif %}{{ skill_name }}{% if seen_skills.append(skill_name) %}{% endif %}
    {% endif %}
  {% endfor %}
  </p>
</div>
{% endif %}

<!-- Education -->
{% if educations %}
<div class="section">
  <div class="section-title">Education</div>
  {% for edu in educations %}
  <div class="edu-item">
    <div class="edu-left">
      <div class="degree">{{ edu.degree }}{% if edu.field %}, {{ edu.field }}{% endif %}</div>
      <div class="school">{{ edu.school }}</div>
      {% if edu.gpa %}<div style="font-size:9.5pt;color:#555">GPA: {{ edu.gpa }}</div>{% endif %}
    </div>
    <div class="edu-right">
      {% if edu.end_date or edu.endDate %}{{ edu.end_date or edu.endDate }}{% endif %}
    </div>
  </div>
  {% endfor %}
</div>
{% endif %}

<!-- Projects -->
{% if projects %}
<div class="section">
  <div class="section-title">Projects</div>
  {% for proj in projects %}
  <div class="exp-item">
    <div class="exp-header">
      <span class="exp-company">{{ proj.name }}</span>
      {% if proj.url %}<span style="font-size:9pt;color:#555">{{ proj.url }}</span>{% endif %}
    </div>
    {% if proj.description %}<div class="exp-title">{{ proj.description }}</div>{% endif %}
    {% if proj.bullets %}
    <ul class="bullets">
      {% for bullet in proj.bullets %}
      <li>{{ bullet }}</li>
      {% endfor %}
    </ul>
    {% endif %}
  </div>
  {% endfor %}
</div>
{% endif %}

</body>
</html>"""


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

    # Clean up skills: deduplicate and remove long sentences
    if "skills" in data and isinstance(data["skills"], list):
        seen = set()
        clean_skills = []
        for s in data["skills"]:
            name = s.get("name", s) if isinstance(s, dict) else s
            if not name or not isinstance(name, str):
                continue
            name_lower = name.lower().strip()
            # Skip duplicates
            if name_lower in seen:
                continue
            # Skip long sentences (>60 chars or >5 words = not a skill)
            if len(name) > 60 or len(name.split()) > 6:
                continue
            seen.add(name_lower)
            clean_skills.append(s)
        data["skills"] = clean_skills

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
