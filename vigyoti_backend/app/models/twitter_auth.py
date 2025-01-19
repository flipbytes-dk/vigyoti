from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import TimestampedModel
import uuid

class TwitterAuth(TimestampedModel):
    """Store Twitter OAuth credentials"""
    __tablename__ = "twitter_auth"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expires_at = Column(DateTime(timezone=True), nullable=False)
    twitter_user_id = Column(String)
    twitter_username = Column(String)

    # Relationship to user model
    user = relationship("User", back_populates="twitter_auth")

    def __repr__(self):
        return f"<TwitterAuth(user_id={self.user_id}, username={self.twitter_username})>" 