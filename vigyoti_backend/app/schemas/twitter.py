from pydantic import BaseModel
from typing import Optional

class TwitterContent(BaseModel):
    """Model for Twitter content"""
    tweet_text: str
    is_thread: bool = False
    thread_position: Optional[int] = None
    image_url: Optional[str] = None
    is_premium_content: bool = False

    class Config:
        from_attributes = True
