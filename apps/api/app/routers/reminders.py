"""Reminders Router — Manage follow-up reminders for job applications."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.v2 import Reminder

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderCreate(BaseModel):
    application_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    remind_at: str  # ISO datetime string


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    remind_at: Optional[str] = None


def _serialize(r: Reminder) -> dict:
    return {
        "id": r.id,
        "applicationId": r.application_id,
        "title": r.title,
        "description": r.description,
        "remindAt": r.remind_at.isoformat() if r.remind_at else None,
        "isCompleted": r.is_completed,
        "completedAt": r.completed_at.isoformat() if r.completed_at else None,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("")
async def list_reminders(
    application_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all reminders for user, optionally filtered by application_id."""
    query = select(Reminder).where(Reminder.user_id == current_user.id)
    if application_id:
        query = query.where(Reminder.application_id == application_id)
    query = query.order_by(Reminder.remind_at.desc())

    result = await db.execute(query)
    reminders = result.scalars().all()
    return [_serialize(r) for r in reminders]


@router.get("/upcoming")
async def upcoming_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pending reminders where remind_at > now, ordered by soonest."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Reminder).where(
            Reminder.user_id == current_user.id,
            Reminder.is_completed == False,
            Reminder.remind_at > now,
        ).order_by(Reminder.remind_at.asc())
    )
    reminders = result.scalars().all()
    return [_serialize(r) for r in reminders]


@router.post("")
async def create_reminder(
    data: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new reminder."""
    try:
        remind_at = datetime.fromisoformat(data.remind_at)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid remind_at datetime format")

    reminder = Reminder(
        user_id=current_user.id,
        application_id=data.application_id,
        title=data.title,
        description=data.description,
        remind_at=remind_at,
    )
    db.add(reminder)
    await db.flush()
    await db.commit()
    await db.refresh(reminder)
    return _serialize(reminder)


@router.patch("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    data: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a reminder."""
    result = await db.execute(
        select(Reminder).where(
            Reminder.id == reminder_id,
            Reminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if data.title is not None:
        reminder.title = data.title
    if data.description is not None:
        reminder.description = data.description
    if data.remind_at is not None:
        try:
            reminder.remind_at = datetime.fromisoformat(data.remind_at)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid remind_at datetime format")

    await db.flush()
    await db.commit()
    await db.refresh(reminder)
    return _serialize(reminder)


@router.post("/{reminder_id}/complete")
async def complete_reminder(
    reminder_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a reminder as completed."""
    result = await db.execute(
        select(Reminder).where(
            Reminder.id == reminder_id,
            Reminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    reminder.is_completed = True
    reminder.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.commit()
    await db.refresh(reminder)
    return _serialize(reminder)


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a reminder."""
    result = await db.execute(
        select(Reminder).where(
            Reminder.id == reminder_id,
            Reminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    await db.delete(reminder)
    await db.commit()
