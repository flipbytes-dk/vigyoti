from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum

class AudioStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ContentType(str, Enum):
    SHORT = "short"
    THREAD = "thread"
    QUOTE = "quote"
    POLL = "poll"
    LONG = "long"

class AudioInputCreate(BaseModel):
    title: str = Field(..., description="Title of the audio content")
    description: Optional[str] = Field(None, description="Description of the audio content")
    language: str = Field(default="en", description="Language of the audio content")
    source_type: str = Field(..., description="Source of the audio (upload/recording/stream)")

class AudioInputResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    language: str
    source_type: str
    duration: Optional[float]
    status: AudioStatus
    transcription: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AudioToTwitterRequest(BaseModel):
    content_type: ContentType = Field(..., description="Type of content to generate (short, thread, quote, poll, long)")
    num_tweets: int = Field(default=1, ge=1, description="Number of tweets to generate")
    additional_context: Optional[str] = Field(None, description="Additional context for tweet generation")
    generate_image: bool = Field(default=False, description="Whether to generate an image for the first tweet")
    is_premium: bool = Field(default=False, description="Whether this is a premium post (allows longer content)")

class TwitterContent(BaseModel):
    tweets: list[str]
    image_url: Optional[str] = None

class AudioProcessingResponse(BaseModel):
    status: str
    twitter_content: Optional[TwitterContent] = None
    error: Optional[str] = None
