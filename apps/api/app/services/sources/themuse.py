"""The Muse adapter — free API with US job filter, no key needed."""
import httpx
from datetime import datetime
from .base import BaseSourceAdapter, NormalizedJob, _guess_level

# Categories on The Muse that match our target roles
MUSE_CATEGORIES = [
    "Data Science",
    "Data and Analytics",
    "Software Engineering",
    "IT",
    "Design and UX",
    "Project and Product Management",
]


class TheMuseAdapter(BaseSourceAdapter):
    slug = "themuse"
    name = "The Muse"

    async def fetch_jobs(self, search: str | None = None) -> list[NormalizedJob]:
        all_jobs = []
        async with httpx.AsyncClient(timeout=12) as client:
            for category in MUSE_CATEGORIES:
                try:
                    params = {
                        "page": 1,
                        "category": category,
                        "location": "Flexible / Remote",
                    }
                    resp = await client.get(
                        "https://www.themuse.com/api/public/jobs",
                        params=params,
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()

                    for j in data.get("results", []):
                        title = j.get("name", "")
                        if search and search.lower() not in title.lower():
                            continue

                        company_obj = j.get("company", {})
                        company = company_obj.get("name", "Unknown") if isinstance(company_obj, dict) else "Unknown"

                        locations = j.get("locations", [])
                        loc_name = locations[0].get("name", "Remote") if locations and isinstance(locations[0], dict) else "Remote"

                        posted_at = None
                        pub = j.get("publication_date", "")
                        if pub:
                            try:
                                posted_at = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                            except Exception:
                                pass

                        tags = j.get("tags", []) or []
                        if isinstance(tags, list) and tags and isinstance(tags[0], dict):
                            tags = [t.get("name", "") for t in tags]

                        all_jobs.append(NormalizedJob(
                            title=title,
                            company=company,
                            location=loc_name,
                            url=f"https://www.themuse.com/jobs/{j.get('id', '')}",
                            description_text=(j.get("contents", "") or "")[:5000],
                            work_type="Remote" if "remote" in loc_name.lower() or "flexible" in loc_name.lower() else "On-site",
                            employment_type="Full-time",
                            experience_level=_guess_level(title),
                            industry=category,
                            posted_at=posted_at,
                            tags=[t for t in tags if isinstance(t, str)][:8],
                            external_id=f"muse-{j.get('id', '')}",
                            source_url=f"https://www.themuse.com/jobs/{j.get('id', '')}",
                            raw_data={},
                        ))
                except Exception:
                    continue
        print(f"[TheMuseAdapter] Fetched {len(all_jobs)} jobs")
        return all_jobs
