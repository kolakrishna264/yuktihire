"""Title-based targeted job ingestion strategy."""
import asyncio
from .remotive import RemotiveAdapter
from .ingestor import JobIngestor

# Top 30 tech/data job titles to actively search for
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

# Adapters that support keyword search
SEARCHABLE_ADAPTERS = [
    RemotiveAdapter(),
]


async def run_targeted_ingestion(ingestor: JobIngestor) -> dict:
    """Fetch jobs for each target title from search-capable sources.

    Rate-limited: 1 request per second to avoid API throttling.
    Returns stats dict.
    """
    stats = {"total_new": 0, "total_updated": 0, "titles_processed": 0, "errors": 0}

    for title in TARGET_TITLES:
        for adapter in SEARCHABLE_ADAPTERS:
            try:
                jobs = await adapter.fetch_jobs(search=title)
                if jobs:
                    new, updated = await ingestor.ingest_batch(jobs, adapter.slug)
                    stats["total_new"] += new
                    stats["total_updated"] += updated
                    if new > 0 or updated > 0:
                        print(f"[Targeted] {adapter.name} '{title}': {new} new, {updated} updated")
                # Rate limit: 1 second between requests
                await asyncio.sleep(1)
            except Exception as e:
                stats["errors"] += 1
                print(f"[Targeted] {adapter.name} '{title}' error: {e}")
        stats["titles_processed"] += 1

    print(f"[Targeted] Complete: {stats['total_new']} new, {stats['total_updated']} updated across {stats['titles_processed']} titles")
    return stats
