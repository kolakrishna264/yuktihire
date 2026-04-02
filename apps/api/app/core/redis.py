import json
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import get_settings

settings = get_settings()
_redis: Optional[aioredis.Redis] = None


async def get_redis() -> Optional[aioredis.Redis]:
    global _redis
    if _redis is None and settings.redis_url:
        _redis = await aioredis.from_url(
            settings.redis_url, encoding="utf-8", decode_responses=True,
        )
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    r = await get_redis()
    if r is None:
        return None
    value = await r.get(key)
    return json.loads(value) if value else None


async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    r = await get_redis()
    if r:
        await r.setex(key, ttl, json.dumps(value))


async def cache_delete(key: str) -> None:
    r = await get_redis()
    if r:
        await r.delete(key)


async def rate_limit_check(key: str, max_calls: int, window: int = 60) -> bool:
    r = await get_redis()
    if r is None:
        return True
    current = await r.incr(key)
    if current == 1:
        await r.expire(key, window)
    return current <= max_calls
