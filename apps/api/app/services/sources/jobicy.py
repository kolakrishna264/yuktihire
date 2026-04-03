"""Jobicy adapter — free remote jobs API with tag-based search."""
import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level


class JobicyAdapter(BaseSourceAdapter):
    slug = "jobicy"
    name = "Jobicy"

    async def fetch_jobs(self, search: str | None = None) -> list[NormalizedJob]:
        try:
            url = "https://jobicy.com/api/v2/remote-jobs?count=50"
            if search:
                url += f"&tag={search.lower().replace(' ', '-')}"

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, headers={"User-Agent": "YuktiHire/1.0"})
                resp.raise_for_status()
                data = resp.json()

            jobs = []
            for j in data.get("jobs", []):
                posted_at = None
                pub_date = j.get("pubDate", "")
                if pub_date:
                    try:
                        posted_at = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                    except Exception:
                        pass

                location = j.get("jobGeo", "") or "Remote"
                salary_raw = None
                sal_min = j.get("annualSalaryMin")
                sal_max = j.get("annualSalaryMax")
                if sal_min or sal_max:
                    salary_raw = f"${sal_min or '?'} - ${sal_max or '?'}"

                jobs.append(NormalizedJob(
                    title=j.get("jobTitle", "Untitled"),
                    company=j.get("companyName", "Unknown"),
                    location=location,
                    url=j.get("url", ""),
                    description_text=(j.get("jobDescription", "") or "")[:10000],
                    salary_raw=salary_raw,
                    salary_min=int(sal_min) if sal_min else None,
                    salary_max=int(sal_max) if sal_max else None,
                    work_type="Remote",
                    employment_type=j.get("jobType", "Full-time"),
                    experience_level=_guess_level(j.get("jobTitle", "")),
                    industry=j.get("jobIndustry", ["Technology"])[0] if isinstance(j.get("jobIndustry"), list) and j.get("jobIndustry") else "Technology",
                    posted_at=posted_at,
                    company_logo_url=j.get("companyLogo"),
                    tags=(j.get("jobIndustry", []) if isinstance(j.get("jobIndustry"), list) else [])[:8],
                    external_id=f"jcy-{j.get('id', '')}",
                    source_url=j.get("url", ""),
                    raw_data=j,
                ))
            return jobs
        except Exception as e:
            print(f"[JobicyAdapter] Error: {e}")
            return []
