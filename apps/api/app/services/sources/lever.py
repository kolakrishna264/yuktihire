"""Lever public postings adapter — fetches from top tech company Lever boards."""
import asyncio
import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level

# Top companies using Lever for hiring
LEVER_COMPANIES = [
    "netflix", "twitch", "coinbase", "rippling", "retool",
    "samsara", "netlify", "postman", "labelbox", "weights-and-biases",
    "deepgram", "together-ai", "replit", "modal-labs", "anduril",
    "shield-ai", "chainguard", "teleport", "snorkelai", "wandb",
    "drata", "grafana", "mux", "planetscale", "neon",
    "supabase", "temporal", "upstash", "prisma", "hasura",
]


class LeverAdapter(BaseSourceAdapter):
    slug = "lever"
    name = "Lever"

    async def fetch_jobs(self, search: str | None = None) -> list[NormalizedJob]:
        all_jobs = []

        async def _fetch_company(client: httpx.AsyncClient, company: str):
            try:
                resp = await client.get(f"https://api.lever.co/v0/postings/{company}")
                if resp.status_code != 200:
                    return []
                data = resp.json()
                if not isinstance(data, list):
                    return []

                company_jobs = []
                for j in data:
                    title = j.get("text", "")
                    if search and search.lower() not in title.lower():
                        continue

                    categories = j.get("categories", {})
                    location = categories.get("location", "") or ""
                    team = categories.get("team", "") or ""
                    commitment = categories.get("commitment", "") or ""

                    posted_at = None
                    created = j.get("createdAt")
                    if created:
                        try:
                            posted_at = datetime.fromtimestamp(created / 1000)
                        except Exception:
                            pass

                    company_jobs.append(NormalizedJob(
                        title=title,
                        company=company.replace("-", " ").title(),
                        location=location or "United States",
                        url=j.get("hostedUrl") or j.get("applyUrl") or "",
                        description_text=(j.get("descriptionPlain") or "")[:5000],
                        work_type="Remote" if "remote" in location.lower() else "On-site",
                        employment_type=commitment or "Full-time",
                        experience_level=_guess_level(title),
                        industry=team or "Technology",
                        posted_at=posted_at,
                        tags=[team] if team else [],
                        external_id=f"lever-{company}-{j.get('id', '')}",
                        source_url=j.get("hostedUrl", ""),
                        raw_data={"company": company},
                    ))
                return company_jobs
            except Exception:
                return []

        # Fetch in parallel batches of 10
        async with httpx.AsyncClient(timeout=15) as client:
            for i in range(0, len(LEVER_COMPANIES), 10):
                batch = LEVER_COMPANIES[i:i+10]
                results = await asyncio.gather(
                    *[_fetch_company(client, c) for c in batch],
                    return_exceptions=True,
                )
                for r in results:
                    if isinstance(r, list):
                        all_jobs.extend(r)
                await asyncio.sleep(0.5)

        print(f"[LeverAdapter] Fetched {len(all_jobs)} jobs from {len(LEVER_COMPANIES)} companies")
        return all_jobs
