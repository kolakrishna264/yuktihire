"""Preferences Router — Manage user job search preferences."""
import json
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.v2 import UserPreference

router = APIRouter(prefix="/preferences", tags=["preferences"])

# Application info field names (camelCase keys used by frontend/extension)
APP_INFO_KEYS = [
    "workAuthorization", "sponsorship", "gender", "pronouns",
    "veteranStatus", "disabilityStatus", "hispanicLatino", "race",
    "relocation", "earliestStart",
]


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
    # Application info fields (stored as JSON in application_data column)
    workAuthorization: Optional[str] = None
    sponsorship: Optional[str] = None
    gender: Optional[str] = None
    pronouns: Optional[str] = None
    veteranStatus: Optional[str] = None
    disabilityStatus: Optional[str] = None
    hispanicLatino: Optional[str] = None
    race: Optional[str] = None
    relocation: Optional[str] = None
    earliestStart: Optional[str] = None


def _parse_json_field(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


async def _ensure_application_data_column(db: AsyncSession):
    """Add application_data TEXT column if it doesn't exist yet."""
    try:
        await db.execute(text(
            "ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS application_data TEXT"
        ))
        await db.commit()
    except Exception:
        await db.rollback()


async def _get_application_data(db: AsyncSession, user_id: str) -> dict:
    """Read application_data JSON from user_preferences."""
    try:
        result = await db.execute(
            text("SELECT application_data FROM user_preferences WHERE user_id = :uid"),
            {"uid": user_id},
        )
        row = result.first()
        if row and row[0]:
            return json.loads(row[0])
    except Exception:
        pass
    return {}


async def _save_application_data(db: AsyncSession, user_id: str, app_data: dict):
    """Write application_data JSON to user_preferences."""
    try:
        json_str = json.dumps(app_data)
        await db.execute(
            text("UPDATE user_preferences SET application_data = :data WHERE user_id = :uid"),
            {"data": json_str, "uid": user_id},
        )
        await db.commit()
    except Exception as e:
        print(f"[Preferences] save application_data error: {e}")
        await db.rollback()


def _serialize(p: UserPreference, app_data: dict | None = None) -> dict:
    result = {
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
    if app_data:
        result["applicationInfo"] = app_data
    return result


@router.get("")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user preferences, auto-create if not exists."""
    await _ensure_application_data_column(db)

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

    app_data = await _get_application_data(db, current_user.id)
    return _serialize(pref, app_data)


@router.put("")
async def update_preferences(
    data: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user preferences (job search prefs + application info)."""
    await _ensure_application_data_column(db)

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

    # Handle application info fields — merge with existing
    app_info_payload = {}
    for key in APP_INFO_KEYS:
        val = getattr(data, key, None)
        if val is not None:
            app_info_payload[key] = val

    app_data = {}
    if app_info_payload:
        app_data = await _get_application_data(db, current_user.id)
        app_data.update(app_info_payload)
        await _save_application_data(db, current_user.id, app_data)
    else:
        app_data = await _get_application_data(db, current_user.id)

    return _serialize(pref, app_data)
