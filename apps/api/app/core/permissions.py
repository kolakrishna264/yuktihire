"""
Permission Engine — Feature gating by plan, promo code, and admin role.

Plans: FREE → PROMO → PRO (unlimited) → TEAM (unlimited)
Admin: support@yuktihire.com → role=admin → unlimited everything
PRO/TEAM: None = unlimited (no limits enforced)

Usage:
    await require_permission(user, "can_tailor_resume", db)
    allowed = await check_permission(user, "can_export_docx", db)
    usage = await check_usage_limit(user, "max_tailor_per_month", db)
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models.user import User, Plan

# Admin email — this account auto-gets admin role
ADMIN_EMAIL = "support@yuktihire.com"

# ── Feature Definitions ──────────────────────────────────────────────────
# None = unlimited (no limit enforced)

FEATURES = {
    # Boolean features
    "can_upload_resume":       {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_tailor_resume":       {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_autofill":        {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_generate_ai_answers": {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_export_pdf":          {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_export_docx":         {"FREE": False, "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_interview_prep":  {"FREE": False, "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_company_intel":   {"FREE": False, "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_outreach":        {"FREE": False, "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_cover_letter":    {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_apply_copilot":   {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_job_feed":        {"FREE": True,  "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_resume_versions": {"FREE": False, "PROMO": True,  "PRO": True,  "TEAM": True},
    "can_use_auto_tailor":     {"FREE": False, "PROMO": True,  "PRO": True,  "TEAM": True},

    # Counter-based features — None = unlimited
    "max_resumes":             {"FREE": 1,     "PROMO": 5,     "PRO": None,  "TEAM": None},
    "max_tailor_per_month":    {"FREE": 3,     "PROMO": 20,    "PRO": None,  "TEAM": None},
    "max_ai_answers_per_month":{"FREE": 10,    "PROMO": 100,   "PRO": None,  "TEAM": None},
    "max_exports_per_month":   {"FREE": 2,     "PROMO": 20,    "PRO": None,  "TEAM": None},
    "max_jobs_saved":          {"FREE": 25,    "PROMO": 200,   "PRO": None,  "TEAM": None},
    "max_ats_scans_per_month": {"FREE": 5,     "PROMO": 50,    "PRO": None,  "TEAM": None},
}


def get_user_plan(user: User) -> str:
    plan = user.plan.value if user.plan else "FREE"
    if plan == "PRO_ANNUAL":
        plan = "PRO"
    return plan


async def get_promo_plan(user_id: str, db: AsyncSession) -> str | None:
    try:
        result = await db.execute(
            text("""
                SELECT pc.unlocks_plan FROM promo_redemptions pr
                JOIN promo_codes pc ON pr.code_id = pc.id
                WHERE pr.user_id = :uid AND pc.is_active = true
                ORDER BY pr.redeemed_at DESC LIMIT 1
            """),
            {"uid": user_id},
        )
        row = result.first()
        return row[0] if row else None
    except Exception:
        return None


def _is_unlimited(limit) -> bool:
    """Check if a limit value means unlimited."""
    return limit is None


async def is_admin(user_id: str, db: AsyncSession) -> bool:
    """Check if user is an admin (by role column or by admin email)."""
    try:
        result = await db.execute(
            text("SELECT role, email FROM users WHERE id = :uid"),
            {"uid": user_id},
        )
        row = result.first()
        if not row:
            return False
        return row[0] == "admin" or (row[1] and row[1].lower() == ADMIN_EMAIL)
    except Exception:
        return False


async def ensure_admin_role(db: AsyncSession):
    """Auto-set admin role for the admin email on startup/login."""
    try:
        await db.execute(
            text("UPDATE users SET role = 'admin' WHERE LOWER(email) = :email AND (role IS NULL OR role != 'admin')"),
            {"email": ADMIN_EMAIL},
        )
        await db.commit()
    except Exception:
        pass


def _get_effective_plan(user_plan: str, promo_plan: str | None) -> str:
    plan_hierarchy = {"FREE": 0, "PROMO": 1, "PRO": 2, "TEAM": 3}
    effective = user_plan
    if promo_plan and plan_hierarchy.get(promo_plan, 0) > plan_hierarchy.get(user_plan, 0):
        effective = promo_plan
    return effective


async def check_permission(user: User, feature: str, db: AsyncSession) -> bool:
    if feature not in FEATURES:
        return True

    # Admin = unlimited
    if await is_admin(user.id, db):
        return True

    user_plan = get_user_plan(user)
    promo_plan = await get_promo_plan(user.id, db)
    effective_plan = _get_effective_plan(user_plan, promo_plan)

    limit = FEATURES[feature].get(effective_plan, FEATURES[feature].get("FREE"))

    # None = unlimited = allowed
    if _is_unlimited(limit):
        return True
    if isinstance(limit, bool):
        return limit
    return limit > 0


async def get_feature_limit(user: User, feature: str, db: AsyncSession) -> int | None:
    """Get numeric limit. Returns None for unlimited."""
    if feature not in FEATURES:
        return None

    if await is_admin(user.id, db):
        return None  # Admin = unlimited

    user_plan = get_user_plan(user)
    promo_plan = await get_promo_plan(user.id, db)
    effective_plan = _get_effective_plan(user_plan, promo_plan)

    return FEATURES[feature].get(effective_plan, FEATURES[feature].get("FREE", 0))


async def require_permission(user: User, feature: str, db: AsyncSession):
    allowed = await check_permission(user, feature, db)
    if not allowed:
        plan = get_user_plan(user)
        raise HTTPException(
            status_code=403,
            detail={
                "message": f"This feature requires an upgrade from {plan} plan",
                "feature": feature,
                "currentPlan": plan,
                "upgradeRequired": True,
            }
        )


async def check_usage_limit(user: User, feature: str, db: AsyncSession) -> dict:
    """Returns {allowed, used, max, remaining, unlimited}."""
    max_limit = await get_feature_limit(user, feature, db)

    # Unlimited = always allowed
    if _is_unlimited(max_limit):
        return {"allowed": True, "used": 0, "max": None, "remaining": None, "unlimited": True}

    usage_col_map = {
        "max_tailor_per_month": "tailoring_used",
        "max_ats_scans_per_month": "ats_scans_used",
        "max_exports_per_month": "exports_used",
        "max_ai_answers_per_month": "ai_answers_used",
    }
    col = usage_col_map.get(feature)
    if not col:
        return {"allowed": True, "used": 0, "max": max_limit, "remaining": max_limit, "unlimited": False}

    try:
        result = await db.execute(
            text(f"SELECT {col} FROM usage_limits WHERE user_id = :uid"),
            {"uid": user.id},
        )
        row = result.first()
        used = row[0] if row else 0
    except Exception:
        used = 0

    return {
        "allowed": used < max_limit,
        "used": used,
        "max": max_limit,
        "remaining": max(0, max_limit - used),
        "unlimited": False,
    }


async def increment_usage(user_id: str, feature: str, db: AsyncSession):
    usage_col_map = {
        "max_tailor_per_month": "tailoring_used",
        "max_ats_scans_per_month": "ats_scans_used",
        "max_exports_per_month": "exports_used",
        "max_ai_answers_per_month": "ai_answers_used",
    }
    col = usage_col_map.get(feature)
    if not col:
        return
    try:
        await db.execute(
            text(f"UPDATE usage_limits SET {col} = {col} + 1 WHERE user_id = :uid"),
            {"uid": user_id},
        )
    except Exception:
        pass


async def get_user_permissions(user: User, db: AsyncSession) -> dict:
    """Get all permissions for frontend. None values = unlimited."""
    admin = await is_admin(user.id, db)
    plan = get_user_plan(user)
    promo_plan = await get_promo_plan(user.id, db)
    effective_plan = _get_effective_plan(plan, promo_plan)

    perms = {}
    for feature, plans in FEATURES.items():
        if admin:
            perms[feature] = True if isinstance(plans.get("PRO"), bool) or plans.get("PRO") is True else None
        else:
            value = plans.get(effective_plan, plans.get("FREE"))
            perms[feature] = value

    perms["isAdmin"] = admin
    perms["plan"] = plan
    perms["effectivePlan"] = effective_plan
    perms["hasPromo"] = promo_plan is not None
    perms["isUnlimited"] = admin or effective_plan in ("PRO", "TEAM")

    return perms
