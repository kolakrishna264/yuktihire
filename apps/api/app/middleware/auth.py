from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
DEV_USER_EMAIL = "dev@resumeai.local"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Dev-mode bypass: if no JWT secret configured, use a fixed dev user
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
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub")
        email: str = payload.get("email", "")
        if not user_id:
            raise credentials_exception
    except JWTError as e:
        print(f"JWT decode error: {e}")
        print(f"JWT secret configured: {bool(settings.supabase_jwt_secret)}")
        print(f"JWT secret length: {len(settings.supabase_jwt_secret) if settings.supabase_jwt_secret else 0}")
        raise credentials_exception

    return await _get_or_create_user(user_id, email, db)


async def _get_or_create_user(user_id: str, email: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Auto-create on first API call
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


# Type alias for dependency injection
CurrentUser = User
