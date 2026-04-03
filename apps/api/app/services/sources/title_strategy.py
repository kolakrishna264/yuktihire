"""Title-based targeted job ingestion — broader fetching via categories and tags."""
import asyncio
from .remotive import RemotiveAdapter, REMOTIVE_CATEGORIES
from .remoteok import RemoteOKAdapter
from .jobicy import JobicyAdapter
from .ingestor import JobIngestor

TARGET_TITLES = [
    "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer",
    "Data Engineer", "Data Analyst", "Data Scientist", "ML Engineer", "AI Engineer",
    "Machine Learning Engineer", "DevOps Engineer", "QA Engineer", "Test Engineer",
    "Cloud Engineer", "Platform Engineer", "Security Engineer", "SRE",
    "Analytics Engineer", "Product Analyst", "BI Analyst", "MLOps Engineer",
    "Research Engineer", "Solutions Engineer", "ETL Developer", "Database Engineer",
    "Automation Engineer", "Prompt Engineer", "Application Engineer",
    "Integration Engineer", "Support Engineer",
]

REMOTEOK_TAGS = [
    "engineer", "developer", "data", "devops", "python", "javascript",
    "react", "backend", "frontend", "machine-learning", "ai",
    "cloud", "security", "qa", "analyst", "sre", "golang", "rust",
    "java", "typescript",
]

JOBICY_TAGS = [
    "software-engineer", "data-engineer", "data-scientist", "machine-learning",
    "devops", "frontend", "backend", "full-stack", "cloud", "ai",
    "python", "react", "security", "qa", "sre",
]


async def run_targeted_ingestion(ingestor: JobIngestor) -> dict:
    stats = {"total_new": 0, "total_updated": 0, "errors": 0}

    remotive = RemotiveAdapter()
    remoteok = RemoteOKAdapter()
    jobicy = JobicyAdapter()

    for category in REMOTIVE_CATEGORIES:
        try:
            jobs = await remotive.fetch_by_category(category)
            if jobs:
                new, updated = await ingestor.ingest_batch(jobs, remotive.slug)
                stats["total_new"] += new
                stats["total_updated"] += updated
                if new > 0:
                    print(f"[Targeted] Remotive '{category}': {new} new")
            await asyncio.sleep(1)
        except Exception as e:
            stats["errors"] += 1

    for tag in REMOTEOK_TAGS:
        try:
            jobs = await remoteok.fetch_jobs(search=tag)
            if jobs:
                new, updated = await ingestor.ingest_batch(jobs, remoteok.slug)
                stats["total_new"] += new
                stats["total_updated"] += updated
                if new > 0:
                    print(f"[Targeted] RemoteOK '{tag}': {new} new")
            await asyncio.sleep(1.5)
        except Exception as e:
            stats["errors"] += 1

    for tag in JOBICY_TAGS:
        try:
            jobs = await jobicy.fetch_jobs(search=tag)
            if jobs:
                new, updated = await ingestor.ingest_batch(jobs, jobicy.slug)
                stats["total_new"] += new
                stats["total_updated"] += updated
                if new > 0:
                    print(f"[Targeted] Jobicy '{tag}': {new} new")
            await asyncio.sleep(1)
        except Exception as e:
            stats["errors"] += 1

    print(f"[Targeted] Complete: {stats['total_new']} new, {stats['total_updated']} updated")
    return stats
