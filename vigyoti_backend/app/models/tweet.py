from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class TweetDocument(BaseModel):
    """Enforce consistent tweet document structure"""
    id: str
    tweet_text: str
    image_url: Optional[str] = None
    image_generation_details: Optional[dict] = None
    storage_path: Optional[str] = None  # Add storage path tracking
    created_at: datetime
    updated_at: datetime