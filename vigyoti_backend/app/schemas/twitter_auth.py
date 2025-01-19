from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class TwitterTokens(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: datetime
    token_type: str = "Bearer"
    scope: str

    @classmethod
    def from_response(cls, response: Dict) -> "TwitterTokens":
        """Create TwitterTokens from API response"""
        return cls(
            access_token=response["access_token"],
            refresh_token=response["refresh_token"],
            expires_at=datetime.now().timestamp() + response["expires_in"],
            token_type=response.get("token_type", "Bearer"),
            scope=response["scope"]
        )

class TwitterUser(BaseModel):
    id: str
    username: str
    name: Optional[str] = None
    profile_image_url: Optional[str] = None

    @classmethod
    def from_response(cls, response: Dict) -> "TwitterUser":
        """Create TwitterUser from API response"""
        data = response["data"]
        return cls(
            id=data["id"],
            username=data["username"],
            name=data.get("name"),
            profile_image_url=data.get("profile_image_url")
        )

class TwitterAuthState(BaseModel):
    """Model for storing OAuth state and PKCE verifier"""
    state: str
    code_verifier: str
    created_at: datetime = datetime.now() 