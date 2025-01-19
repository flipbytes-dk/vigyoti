from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from ...models.twitter_auth import TwitterAuth
from ...schemas.twitter_auth import TwitterTokens, TwitterUser

class TwitterCredentialsService:
    """Service for managing Twitter credentials in database"""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    async def store_credentials(
        self,
        user_id: str,
        tokens: TwitterTokens,
        twitter_user: TwitterUser
    ) -> Optional[TwitterAuth]:
        """Store or update Twitter credentials"""
        try:
            # Check for existing credentials
            stmt = select(TwitterAuth).where(TwitterAuth.user_id == user_id)
            result = await self.db.execute(stmt)
            credentials = result.scalar_one_or_none()

            if credentials:
                # Update existing credentials
                credentials.access_token = tokens.access_token
                credentials.refresh_token = tokens.refresh_token
                credentials.token_expires_at = datetime.fromtimestamp(tokens.expires_at)
                credentials.twitter_user_id = twitter_user.id
                credentials.twitter_username = twitter_user.username
            else:
                # Create new credentials
                credentials = TwitterAuth(
                    user_id=user_id,
                    access_token=tokens.access_token,
                    refresh_token=tokens.refresh_token,
                    token_expires_at=datetime.fromtimestamp(tokens.expires_at),
                    twitter_user_id=twitter_user.id,
                    twitter_username=twitter_user.username
                )
                self.db.add(credentials)

            await self.db.commit()
            await self.db.refresh(credentials)
            return credentials

        except Exception as e:
            await self.db.rollback()
            raise e

    async def get_credentials(self, user_id: str) -> Optional[TwitterAuth]:
        """Get Twitter credentials for a user"""
        stmt = select(TwitterAuth).where(TwitterAuth.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_credentials(self, user_id: str) -> bool:
        """Delete Twitter credentials for a user"""
        try:
            stmt = select(TwitterAuth).where(TwitterAuth.user_id == user_id)
            result = await self.db.execute(stmt)
            credentials = result.scalar_one_or_none()

            if credentials:
                await self.db.delete(credentials)
                await self.db.commit()
                return True
            return False

        except Exception as e:
            await self.db.rollback()
            raise e 