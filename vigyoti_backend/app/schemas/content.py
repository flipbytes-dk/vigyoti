from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Union, Literal
from datetime import datetime
from .twitter import TwitterContent
from .cost import CostInfo

class ContentSource(BaseModel):
    id: str
    user_id: str
    source_type: str  # youtube, audio, m3u8, article, arxiv, document, image
    original_content: str  # URL or file path
    processed_content: str  # Extracted text/transcript
    created_at: datetime
    updated_at: datetime
    status: str  # processing, completed, failed
    error_message: Optional[str] = None
    metadata: Optional[dict] = None  # For storing source-specific metadata

class ContentProcessingResponse(BaseModel):
    source_id: Optional[str] = None
    summary: Optional[str] = None
    full_text: Optional[str] = None
    audio_transcript: Optional[str] = None
    cleaned_transcript: Optional[str] = None
    generated_tweets: Optional[List[TwitterContent]] = None
    metadata: Optional[dict] = None
    error: Optional[str] = None
    cost_info: Optional[CostInfo] = None

class YouTubeMetadata(BaseModel):
    video_id: str
    title: Optional[str] = None
    duration: Optional[float] = None
    language: Optional[str] = None

class AudioMetadata(BaseModel):
    duration: float
    format: str
    size: int
    sample_rate: Optional[int] = None
    channels: Optional[int] = None

class ArticleMetadata(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[datetime] = None
    word_count: Optional[int] = None

class ArxivMetadata(BaseModel):
    paper_id: str
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    published_date: Optional[datetime] = None
    categories: Optional[List[str]] = None
    abstract: Optional[str] = None

class DocumentMetadata(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None
    file_type: str  # pdf, docx, etc.
    page_count: Optional[int] = None
    word_count: Optional[int] = None

class ImageMetadata(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None
    file_type: str
    file_size: Optional[int] = None
    has_text: Optional[bool] = None
    detected_objects: Optional[List[str]] = None
    detected_text: Optional[str] = None

class TwitterContent(BaseModel):
    tweet_text: str
    is_thread: bool = False
    thread_position: Optional[int] = None
    image_url: Optional[str] = None

class AudioToTwitterResponse(BaseModel):
    audio_transcript: str
    cleaned_transcript: str
    generated_tweets: List[Dict]  
    metadata: Optional[Dict] = None
    cost_info: CostInfo

    class Config:
        from_attributes = True
        populate_by_name = True

    @property
    def tweets(self) -> List[TwitterContent]:
        """Convert the raw dictionaries to TwitterContent objects"""
        return [TwitterContent(**tweet) for tweet in self.generated_tweets]

class ImageToTwitterResponse(BaseModel):
    image_description: str
    generated_tweets: List[Dict]  # Store as raw dictionaries
    cost_info: CostInfo

    class Config:
        from_attributes = True
        populate_by_name = True

    @property
    def tweets(self) -> List[TwitterContent]:
        """Convert the raw dictionaries to TwitterContent objects"""
        return [TwitterContent(**tweet) for tweet in self.generated_tweets]

class DocumentToTwitterResponse(BaseModel):
    document_content: str
    document_summary: str
    generated_tweets: List[Dict]  # Store as raw dictionaries
    cost_info: CostInfo

    class Config:
        from_attributes = True
        populate_by_name = True

    @property
    def tweets(self) -> List[TwitterContent]:
        """Convert the raw dictionaries to TwitterContent objects"""
        return [TwitterContent(**tweet) for tweet in self.generated_tweets]

class ImageGenerationRequest(BaseModel):
    summary: str
    tweet_text: str
    aspect_ratio: Literal["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "16:10", "10:16", "3:1", "1:3"]

class ImageGenerationResponse(BaseModel):
    image_url: str
    image_prompt: str  # Added to show what prompt was used
    cost_info: dict
