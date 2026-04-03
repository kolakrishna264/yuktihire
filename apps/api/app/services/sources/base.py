from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import hashlib


@dataclass
class NormalizedJob:
    title: str
    company: str
    location: str
    url: Optional[str] = None
    description_text: Optional[str] = None
    salary_raw: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    work_type: Optional[str] = None
    employment_type: Optional[str] = None
    experience_level: Optional[str] = None
    industry: Optional[str] = None
    posted_at: Optional[datetime] = None
    company_logo_url: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    external_id: str = ""
    source_url: Optional[str] = None
    raw_data: dict = field(default_factory=dict)


def compute_fingerprint(company: str, title: str, location: str) -> str:
    normalized = f"{company.lower().strip()}|{title.lower().strip()}|{location.lower().strip()}"
    return hashlib.sha256(normalized.encode()).hexdigest()


def _guess_level(title: str) -> str:
    t = title.lower()
    if any(w in t for w in ("senior", "sr.", "lead", "principal", "staff")):
        return "5+ years"
    if any(w in t for w in ("junior", "jr.", "entry", "intern")):
        return "0-2 years"
    if any(w in t for w in ("mid", " ii")):
        return "3-5 years"
    return "1+ years"


class BaseSourceAdapter(ABC):
    slug: str
    name: str

    @abstractmethod
    async def fetch_jobs(self, search: str | None = None) -> list[NormalizedJob]:
        ...
