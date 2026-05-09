import json
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

# Try to import redis, fall back to in-memory mock
try:
    import redis
    _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
    _redis_client.ping()
    REDIS_AVAILABLE = True
    logger.info("Redis connected successfully")
except Exception as e:
    REDIS_AVAILABLE = False
    _redis_client = None
    logger.warning(f"Redis not available, using in-memory fallback: {e}")

# In-memory fallback store
_memory_store: dict = {}


class RedisService:
    """Redis service with in-memory fallback for BOM locking and caching."""

    def set(self, key: str, value: str, ttl: int = None) -> bool:
        try:
            if REDIS_AVAILABLE:
                if ttl:
                    return _redis_client.setex(key, ttl, value)
                return _redis_client.set(key, value)
            else:
                import time
                _memory_store[key] = {"value": value, "expires": time.time() + ttl if ttl else None}
                return True
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False

    def get(self, key: str) -> Optional[str]:
        try:
            if REDIS_AVAILABLE:
                return _redis_client.get(key)
            else:
                import time
                entry = _memory_store.get(key)
                if entry is None:
                    return None
                if entry["expires"] and time.time() > entry["expires"]:
                    del _memory_store[key]
                    return None
                return entry["value"]
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None

    def delete(self, key: str) -> bool:
        try:
            if REDIS_AVAILABLE:
                return bool(_redis_client.delete(key))
            else:
                return bool(_memory_store.pop(key, None))
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False

    def exists(self, key: str) -> bool:
        try:
            if REDIS_AVAILABLE:
                return bool(_redis_client.exists(key))
            else:
                return self.get(key) is not None
        except Exception as e:
            logger.error(f"Redis EXISTS error: {e}")
            return False

    # BOM Locking
    def acquire_bom_lock(self, bom_item_id: int, user: str, ttl: int = None) -> bool:
        key = f"bom:lock:{bom_item_id}"
        ttl = ttl or settings.REDIS_BOM_LOCK_TTL
        if self.exists(key):
            existing = self.get_bom_lock(bom_item_id)
            if existing and existing.get("user") != user:
                return False
        lock_data = json.dumps({"user": user, "bom_item_id": bom_item_id})
        return self.set(key, lock_data, ttl=ttl)

    def release_bom_lock(self, bom_item_id: int, user: str) -> bool:
        key = f"bom:lock:{bom_item_id}"
        existing = self.get_bom_lock(bom_item_id)
        if existing and existing.get("user") != user:
            return False  # Can't release someone else's lock
        return self.delete(key)

    def get_bom_lock(self, bom_item_id: int) -> Optional[dict]:
        key = f"bom:lock:{bom_item_id}"
        data = self.get(key)
        if data:
            try:
                return json.loads(data)
            except Exception:
                return None
        return None

    def force_release_bom_lock(self, bom_item_id: int) -> bool:
        key = f"bom:lock:{bom_item_id}"
        return self.delete(key)

    # Session / Cache
    def cache_set(self, key: str, data: dict, ttl: int = 60) -> bool:
        return self.set(f"cache:{key}", json.dumps(data), ttl=ttl)

    def cache_get(self, key: str) -> Optional[dict]:
        data = self.get(f"cache:{key}")
        if data:
            try:
                return json.loads(data)
            except Exception:
                return None
        return None

    def cache_invalidate(self, pattern: str) -> None:
        if REDIS_AVAILABLE:
            try:
                keys = _redis_client.keys(f"cache:{pattern}*")
                if keys:
                    _redis_client.delete(*keys)
            except Exception as e:
                logger.error(f"Cache invalidate error: {e}")
        else:
            keys_to_delete = [k for k in _memory_store if k.startswith(f"cache:{pattern}")]
            for k in keys_to_delete:
                del _memory_store[k]


redis_service = RedisService()
