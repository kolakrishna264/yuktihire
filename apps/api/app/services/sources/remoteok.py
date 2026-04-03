"""RemoteOK adapter — fetches from their JSON API."""
import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level


class RemoteOKAdapter(BaseSourceAdapter):
    slug = "remoteok"
    name = "RemoteOK"

    async def fetch_jobs(self) -> list[NormalizedJob]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    "https://remoteok.com/api",
                    headers={"User-Agent": "YuktiHire/1.0"},
                )
                resp.raise_for_status()
                data = resp.json()

            jobs = []
            for j in data:
                if not isinstance(j, dict) or "id" not in j:
                    continue

                tags = j.get("tags", []) or []
                if isinstance(tags, str):
                    tags = [t.strip() for t in tags.split(",")]

                posted_at = None
                epoch = j.get("epoch")
                if epoch:
                    try:
                        posted_at = datetime.fromtimestamp(int(epoch))
                    except (ValueError, TypeError):
                        pass

                salary_raw = None
                sal_min = j.get("salary_min")
                sal_max = j.get("salary_max")
                if sal_min or sal_max:
                    salary_raw = f"${sal_min or '?'} - ${sal_max or '?'}"

                jobs.append(NormalizedJob(
                    title=j.get("position", "Untitled"),
                    company=j.get("company", "Unknown"),
                    location=j.get("location", "Remote"),
                    url=j.get("url") or f"https://remoteok.com/remote-jobs/{j.get('id', '')}",
                    description_text=(j.get("description", "") or "")[:10000],
                    salary_raw=salary_raw,
                    salary_min=int(sal_min) if sal_min else None,
                    salary_max=int(sal_max) if sal_max else None,
                    work_type="Remote",
                    employment_type="Full-time",
                    experience_level=_guess_level(j.get("position", "")),
                    industry="Technology",
                    posted_at=posted_at,
                    company_logo_url=j.get("company_logo") or j.get("logo"),
                    tags=tags[:10],
                    external_id=f"rok-{j.get('id', '')}",
                    source_url=j.get("url", ""),
                    raw_data=j,
                ))
            return jobs
        except Exception as e:
            print(f"[RemoteOKAdapter] Error: {e}")
            return []
