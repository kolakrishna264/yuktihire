"""
Permission Engine — Feature gating by plan, promo code, and admin role.

Usage:
    from app.core.permissions import check_permission, require_permission, FEATURES

    # In endpoint:
    @router.get("/something")
    async def handler(user=Depends(get_current_user), db=Depends(get_db)):
        await require_permission(user, "can_tailor_resume", db)
        ...

    # Or check without raising:
    allowed = await check_permission(user, "can_tailor_resume", db)
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.models.user import User, Plan

# ── Feature Definitions ──────────────────────────────────────────────────
# Each feature has: default limits per plan, and whether it's a boolean or counter

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

    # Counter-based features (limits)
    "max_resumes":             {"FREE": 1,     "PROMO": 5,     "PRO": 10,    "TEAM": 50},
    "max_tailor_per_month":    {"FREE": 3,     "PROMO": 20,    "PRO": 999,   "TEAM": 999},
    "max_ai_answers_per_month":{"FREE": 10,    "PROMO": 100,   "PRO": 999,   "TEAM": 999},
    "max_exports_per_month":   {"FREE": 2,     "PROMO": 20,    "PRO": 999,   "TEAM": 999},
    "max_jobs_saved":          {"FREE": 25,    "PROMO": 200,   "PRO": 999,   "TEAM": 999},
    "max_ats_scans_per_month": {"FREE": 5,     "PROMO": 50,    "PRO": 999,   "TEAM": 999},
}


def get_user_plan(user: User) -> str:
    """Get effective plan, treating PRO_ANNUAL as PRO."""
    plan = user.plan.value if user.plan else "FREE"
    if plan == "PRO_ANNUAL":
        plan = "PRO"
    return plan


async def get_promo_plan(user_id: str, db: AsyncSession) -> str | None:
    """Check if user has redeemed a promo code and what plan it unlocks."""
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


async def check_permission(user: User, feature: str, db: AsyncSession) -> bool:
    """Check if user has access to a feature. Returns True/False."""
    if feature not in FEATURES:
        return True  # Unknown feature = allow

    # Admin always has access
    if await is_admin(user.id, db):
        return True

    # Get effective plan (user plan or promo-unlocked plan, whichever is higher)
    user_plan = get_user_plan(user)
    promo_plan = await get_promo_plan(user.id, db)

    # Use the higher plan
    plan_hierarchy = {"FREE": 0, "PROMO": 1, "PRO": 2, "TEAM": 3}
    effective_plan = user_plan
    if promo_plan and plan_hierarchy.get(promo_plan, 0) > plan_hierarchy.get(user_plan, 0):
        effective_plan = promo_plan

    limit = FEATURES[feature].get(effective_plan, FEATURES[feature].get("FREE"))

    if isinstance(limit, bool):
        return limit

    # For counter features, we'd check usage here
    # For now, return True if limit > 0
    return limit > 0


async def get_feature_limit(user: User, feature: str, db: AsyncSession) -> int:
    """Get the numeric limit for a counter feature."""
    if feature not in FEATURES:
        return 999

    if await is_admin(user.id, db):
        return 999

    user_plan = get_user_plan(user)
    promo_plan = await get_promo_plan(user.id, db)
    plan_hierarchy = {"FREE": 0, "PROMO": 1, "PRO": 2, "TEAM": 3}
    effective_plan = user_plan
    if promo_plan and plan_hierarchy.get(promo_plan, 0) > plan_hierarchy.get(user_plan, 0):
        effective_plan = promo_plan

    return FEATURES[feature].get(effective_plan, FEATURES[feature].get("FREE", 0))


async def require_permission(user: User, feature: str, db: AsyncSession):
    """Raise 403 if user doesn't have access to the feature."""
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
    """Check if user is within their usage limit. Returns {allowed, used, max, remaining}."""
    max_limit = await get_feature_limit(user, feature, db)

    # Map feature to usage column
    usage_col_map = {
        "max_tailor_per_month": "tailoring_used",
        "max_ats_scans_per_month": "ats_scans_used",
        "max_exports_per_month": "exports_used",
        "max_ai_answers_per_month": "ai_answers_used",
    }
    col = usage_col_map.get(feature)
    if not col:
        return {"allowed": True, "used": 0, "max": max_limit, "remaining": max_limit}

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
    }


async def increment_usage(user_id: str, feature: str, db: AsyncSession):
    """Increment a usage counter."""
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


async def is_admin(user_id: str, db: AsyncSession) -> bool:
    """Check if user is an admin."""
    try:
        result = await db.execute(
            text("SELECT role FROM users WHERE id = :uid"),
            {"uid": user_id},
        )
        row = result.first()
        return row and row[0] == "admin"
    except Exception:
        return False


async def get_user_permissions(user: User, db: AsyncSession) -> dict:
    """Get all permissions for a user — used by frontend to show/hide features."""
    admin = await is_admin(user.id, db)
    plan = get_user_plan(user)
    promo_plan = await get_promo_plan(user.id, db)
    plan_hierarchy = {"FREE": 0, "PROMO": 1, "PRO": 2, "TEAM": 3}
    effective_plan = plan
    if promo_plan and plan_hierarchy.get(promo_plan, 0) > plan_hierarchy.get(plan, 0):
        effective_plan = promo_plan

    perms = {}
    for feature, plans in FEATURES.items():
        value = plans.get(effective_plan, plans.get("FREE"))
        perms[feature] = value if not admin else (True if isinstance(value, bool) else 999)

    perms["isAdmin"] = admin
    perms["plan"] = plan
    perms["effectivePlan"] = effective_plan
    perms["hasPromo"] = promo_plan is not None

    return perms
