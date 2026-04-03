"""Title-based targeted job ingestion strategy."""
import asyncio
from .remotive import RemotiveAdapter, REMOTIVE_CATEGORIES
from .remoteok import RemoteOKAdapter
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

# Key search tags for RemoteOK (it uses simple tag matching)
REMOTEOK_TAGS = [
    "engineer", "developer", "data", "devops", "python", "javascript",
    "react", "backend", "frontend", "machine-learning", "ai",
    "cloud", "security", "qa", "analyst", "sre",
]


async def run_targeted_ingestion(ingestor: JobIngestor) -> dict:
    """Broader fetching using categories and tags, not per-title search."""
    stats = {"total_new": 0, "total_updated": 0, "sources_processed": 0, "errors": 0}

    remotive = RemotiveAdapter()
    remoteok = RemoteOKAdapter()

    # 1. Remotive: fetch by category (each category returns different jobs)
    for category in REMOTIVE_CATEGORIES:
        try:
            jobs = await remotive.fetch_by_category(category)
            if jobs:
                new, updated = await ingestor.ingest_batch(jobs, remotive.slug)
                stats["total_new"] += new
                stats["total_updated"] += updated
                print(f"[Targeted] Remotive category '{category}': {new} new, {updated} updated ({len(jobs)} fetched)")
            await asyncio.sleep(1)
        except Exception as e:
            stats["errors"] += 1
            print(f"[Targeted] Remotive '{category}' error: {e}")

    # 2. RemoteOK: fetch by tags
    for tag in REMOTEOK_TAGS:
        try:
            jobs = await remoteok.fetch_jobs(search=tag)
            if jobs:
                new, updated = await ingestor.ingest_batch(jobs, remoteok.slug)
                stats["total_new"] += new
                stats["total_updated"] += updated
                if new > 0:
                    print(f"[Targeted] RemoteOK tag '{tag}': {new} new, {updated} updated")
            await asyncio.sleep(1.5)  # RemoteOK is more sensitive to rate limiting
        except Exception as e:
            stats["errors"] += 1
            print(f"[Targeted] RemoteOK '{tag}' error: {e}")

    stats["sources_processed"] = len(REMOTIVE_CATEGORIES) + len(REMOTEOK_TAGS)
    print(f"[Targeted] Complete: {stats['total_new']} new, {stats['total_updated']} updated")
    return stats
