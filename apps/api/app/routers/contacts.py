"""Contacts Router — Manage networking contacts for job applications."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.v2 import Contact

router = APIRouter(prefix="/contacts", tags=["contacts"])


class ContactCreate(BaseModel):
    application_id: Optional[str] = None
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None


def _serialize(c: Contact) -> dict:
    return {
        "id": c.id,
        "applicationId": c.application_id,
        "name": c.name,
        "role": c.role,
        "email": c.email,
        "phone": c.phone,
        "linkedinUrl": c.linkedin_url,
        "company": c.company,
        "notes": c.notes,
        "createdAt": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("")
async def list_contacts(
    application_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all contacts for user, optionally filtered by application_id."""
    query = select(Contact).where(Contact.user_id == current_user.id)
    if application_id:
        query = query.where(Contact.application_id == application_id)
    query = query.order_by(Contact.created_at.desc())

    result = await db.execute(query)
    contacts = result.scalars().all()
    return [_serialize(c) for c in contacts]


@router.post("")
async def create_contact(
    data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new contact."""
    contact = Contact(
        user_id=current_user.id,
        application_id=data.application_id,
        name=data.name,
        role=data.role,
        email=data.email,
        phone=data.phone,
        linkedin_url=data.linkedin_url,
        company=data.company,
        notes=data.notes,
    )
    db.add(contact)
    await db.flush()
    await db.commit()
    await db.refresh(contact)
    return _serialize(contact)


@router.patch("/{contact_id}")
async def update_contact(
    contact_id: str,
    data: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing contact."""
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.user_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    payload = data.model_dump(exclude_none=True)
    for field, value in payload.items():
        setattr(contact, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(contact)
    return _serialize(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a contact."""
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.user_id == current_user.id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()


@router.get("/for-application/{app_id}")
async def contacts_for_application(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all contacts linked to a specific application."""
    result = await db.execute(
        select(Contact).where(
            Contact.user_id == current_user.id,
            Contact.application_id == app_id,
        ).order_by(Contact.created_at.desc())
    )
    contacts = result.scalars().all()
    return [_serialize(c) for c in contacts]
