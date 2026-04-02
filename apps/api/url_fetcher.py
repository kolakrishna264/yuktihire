"""
URL Fetcher — Fetch job description text from a URL.
"""
import httpx
import re
from bs4 import BeautifulSoup


async def fetch_url_text(url: str) -> str:
    """
    Fetch a URL and extract meaningful text content.
    Raises ValueError if URL is behind login or returns no content.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)

    if response.status_code == 401 or response.status_code == 403:
        raise ValueError("This page requires login. Please paste the job description text.")

    if response.status_code != 200:
        raise ValueError(f"Could not fetch URL (status {response.status_code})")

    html = response.text
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "header", "footer",
                     "aside", "advertisement", ".cookie-banner"]):
        tag.decompose()

    # Try to find the job description section
    jd_selectors = [
        ".job-description", ".job-details", ".description",
        "[data-testid='job-description']", ".jobDescriptionContent",
        "#job-description", ".jobsearch-jobDescriptionText",
        "[class*='description']", "[class*='job-detail']",
    ]

    for selector in jd_selectors:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(separator="\n", strip=True)
            if len(text) > 200:
                return clean_text(text)

    # Fallback: main content
    main = soup.find("main") or soup.find("article") or soup.find("body")
    text = main.get_text(separator="\n", strip=True) if main else soup.get_text()

    text = clean_text(text)

    if len(text) < 100:
        raise ValueError("Could not extract job description from this URL. Please paste the text.")

    return text[:8000]  # Limit to avoid token explosion


def clean_text(text: str) -> str:
    """Clean extracted text."""
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {3,}', ' ', text)
    text = re.sub(r'\t+', ' ', text)
    return text.strip()
