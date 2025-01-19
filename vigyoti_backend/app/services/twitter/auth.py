from typing import Dict, Optional
import httpx
from ...core.config import settings
from ...core.exceptions import AuthenticationError
from ...schemas.twitter_auth import TwitterTokens
import logging

logger = logging.getLogger(__name__)

async def generate_twitter_oauth_url(state: str) -> str:
    """Generate Twitter OAuth2 URL with PKCE"""
    try:
        auth_url = "https://twitter.com/i/oauth2/authorize"
        params = {
            "response_type": "code",
            "client_id": settings.TWITTER_CLIENT_ID,
            "redirect_uri": settings.TWITTER_CALLBACK_URL,
            "scope": "tweet.read tweet.write users.read offline.access",
            "state": state,
            "code_challenge_method": settings.TWITTER_CODE_CHALLENGE_METHOD,
            "code_challenge": state  # Using state as code challenge for simplicity
        }
        
        # Construct URL with parameters
        url = f"{auth_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"
        
        logger.info(f"Generated Twitter OAuth URL with state: {state}")
        return url

    except Exception as e:
        logger.error(f"Failed to generate Twitter OAuth URL: {str(e)}")
        raise AuthenticationError(f"Failed to generate Twitter OAuth URL: {str(e)}")

async def exchange_code_for_token(code: str, state: str) -> Dict:
    """Exchange OAuth code for access token"""
    try:
        token_url = "https://api.twitter.com/2/oauth2/token"
        
        # Basic auth with client credentials
        auth = httpx.BasicAuth(
            settings.TWITTER_CLIENT_ID,
            settings.TWITTER_CLIENT_SECRET
        )
        
        data = {
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.TWITTER_CALLBACK_URL,
            "code_verifier": state  # Using state as code verifier
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                auth=auth
            )
            
        if response.status_code != 200:
            raise AuthenticationError(f"Token exchange failed: {response.text}")
            
        return response.json()

    except Exception as e:
        logger.error(f"Failed to exchange code for token: {str(e)}")
        raise AuthenticationError(f"Failed to exchange code for token: {str(e)}")

async def verify_twitter_tokens(tokens: Dict) -> Dict:
    """Verify Twitter tokens and get user data"""
    try:
        me_url = f"{settings.TWITTER_API_BASE}/users/me"
        headers = {
            "Authorization": f"Bearer {tokens['access_token']}"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(me_url, headers=headers)
            
        if response.status_code != 200:
            raise AuthenticationError(f"Token verification failed: {response.text}")
            
        return response.json()

    except Exception as e:
        logger.error(f"Failed to verify Twitter tokens: {str(e)}")
        raise AuthenticationError(f"Failed to verify Twitter tokens: {str(e)}")

async def refresh_twitter_token(refresh_token: str) -> Dict:
    """Refresh Twitter access token"""
    try:
        token_url = "https://api.twitter.com/2/oauth2/token"
        
        auth = httpx.BasicAuth(
            settings.TWITTER_CLIENT_ID,
            settings.TWITTER_CLIENT_SECRET
        )
        
        data = {
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                auth=auth
            )
            
        if response.status_code != 200:
            raise AuthenticationError(f"Token refresh failed: {response.text}")
            
        return response.json()

    except Exception as e:
        logger.error(f"Failed to refresh Twitter token: {str(e)}")
        raise AuthenticationError(f"Failed to refresh Twitter token: {str(e)}") 