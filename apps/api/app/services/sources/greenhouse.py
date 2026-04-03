"""Greenhouse public boards adapter — fetches jobs from top US tech companies."""
import asyncio
import httpx
import re
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level

# Top US tech companies using Greenhouse
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
        all_jobs = []

        async def _fetch_board(client: httpx.AsyncClient, board: str):
            """Fetch a single board's jobs."""
            try:
                resp = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs",
                )
                if resp.status_code != 200:
                    return []
                data = resp.json()
                board_jobs = []
                for j in data.get("jobs", []):
                    title = j.get("title", "")
                    if search and search.lower() not in title.lower():
                        continue

                    loc_name = ""
                    loc_obj = j.get("location")
                    if isinstance(loc_obj, dict):
                        loc_name = loc_obj.get("name", "")
                    elif isinstance(loc_obj, str):
                        loc_name = loc_obj

                    posted_at = None
                    updated = j.get("updated_at") or j.get("first_published") or ""
                    if updated:
                        try:
                            posted_at = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                        except Exception:
                            pass

                    company = j.get("company_name") or board.replace("-", " ").title()

                    board_jobs.append(NormalizedJob(
                        title=title,
                        company=company,
                        location=loc_name or "United States",
                        url=j.get("absolute_url", ""),
                        description_text="",  # Skip descriptions for speed
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
                return board_jobs
            except Exception:
                return []

        # Fetch boards in parallel batches of 10 (30s timeout for slow networks)
        async with httpx.AsyncClient(timeout=30) as client:
            for i in range(0, len(GREENHOUSE_BOARDS), 10):
                batch = GREENHOUSE_BOARDS[i:i+10]
                results = await asyncio.gather(
                    *[_fetch_board(client, board) for board in batch],
                    return_exceptions=True,
                )
                for r in results:
                    if isinstance(r, list):
                        all_jobs.extend(r)
                await asyncio.sleep(0.5)  # Brief pause between batches

        print(f"[GreenhouseAdapter] Fetched {len(all_jobs)} jobs from {len(GREENHOUSE_BOARDS)} boards")
        return all_jobs
