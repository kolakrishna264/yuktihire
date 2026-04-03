import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level


class ArbeitnowAdapter(BaseSourceAdapter):
    slug = "arbeitnow"
    name = "Arbeitnow"

    async def fetch_jobs(self, search: str | None = None) -> list[NormalizedJob]:
        # Arbeitnow doesn't support keyword search — fetch all, multiple pages
        all_jobs = []
        for page in range(1, 6):  # Fetch 5 pages
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.get(f"https://www.arbeitnow.com/api/job-board-api?page={page}")
                    resp.raise_for_status()
                    data = resp.json()

                page_data = data.get("data", [])
                if not page_data:
                    break  # No more pages

                for j in page_data:
                    tags = j.get("tags", []) or []
                    created = j.get("created_at", 0)
                    posted_at = None
                    try:
                        posted_at = datetime.fromtimestamp(created)
                    except Exception:
                        pass

                    location = j.get("location", "") or "Not specified"
                    work_type = "Remote" if j.get("remote", False) else "On-site"

                    all_jobs.append(NormalizedJob(
                        title=j.get("title", "Untitled"),
                        company=j.get("company_name", "Unknown"),
                        location=location,
                        url=j.get("url", ""),
                        description_text=(j.get("description", "") or "")[:10000],
                        work_type=work_type,
                        employment_type="Full-time",
                        experience_level=_guess_level(j.get("title", "")),
                        industry=tags[0] if tags else "Technology",
                        posted_at=posted_at,
                        tags=tags[:10],
                        external_id=f"arb-{j.get('slug', '')}",
                        source_url=j.get("url", ""),
                        raw_data=j,
                    ))
            except Exception as e:
                print(f"[ArbeitnowAdapter] Page {page} error: {e}")
                break
        return all_jobs
