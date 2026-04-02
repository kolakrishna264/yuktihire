"""
Resume Parser — Extract text and structured data from PDF/DOCX uploads.
"""
import io
import re


async def parse_resume(content: bytes, filename: str) -> dict:
    """
    Extract structured data from resume file.
    Returns dict with name, email, phone, work experiences, educations, skills.
    """
    text = extract_text(content, filename)
    if not text:
        raise ValueError("Could not extract text from file")

    # Use AI to structure the extracted text
    from app.services.tailoring.jd_parser import extract_json_safe
    from anthropic import AsyncAnthropic
    from app.core.config import get_settings

    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system="You are a resume parser. Extract structured data. Return only valid JSON.",
        messages=[{
            "role": "user",
            "content": f"""Parse this resume and extract all information.

RESUME TEXT:
{text[:8000]}

Return this exact JSON (no other text):
{{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "headline": "",
  "summary": "",
  "skills": ["skill1", "skill2"],
  "experiences": [
    {{
      "title": "",
      "company": "",
      "location": "",
      "start_date": "YYYY-MM-DD or month YYYY",
      "end_date": "YYYY-MM-DD or null",
      "current": false,
      "bullets": ["bullet1", "bullet2"],
      "skills_used": []
    }}
  ],
  "educations": [
    {{
      "degree": "",
      "field": "",
      "school": "",
      "start_date": null,
      "end_date": null,
      "gpa": null
    }}
  ],
  "certifications": [],
  "projects": []
}}"""
        }]
    )

    try:
        parsed = extract_json_safe(message.content[0].text)
        parsed["confidence"] = 0.85
        parsed["raw_text"] = text
        return parsed
    except Exception as e:
        return {
            "confidence": 0.3,
            "raw_text": text,
            "error": str(e),
            "name": "", "email": "", "phone": "",
            "experiences": [], "educations": [], "skills": [],
        }


def extract_text(content: bytes, filename: str) -> str:
    """Extract raw text from PDF or DOCX bytes."""
    filename = filename.lower()

    if filename.endswith(".pdf"):
        return extract_pdf_text(content)
    elif filename.endswith(".docx") or filename.endswith(".doc"):
        return extract_docx_text(content)
    else:
        # Try PDF first, then DOCX
        try:
            text = extract_pdf_text(content)
            if text.strip():
                return text
        except Exception:
            pass
        try:
            return extract_docx_text(content)
        except Exception:
            pass
    return ""


def extract_pdf_text(content: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def extract_docx_text(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    paragraphs = []
    for para in doc.paragraphs:
        if para.text.strip():
            paragraphs.append(para.text)
    # Also extract from tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text.strip():
                    paragraphs.append(cell.text)
    return "\n".join(paragraphs)
