"""Job ingestion service -- deduplicates and upserts normalized jobs into the jobs table."""
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.discover import Job, JobSource, JobSourceLink, JobSkill
from .base import NormalizedJob, compute_fingerprint
from .skill_extractor import extract_skills_from_tags


class JobIngestor:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_source(self, slug: str) -> JobSource | None:
        result = await self.db.execute(select(JobSource).where(JobSource.slug == slug))
        return result.scalar_one_or_none()

    async def ingest(self, job: NormalizedJob, source_slug: str) -> tuple[str, bool]:
        """Ingest a normalized job. Returns (job_id, is_new)."""
        fingerprint = compute_fingerprint(job.company, job.title, job.location)

        # Check fingerprint first
        result = await self.db.execute(select(Job).where(Job.fingerprint == fingerprint))
        existing = result.scalar_one_or_none()

        # Fallback: check URL
        if not existing and job.url:
            result = await self.db.execute(select(Job).where(Job.url == job.url))
            existing = result.scalar_one_or_none()

        source = await self.get_source(source_slug)
        if not source:
            print(f"[Ingestor] Source '{source_slug}' not found")
            return "", False

        if existing:
            # Merge null fields
            self._merge_fields(existing, job)
            await self._ensure_source_link(existing.id, source.id, job)
            await self.db.flush()
            return existing.id, False
        else:
            # Create new job
            new_job = Job(
                fingerprint=fingerprint,
                title=job.title,
                company=job.company,
                company_normalized=job.company.lower().strip(),
                location=job.location,
                url=job.url,
                description_text=job.description_text,
                salary_min=job.salary_min,
                salary_max=job.salary_max,
                salary_raw=job.salary_raw,
                work_type=job.work_type,
                employment_type=job.employment_type,
                experience_level=job.experience_level,
                industry=job.industry,
                posted_at=job.posted_at,
                company_logo_url=job.company_logo_url,
                extra_data={"source_slug": source_slug},
            )
            self.db.add(new_job)
            await self.db.flush()
            await self.db.refresh(new_job)

            # Add source link
            await self._ensure_source_link(new_job.id, source.id, job)

            # Extract and save skills
            await self._save_skills(new_job.id, job.tags)

            return new_job.id, True

    def _merge_fields(self, existing: Job, new: NormalizedJob):
        """Fill in null fields on existing job with data from new source."""
        if not existing.description_text and new.description_text:
            existing.description_text = new.description_text
        if not existing.salary_raw and new.salary_raw:
            existing.salary_raw = new.salary_raw
            existing.salary_min = new.salary_min
            existing.salary_max = new.salary_max
        if not existing.company_logo_url and new.company_logo_url:
            existing.company_logo_url = new.company_logo_url
        if not existing.work_type and new.work_type:
            existing.work_type = new.work_type
        if not existing.experience_level and new.experience_level:
            existing.experience_level = new.experience_level
        existing.updated_at = datetime.now(timezone.utc)

    async def _ensure_source_link(self, job_id: str, source_id: str, job: NormalizedJob):
        """Create source link if not already exists."""
        result = await self.db.execute(
            select(JobSourceLink).where(
                JobSourceLink.source_id == source_id,
                JobSourceLink.external_id == job.external_id,
            )
        )
        if not result.scalar_one_or_none():
            link = JobSourceLink(
                job_id=job_id,
                source_id=source_id,
                external_id=job.external_id,
                source_url=job.source_url,
                raw_data=job.raw_data,
            )
            self.db.add(link)

    async def _save_skills(self, job_id: str, tags: list[str]):
        """Extract and save skills from tags."""
        skill_pairs = extract_skills_from_tags(tags)
        for skill_name, canonical in skill_pairs:
            skill = JobSkill(
                job_id=job_id,
                skill_name=skill_name,
                skill_canonical=canonical,
                is_required=True,
            )
            self.db.add(skill)

    async def ingest_batch(self, jobs: list[NormalizedJob], source_slug: str) -> tuple[int, int]:
        """Ingest a batch. Returns (new_count, updated_count)."""
        new_count = 0
        updated_count = 0
        for job in jobs:
            try:
                _, is_new = await self.ingest(job, source_slug)
                if is_new:
                    new_count += 1
                else:
                    updated_count += 1
            except Exception as e:
                print(f"[Ingestor] Error ingesting {job.title} @ {job.company}: {e}")
        await self.db.commit()

        # Update source last_sync_at
        source = await self.get_source(source_slug)
        if source:
            source.last_sync_at = datetime.now(timezone.utc)
            await self.db.commit()

        return new_count, updated_count
