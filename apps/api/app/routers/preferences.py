"""Preferences Router — Manage user job search preferences."""
import json
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.v2 import UserPreference

router = APIRouter(prefix="/preferences", tags=["preferences"])


class PreferencesUpdate(BaseModel):
    preferred_titles: Optional[list[str]] = None
    preferred_locations: Optional[list[str]] = None
    preferred_work_types: Optional[list[str]] = None
    preferred_industries: Optional[list[str]] = None
    preferred_skills: Optional[list[str]] = None
    min_salary: Optional[int] = None
    max_salary: Optional[int] = None
    experience_level: Optional[str] = None
    visa_sponsorship: Optional[bool] = None


def _parse_json_field(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def _serialize(p: UserPreference) -> dict:
    return {
        "preferredTitles": _parse_json_field(p.preferred_titles),
        "preferredLocations": _parse_json_field(p.preferred_locations),
        "preferredWorkTypes": _parse_json_field(p.preferred_work_types),
        "preferredIndustries": _parse_json_field(p.preferred_industries),
        "preferredSkills": _parse_json_field(p.preferred_skills),
        "minSalary": p.min_salary,
        "maxSalary": p.max_salary,
        "experienceLevel": p.experience_level,
        "visaSponsorship": p.visa_sponsorship,
    }


@router.get("")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user preferences, auto-create if not exists."""
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
        await db.flush()
        await db.commit()
        await db.refresh(pref)

    return _serialize(pref)


@router.put("")
async def update_preferences(
    data: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user preferences."""
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()

    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
        await db.flush()

    # Update array fields as JSON strings
    if data.preferred_titles is not None:
        pref.preferred_titles = json.dumps(data.preferred_titles)
    if data.preferred_locations is not None:
        pref.preferred_locations = json.dumps(data.preferred_locations)
    if data.preferred_work_types is not None:
        pref.preferred_work_types = json.dumps(data.preferred_work_types)
    if data.preferred_industries is not None:
        pref.preferred_industries = json.dumps(data.preferred_industries)
    if data.preferred_skills is not None:
        pref.preferred_skills = json.dumps(data.preferred_skills)

    # Update scalar fields
    if data.min_salary is not None:
        pref.min_salary = data.min_salary
    if data.max_salary is not None:
        pref.max_salary = data.max_salary
    if data.experience_level is not None:
        pref.experience_level = data.experience_level
    if data.visa_sponsorship is not None:
        pref.visa_sponsorship = data.visa_sponsorship

    await db.flush()
    await db.commit()
    await db.refresh(pref)
    return _serialize(pref)
