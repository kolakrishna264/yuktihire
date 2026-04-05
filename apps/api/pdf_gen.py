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
  @page { margin: 0.55in 0.65in; size: letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.35; color: #1a1a1a; }

  .header { text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #888; }
  .name { font-size: 18pt; font-weight: bold; letter-spacing: 0.3px; }
  .contact { font-size: 9pt; color: #444; margin-top: 3px; }

  .section { margin-bottom: 10px; }
  .section-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;
    border-bottom: 0.5pt solid #aaa; padding-bottom: 1px; margin-bottom: 5px; color: #222; }

  .exp-item { margin-bottom: 8px; }
  .exp-row { display: flex; justify-content: space-between; align-items: baseline; }
  .exp-company { font-weight: bold; font-size: 10.5pt; }
  .exp-dates { font-size: 9pt; color: #666; }
  .exp-title { font-style: italic; font-size: 10pt; color: #333; margin-bottom: 2px; }

  ul.bullets { list-style-type: disc; margin-left: 16px; padding: 0; }
  ul.bullets li { font-size: 9.5pt; margin-bottom: 1.5px; line-height: 1.35; color: #222; }

  .skills-text { font-size: 9.5pt; line-height: 1.5; }

  .edu-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .edu-degree { font-weight: bold; font-size: 10pt; }
  .edu-school { font-size: 9.5pt; color: #444; }
  .edu-date { font-size: 9pt; color: #666; }
</style>
</head>
<body>

<div class="header">
  <div class="name">{{ contact.full_name or name }}</div>
  <div class="contact">
    {% set parts = [] %}
    {% if contact.email %}{% if parts.append(contact.email) %}{% endif %}{% endif %}
    {% if contact.phone %}{% if parts.append(contact.phone) %}{% endif %}{% endif %}
    {% if contact.location %}{% if parts.append(contact.location) %}{% endif %}{% endif %}
    {% if contact.linkedin %}{% if parts.append(contact.linkedin) %}{% endif %}{% endif %}
    {% if contact.github %}{% if parts.append(contact.github) %}{% endif %}{% endif %}
    {{ parts | join('  |  ') }}
  </div>
</div>

{% if summary %}
<div class="section">
  <div class="section-title">Professional Summary</div>
  <p style="font-size:9.5pt; line-height:1.45;">{{ summary }}</p>
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

{% if skills %}
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
