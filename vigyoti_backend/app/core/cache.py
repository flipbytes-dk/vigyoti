import json
from typing import Optional, Any
import redis
from app.core.config import settings as config_settings

# Initialize Redis connection
redis_client = redis.Redis(
    host=config_settings.REDIS_HOST,
    port=config_settings.REDIS_PORT,
    db=config_settings.REDIS_DB,
    password=config_settings.REDIS_PASSWORD,
    decode_responses=True
)

def get_cache_key(prefix: str, identifier: str) -> str:
    """Generate a cache key with a prefix"""
    return f"{prefix}:{identifier}"

def get_cached_data(key: str) -> Optional[dict]:
    """Retrieve data from cache"""
    try:
        data = redis_client.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        print(f"Cache retrieval error: {str(e)}")
        return None

def set_cached_data(key: str, data: Any, ttl: int = config_settings.CACHE_TTL) -> bool:
    """Store data in cache with TTL"""
    try:
        redis_client.setex(key, ttl, json.dumps(data))
        return True
    except Exception as e:
        print(f"Cache storage error: {str(e)}")
        return False
