from pydantic import BaseModel
from typing import Optional

class CostInfo(BaseModel):
    """Cost information for API usage"""
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    input_cost: Optional[float] = None
    output_cost: Optional[float] = None
    whisper_duration_minutes: Optional[float] = None
    whisper_cost: Optional[float] = None
    num_images_generated: Optional[int] = None
    image_generation_cost: Optional[float] = None
    firecrawl_credits_used: Optional[int] = None
    firecrawl_cost: Optional[float] = None
    total_cost: float
