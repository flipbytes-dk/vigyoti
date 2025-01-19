from typing import Optional
from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from .db import TwitterCredentialsService
from .auth import refresh_twitter_token
from ...schemas.twitter_auth import TwitterTokens
import logging

logger = logging.getLogger(__name__)

async def get_twitter_credentials(request: Request) -> Optional[dict]:
    """Get and refresh Twitter credentials if needed"""
    try:
        # Get current user from request state (set by auth middleware)
        user = getattr(request.state, "user", None)
        if not user:
            return None
            
        # Get database session
        db: AsyncSession = request.state.db
        
        # Get credentials service
        credentials_service = TwitterCredentialsService(db)
        credentials = await credentials_service.get_credentials(user.id)
        
        if not credentials:
            return None
            
        # Check if token is expired
        if credentials.is_token_expired():
            try:
                # Refresh token
                new_tokens = await refresh_twitter_token(credentials.refresh_token)
                tokens = TwitterTokens.from_response(new_tokens)
                
                # Update credentials in database
                credentials.access_token = tokens.access_token
                credentials.refresh_token = tokens.refresh_token
                credentials.expires_at = tokens.expires_at
                await db.commit()
                
                logger.info(f"Refreshed Twitter tokens for user {user.id}")
                
            except Exception as e:
                logger.error(f"Failed to refresh Twitter tokens: {str(e)}")
                # Delete invalid credentials
                await credentials_service.delete_credentials(user.id)
                return None
        
        return {
            "access_token": credentials.access_token,
            "token_type": credentials.token_type
        }
        
    except Exception as e:
        logger.error(f"Error in Twitter credentials middleware: {str(e)}")
        return None

async def require_twitter_auth(request: Request) -> dict:
    """Middleware to require valid Twitter authentication"""
    credentials = await get_twitter_credentials(request)
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Twitter authentication required"
        )
    return credentials 