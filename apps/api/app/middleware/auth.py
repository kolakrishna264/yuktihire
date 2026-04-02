from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
import httpx

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
DEV_USER_EMAIL = "dev@resumeai.local"

_jwks_cache = None


async def _get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
                    timeout=5.0,
                )
                _jwks_cache = resp.json().get("keys", [])
        except Exception as e:
            print(f"Failed to fetch JWKS: {e}")
            _jwks_cache = []
    return _jwks_cache


def _decode_with_secret(token: str) -> dict | None:
    """Try legacy HS256 verification."""
    if not settings.supabase_jwt_secret:
        return None
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        return None


async def _decode_with_jwks(token: str) -> dict | None:
    """Try ES256/RS256 verification using Supabase JWKS."""
    keys = await _get_jwks()
    for key in keys:
        try:
            return jwt.decode(
                token,
                key,
                algorithms=["ES256", "RS256"],
                options={"verify_aud": False},
            )
        except JWTError:
            continue
    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Dev-mode bypass
    if not settings.supabase_jwt_secret and not settings.is_production:
        return await _get_or_create_user(DEV_USER_ID, DEV_USER_EMAIL, db)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    token = credentials.credentials

    # Try HS256 first (legacy), then ES256 (new Supabase default)
    payload = _decode_with_secret(token)
    if payload is None:
        payload = await _decode_with_jwks(token)

    if payload is None:
        print("JWT verification failed with both HS256 and JWKS")
        raise credentials_exception

    user_id: str = payload.get("sub")
    email: str = payload.get("email", "")
    if not user_id:
        raise credentials_exception

    return await _get_or_create_user(user_id, email, db)


async def _get_or_create_user(user_id: str, email: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        from app.models.profile import Profile
        from app.models.billing import UsageLimit, Subscription
        from datetime import datetime, timedelta

        user = User(id=user_id, email=email)
        db.add(user)
        db.add(Profile(user_id=user_id))
        db.add(UsageLimit(user_id=user_id, period_end=datetime.utcnow() + timedelta(days=30)))
        db.add(Subscription(user_id=user_id))
        await db.flush()

    return user


CurrentUser = User
