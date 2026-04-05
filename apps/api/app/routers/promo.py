"""Promo Code System — Create, manage, and redeem promo/invite codes."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.core.permissions import is_admin

router = APIRouter(prefix="/promo", tags=["promo"])


class PromoCreate(BaseModel):
    code: str
    unlocks_plan: str = "PROMO"  # PROMO, PRO, TEAM
    max_uses: int = 100
    expires_at: Optional[str] = None  # ISO date
    features_json: Optional[str] = None  # JSON override of specific features
    note: Optional[str] = None


class PromoRedeem(BaseModel):
    code: str


# ── Admin: Create promo code ────────────────────────────────────────────

@router.post("/create")
async def create_promo(
    data: PromoCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    code_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires = None
    if data.expires_at:
        try:
            expires = datetime.fromisoformat(data.expires_at)
        except ValueError:
            raise HTTPException(400, "Invalid expires_at format")

    try:
        await db.execute(
            text("""
                INSERT INTO promo_codes (id, code, unlocks_plan, max_uses, uses_consumed,
                    is_active, expires_at, features_json, note, created_by, created_at)
                VALUES (:id, :code, :plan, :max_uses, 0, true, :expires, :features, :note, :created_by, :now)
            """),
            {
                "id": code_id, "code": data.code.strip().upper(),
                "plan": data.unlocks_plan, "max_uses": data.max_uses,
                "expires": expires, "features": data.features_json,
                "note": data.note, "created_by": current_user.id, "now": now,
            },
        )
        await db.commit()
        return {"id": code_id, "code": data.code.strip().upper(), "status": "created"}
    except Exception as e:
        await db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, "Code already exists")
        raise HTTPException(500, str(e))


# ── Admin: List promo codes ─────────────────────────────────────────────

@router.get("/list")
async def list_promos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    result = await db.execute(
        text("SELECT * FROM promo_codes ORDER BY created_at DESC")
    )
    rows = result.mappings().all()
    return [
        {
            "id": r.get("id"),
            "code": r.get("code"),
            "unlocksplan": r.get("unlocks_plan"),
            "maxUses": r.get("max_uses"),
            "usesConsumed": r.get("uses_consumed", 0),
            "isActive": r.get("is_active"),
            "expiresAt": r["expires_at"].isoformat() if r.get("expires_at") else None,
            "note": r.get("note"),
            "createdAt": r["created_at"].isoformat() if r.get("created_at") else None,
        }
        for r in rows
    ]


# ── Admin: Toggle promo code active/inactive ─────────────────────────────

@router.patch("/{code_id}/toggle")
async def toggle_promo(
    code_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    await db.execute(
        text("UPDATE promo_codes SET is_active = NOT is_active WHERE id = :id"),
        {"id": code_id},
    )
    await db.commit()
    return {"status": "toggled"}


# ── Admin: Get redemption history ────────────────────────────────────────

@router.get("/{code_id}/redemptions")
async def get_redemptions(
    code_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await is_admin(current_user.id, db):
        raise HTTPException(403, "Admin only")

    result = await db.execute(
        text("""
            SELECT pr.*, u.email, u.full_name FROM promo_redemptions pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.code_id = :cid ORDER BY pr.redeemed_at DESC
        """),
        {"cid": code_id},
    )
    rows = result.mappings().all()
    return [
        {
            "userId": r.get("user_id"),
            "email": r.get("email"),
            "name": r.get("full_name"),
            "redeemedAt": r["redeemed_at"].isoformat() if r.get("redeemed_at") else None,
        }
        for r in rows
    ]


# ── User: Redeem promo code ─────────────────────────────────────────────

@router.post("/redeem")
async def redeem_promo(
    data: PromoRedeem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = data.code.strip().upper()
    now = datetime.now(timezone.utc)

    # Find the code
    result = await db.execute(
        text("SELECT * FROM promo_codes WHERE code = :code"),
        {"code": code},
    )
    promo = result.mappings().first()
    if not promo:
        raise HTTPException(404, "Invalid promo code")
    if not promo.get("is_active"):
        raise HTTPException(400, "This code is no longer active")
    if promo.get("expires_at") and promo["expires_at"] < now:
        raise HTTPException(400, "This code has expired")
    if promo.get("uses_consumed", 0) >= promo.get("max_uses", 0):
        raise HTTPException(400, "This code has reached its usage limit")

    # Check if already redeemed
    existing = await db.execute(
        text("SELECT id FROM promo_redemptions WHERE user_id = :uid AND code_id = :cid"),
        {"uid": current_user.id, "cid": promo["id"]},
    )
    if existing.first():
        raise HTTPException(409, "You already redeemed this code")

    # Redeem
    redemption_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO promo_redemptions (id, user_id, code_id, redeemed_at)
            VALUES (:id, :uid, :cid, :now)
        """),
        {"id": redemption_id, "uid": current_user.id, "cid": promo["id"], "now": now},
    )
    await db.execute(
        text("UPDATE promo_codes SET uses_consumed = uses_consumed + 1 WHERE id = :id"),
        {"id": promo["id"]},
    )

    # Upgrade usage limits
    unlocks = promo.get("unlocks_plan", "PROMO")
    from app.core.permissions import FEATURES
    new_limits = {
        "tailoring_max": FEATURES["max_tailor_per_month"].get(unlocks, 20),
        "ats_scans_max": FEATURES["max_ats_scans_per_month"].get(unlocks, 50),
        "exports_max": FEATURES["max_exports_per_month"].get(unlocks, 20),
        "resumes_max": FEATURES["max_resumes"].get(unlocks, 5),
    }
    await db.execute(
        text("""
            UPDATE usage_limits SET
                tailoring_max = GREATEST(tailoring_max, :t_max),
                ats_scans_max = GREATEST(ats_scans_max, :a_max),
                exports_max = GREATEST(exports_max, :e_max),
                resumes_max = GREATEST(resumes_max, :r_max)
            WHERE user_id = :uid
        """),
        {"uid": current_user.id, "t_max": new_limits["tailoring_max"],
         "a_max": new_limits["ats_scans_max"], "e_max": new_limits["exports_max"],
         "r_max": new_limits["resumes_max"]},
    )
    await db.commit()

    return {
        "status": "redeemed",
        "unlockedPlan": unlocks,
        "message": f"Code applied! You now have {unlocks} access.",
    }
