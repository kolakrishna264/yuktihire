"""
Rate limiting middleware using Redis (with in-memory fallback).

Limits:
  - Per-user rate limits on AI-heavy endpoints
  - Per-IP rate limits on auth endpoints
  - Admin bypasses business limits but keeps safety limits

Usage:
    from app.core.rate_limiter import rate_limit

    @router.post("/generate")
    async def handler(request: Request, user=Depends(get_current_user), db=Depends(get_db)):
        await rate_limit(request, user, "ai_generate", db)
        ...
"""
from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.core.logger import log
from app.core.permissions import is_admin

# Rate limit tiers: requests per minute
RATE_LIMITS = {
    # endpoint_key: { plan: requests_per_minute }
    "ai_generate":    {"FREE": 5,   "PROMO": 15,  "PRO": 60,  "admin": 120},
    "ai_tailor":      {"FREE": 2,   "PROMO": 10,  "PRO": 30,  "admin": 60},
    "ai_cover":       {"FREE": 2,   "PROMO": 10,  "PRO": 30,  "admin": 60},
    "ai_intel":       {"FREE": 2,   "PROMO": 5,   "PRO": 20,  "admin": 60},
    "auth":           {"FREE": 10,  "PROMO": 10,  "PRO": 10,  "admin": 30},
    "promo_redeem":   {"FREE": 3,   "PROMO": 3,   "PRO": 3,   "admin": 10},
    "export":         {"FREE": 5,   "PROMO": 20,  "PRO": 60,  "admin": 120},
    "default":        {"FREE": 30,  "PROMO": 60,  "PRO": 120, "admin": 300},
}

# In-memory fallback when Redis is unavailable
_memory_store: dict = {}  # key → { count, window_start }
WINDOW_SECONDS = 60


async def rate_limit(
    request: Request,
    user,
    endpoint_key: str = "default",
    db: AsyncSession = None,
):
    """Check rate limit. Raises 429 if exceeded."""
    from app.models.user import Plan

    # Get user plan
    plan = "FREE"
    if user:
        plan = user.plan.value if user.plan else "FREE"
        if plan == "PRO_ANNUAL":
            plan = "PRO"
        if db and await is_admin(user.id, db):
            plan = "admin"

    # Get limit for this endpoint + plan
    limits = RATE_LIMITS.get(endpoint_key, RATE_LIMITS["default"])
    max_requests = limits.get(plan, limits.get("FREE", 30))

    # Build rate limit key
    user_id = user.id if user else None
    ip = request.client.host if request.client else "unknown"
    key = f"rl:{endpoint_key}:{user_id or ip}"

    # Try Redis first, fall back to memory
    allowed = await _check_redis(key, max_requests)
    if allowed is None:
        allowed = _check_memory(key, max_requests)

    if not allowed:
        log.warning("rate_limit_exceeded",
            user_id=user_id, ip=ip, endpoint=endpoint_key,
            plan=plan, limit=max_requests,
        )
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Rate limit exceeded. Please try again in a minute.",
                "retryAfter": WINDOW_SECONDS,
                "limit": max_requests,
            },
        )


async def _check_redis(key: str, max_requests: int) -> bool | None:
    """Check rate limit using Redis. Returns None if Redis unavailable."""
    try:
        from app.core.queue import get_redis
        redis = await get_redis()
        if not redis:
            return None

        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, WINDOW_SECONDS)
        results = await pipe.execute()
        count = results[0]
        return count <= max_requests
    except Exception:
        return None


def _check_memory(key: str, max_requests: int) -> bool:
    """In-memory rate limit fallback."""
    now = datetime.now(timezone.utc).timestamp()

    if key in _memory_store:
        entry = _memory_store[key]
        if now - entry["window_start"] > WINDOW_SECONDS:
            _memory_store[key] = {"count": 1, "window_start": now}
            return True
        entry["count"] += 1
        return entry["count"] <= max_requests
    else:
        _memory_store[key] = {"count": 1, "window_start": now}
        return True
