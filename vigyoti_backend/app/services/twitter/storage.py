from typing import Optional
from datetime import timedelta
import json
from ...core.cache import redis_client
from ...schemas.twitter_auth import TwitterAuthState

class TwitterAuthStorage:
    """Storage for Twitter OAuth2 state and PKCE verifier"""
    
    PREFIX = "twitter_auth:"
    STATE_TTL = 600  # 10 minutes in seconds
    
    @classmethod
    def _get_state_key(cls, state: str) -> str:
        """Get Redis key for state storage"""
        return f"{cls.PREFIX}state:{state}"
    
    @classmethod
    async def store_auth_state(cls, auth_state: TwitterAuthState) -> bool:
        """Store OAuth state and code verifier"""
        try:
            key = cls._get_state_key(auth_state.state)
            value = auth_state.model_dump_json()
            
            # Store in Redis with TTL
            await redis_client.setex(
                key,
                timedelta(seconds=cls.STATE_TTL),
                value
            )
            return True
        except Exception as e:
            logger.error(f"Error storing auth state: {str(e)}")
            return False
    
    @classmethod
    async def get_auth_state(cls, state: str) -> Optional[TwitterAuthState]:
        """Retrieve and delete stored auth state"""
        try:
            key = cls._get_state_key(state)
            value = await redis_client.get(key)
            
            if not value:
                return None
                
            # Delete after retrieval (one-time use)
            await redis_client.delete(key)
            
            # Parse stored JSON
            data = json.loads(value)
            return TwitterAuthState(**data)
            
        except Exception as e:
            logger.error(f"Error retrieving auth state: {str(e)}")
            return None 