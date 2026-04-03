from .base import BaseSourceAdapter, NormalizedJob


class ManualAdapter(BaseSourceAdapter):
    slug = "manual"
    name = "Manual Entry"

    async def fetch_jobs(self) -> list[NormalizedJob]:
        # Manual adapter doesn't fetch -- jobs are pushed via API
        return []
