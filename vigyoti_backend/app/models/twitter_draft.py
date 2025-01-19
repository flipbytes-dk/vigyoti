from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base
import uuid

class TwitterDraft(Base):
    """Store draft tweets for users"""
    __tablename__ = "twitter_drafts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    media_urls = Column(JSON)  # Store as JSON array
    thread_tweets = Column(JSON)  # Store as JSON array
    metadata = Column(JSON)  # For additional data like reply_to, quote_tweet, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship to user model
    user = relationship("User", back_populates="twitter_drafts")

    def to_dict(self) -> dict:
        """Convert draft to dictionary"""
        return {
            "id": self.id,
            "text": self.content,
            "user_id": self.user_id,
            "media_urls": self.media_urls or [],
            "thread_tweets": self.thread_tweets or [],
            "metadata": self.metadata or {},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "status": "draft"
        } 