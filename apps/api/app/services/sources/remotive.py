import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level


class RemotiveAdapter(BaseSourceAdapter):
    slug = "remotive"
    name = "Remotive"

    async def fetch_jobs(self) -> list[NormalizedJob]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get("https://remotive.com/api/remote-jobs?limit=100")
                resp.raise_for_status()
                data = resp.json()

            jobs = []
            for j in data.get("jobs", []):
                tags = j.get("tags", []) or []
                pub_date = j.get("publication_date", "")
                posted_at = None
                try:
                    posted_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                except Exception:
                    pass

                salary_raw = (j.get("salary") or "").strip() or None

                jobs.append(NormalizedJob(
                    title=j.get("title", "Untitled"),
                    company=j.get("company_name", "Unknown"),
                    location=j.get("candidate_required_location", "Worldwide"),
                    url=j.get("url", ""),
                    description_text=(j.get("description", "") or "")[:10000],
                    salary_raw=salary_raw,
                    work_type="Remote",
                    employment_type=(j.get("job_type", "").replace("_", "-").title()) or "Full-time",
                    experience_level=_guess_level(j.get("title", "")),
                    industry=j.get("category", "Technology"),
                    posted_at=posted_at,
                    company_logo_url=j.get("company_logo") or j.get("company_logo_url"),
                    tags=tags[:10],
                    external_id=f"rem-{j.get('id', '')}",
                    source_url=j.get("url", ""),
                    raw_data=j,
                ))
            return jobs
        except Exception as e:
            print(f"[RemotiveAdapter] Error: {e}")
            return []
