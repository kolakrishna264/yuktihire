"""Greenhouse public boards adapter — fetches jobs from top tech companies."""
import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level

# Top US tech companies using Greenhouse (public board slugs)
GREENHOUSE_BOARDS = [
    "discord", "stripe", "figma", "notion", "databricks",
    "cloudflare", "plaid", "brex", "ramp", "scale",
    "anthropic", "openai", "anyscale", "huggingface", "cohere",
    "datadog", "hashicorp", "elastic", "confluent", "cockroachlabs",
    "snyk", "gitlabcom", "airtable", "zapier", "webflow",
    "pinterest", "reddit", "quora", "duolingo", "instacart",
    "doordash", "lyft", "affirm", "chime", "robinhood",
    "nerdwallet", "squarespace", "mongodb", "yugabyte", "timescale",
    "dbt", "fivetran", "airbyte", "prefect", "astronomer",
    "vercel", "netlify", "fly", "render", "railway",
]


class GreenhouseAdapter(BaseSourceAdapter):
    slug = "greenhouse"
    name = "Greenhouse"

    async def fetch_jobs(self, search: str | None = None) -> list[NormalizedJob]:
        """Fetch jobs from multiple Greenhouse company boards."""
        all_jobs = []
        async with httpx.AsyncClient(timeout=10) as client:
            for board in GREENHOUSE_BOARDS:
                try:
                    resp = await client.get(
                        f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs",
                        params={"content": "true"},
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    for j in data.get("jobs", []):
                        title = j.get("title", "")
                        loc_name = ""
                        loc_obj = j.get("location")
                        if isinstance(loc_obj, dict):
                            loc_name = loc_obj.get("name", "")
                        elif isinstance(loc_obj, str):
                            loc_name = loc_obj

                        # If searching, filter by title match
                        if search and search.lower() not in title.lower():
                            continue

                        posted_at = None
                        updated = j.get("updated_at") or j.get("first_published") or ""
                        if updated:
                            try:
                                posted_at = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                            except Exception:
                                pass

                        company = j.get("company_name") or board.replace("-", " ").title()
                        desc = ""
                        content = j.get("content", "")
                        if content:
                            # Strip HTML tags simply
                            import re
                            desc = re.sub(r"<[^>]+>", " ", content)
                            desc = re.sub(r"\s+", " ", desc).strip()[:5000]

                        all_jobs.append(NormalizedJob(
                            title=title,
                            company=company,
                            location=loc_name or "United States",
                            url=j.get("absolute_url", ""),
                            description_text=desc,
                            work_type="Remote" if "remote" in loc_name.lower() else "On-site",
                            employment_type="Full-time",
                            experience_level=_guess_level(title),
                            industry="Technology",
                            posted_at=posted_at,
                            tags=[],
                            external_id=f"gh-{board}-{j.get('id', '')}",
                            source_url=j.get("absolute_url", ""),
                            raw_data={"board": board},
                        ))
                except Exception as e:
                    # Skip failed boards silently
                    continue
        print(f"[GreenhouseAdapter] Fetched {len(all_jobs)} jobs from {len(GREENHOUSE_BOARDS)} boards")
        return all_jobs
