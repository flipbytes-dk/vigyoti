from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends, status, Form
from typing import Optional, List, Dict, Union
from pydantic import BaseModel, HttpUrl
from ...services.content_processing import process_youtube_url
from ...services.content_processing.youtube import (
    extract_video_id, 
    fetch_transcript_and_summary,
    generate_twitter_content
)
from ...services.content_processing.audio import process_audio_file
from ...services.content_processing.image import process_image, generate_twitter_content as image_twitter_content
from ...services.content_processing.document import process_document, generate_twitter_content as document_twitter_content
from ...services.content_processing.text import process_text_to_twitter
from ...core.exceptions import ContentProcessingError
from ...core.cache import get_cache_key, get_cached_data, set_cached_data
from ...utils.cost_calculator import CostCalculator
from fastapi import status
from ...schemas.twitter import TwitterContent as TwitterContentSchema
from ...services.content_processing.article import process_url_to_twitter
from ...schemas.cost import CostInfo
from ...schemas.content import AudioToTwitterResponse, DocumentToTwitterResponse, ImageToTwitterResponse, ImageGenerationRequest, ImageGenerationResponse
from ...services.image_generation import generate_image_from_prompt
import logging
from ...utils.content_splitter import split_into_tweets

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/content-sources",
    tags=["Content Sources"]
)

class Tweet(BaseModel):
    tweet_text: str
    is_thread: bool
    thread_position: Optional[int]
    image_url: Optional[str]
    is_premium_content: bool

class ContentGenerationRequest(BaseModel):
    url: str
    content_type: str  # "short", "long", "thread", "poll", "quote"
    num_tweets: int
    additional_context: Optional[str] = None
    generate_image: bool = False
    is_premium: bool = False

class ContentGenerationResponse(BaseModel):
    video_title: Optional[str]
    video_summary: Optional[str]
    full_transcript: Optional[str]
    generated_tweets: List[Tweet]
    metadata: dict = {}
    cost_info: dict

@router.post("/youtube-to-twitter", response_model=ContentGenerationResponse)
async def youtube_to_twitter(request: ContentGenerationRequest):
    logger.info(f"Received request for URL: {request.url}")
    logger.info(f"Request parameters: {request.dict()}")
    
    try:
        # Extract video ID from URL
        video_id = extract_video_id(request.url)
        logger.info(f"Extracted video ID: {video_id}")
        
        if not video_id:
            logger.error(f"Invalid YouTube URL: {request.url}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid YouTube URL: {request.url}"
            )

        # Fetch video transcript and summary
        try:
            logger.info(f"Fetching transcript for video ID: {video_id}")
            transcript_data = await fetch_transcript_and_summary(video_id)
            video_title = transcript_data.get("video_title", "")
            video_summary = transcript_data.get("video_summary", "")
            full_transcript = transcript_data.get("full_transcript", "")
            logger.info(f"Successfully fetched transcript. Title: {video_title}")
        except Exception as e:
            logger.error(f"Error fetching transcript: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch video transcript: {str(e)}"
            )

        # Generate tweets
        try:
            logger.info(f"Generating tweets. Content type: {request.content_type}, Num tweets: {request.num_tweets}")
            tweets_content = await generate_twitter_content(
                transcript=full_transcript,
                summary=video_summary,
                content_type=request.content_type,
                num_tweets=request.num_tweets,
                additional_context=request.additional_context,
                is_premium=request.is_premium
            )
            logger.info(f"Successfully generated {len(tweets_content)} tweets")
        except Exception as e:
            logger.error(f"Error generating tweets: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate tweets: {str(e)}"
            )

        # Create tweet objects
        generated_tweets = [
            Tweet(
                tweet_text=text,
                is_thread=request.num_tweets > 1,
                thread_position=i if request.num_tweets > 1 else None,
                image_url=None,
                is_premium_content=request.is_premium and request.content_type == "long"
            )
            for i, text in enumerate(tweets_content)
        ]

        # Calculate costs
        cost_info = {
            "input_tokens": len(full_transcript) // 4,
            "output_tokens": sum(len(tweet.tweet_text) for tweet in generated_tweets) // 4,
            "input_cost": 0.001,
            "output_cost": 0.002,
            "total_cost": 0.003
        }

        response_data = ContentGenerationResponse(
            video_title=video_title,
            video_summary=video_summary,
            full_transcript=full_transcript,
            generated_tweets=generated_tweets,
            metadata={
                "video_id": video_id,
                "content_type": request.content_type,
                "is_thread": request.num_tweets > 1
            },
            cost_info=cost_info
        )
        
        logger.info("Successfully generated response")
        return response_data

    except HTTPException as he:
        logger.error(f"HTTP Exception: {str(he)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

def split_into_tweets(content: str, num_tweets: int) -> List[str]:
    """
    Split content into multiple tweets intelligently.
    This is a placeholder - you'll need to implement the actual logic
    based on your AI model's capabilities.
    """
    # This is where you'd implement the logic to split content
    # into meaningful tweet-sized chunks
    tweets = []
    # Example logic (replace with actual implementation):
    for i in range(num_tweets):
        tweets.append(f"Tweet {i+1} content...")
    return tweets

class URLToTwitterInput(BaseModel):
    url: str
    content_type: str = "short"  # short, thread, quote, poll, long
    num_tweets: int = 1
    additional_context: Optional[str] = None
    generate_image: bool = False
    is_premium: bool = False

class URLToTwitterResponse(BaseModel):
    article_title: Optional[str] = None
    article_summary: str
    full_text: str
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[dict] = None
    cost_info: CostInfo

class YouTubeProcessingResponse(BaseModel):
    video_title: Optional[str]
    video_summary: str
    full_transcript: str
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[dict] = None
    cost_info: CostInfo

class AudioToTwitterResponse(BaseModel):
    audio_transcript: str
    cleaned_transcript: str
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[dict] = None
    cost_info: CostInfo

class TextToTwitterInput(BaseModel):
    """Input model for text-to-twitter endpoint"""
    text: str
    content_type: str = "short"  # short, thread, quote, poll, long
    num_tweets: int = 1
    additional_context: Optional[str] = None
    generate_image: bool = False
    is_premium: bool = False

class DocumentToTwitterInput(BaseModel):
    """Input model for document-to-twitter endpoint"""
    content_type: str = "short"  # short, thread, quote, poll, long
    num_tweets: int = 1
    additional_context: Optional[str] = None
    generate_image: bool = False
    is_premium: bool = False

class ImageToTwitterInput(BaseModel):
    """Input model for image-to-twitter endpoint"""
    content_type: str = "short"  # short, thread, quote, poll, long
    num_tweets: int = 1
    additional_context: Optional[str] = None
    generate_image: bool = False
    is_premium: bool = False

class ImageToTwitterResponse(BaseModel):
    """Response model for image-to-twitter endpoint"""
    image_description: str
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[dict] = None
    cost_info: CostInfo

class DocumentToTwitterResponse(BaseModel):
    """Response model for document-to-twitter endpoint"""
    document_content: str
    document_summary: str
    generated_tweets: List[Dict]  # Changed to List[Dict]
    metadata: Optional[dict] = None
    cost_info: CostInfo

class TextToTwitterResponse(BaseModel):
    """Response model for text-to-twitter endpoint"""
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[dict] = None
    cost_info: CostInfo

class YouTubeToTwitterResponse(BaseModel):
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[dict] = None
    cost_info: CostInfo

@router.post("/url-to-twitter", response_model=URLToTwitterResponse)
async def url_to_twitter(input_data: URLToTwitterInput):
    """Generate X (formerly Twitter) content from any URL"""
    try:
        # Generate cache key
        cache_key = get_cache_key("url_twitter", f"{input_data.url}_{input_data.content_type}_{input_data.num_tweets}_{input_data.additional_context}_{input_data.generate_image}_{input_data.is_premium}")
        
        # Check cache first
        cached_result = get_cached_data(cache_key)
        if cached_result:
            return URLToTwitterResponse(**cached_result)
            
        # Process URL
        result = await process_url_to_twitter(
            url=str(input_data.url),
            content_type=input_data.content_type,
            num_tweets=input_data.num_tweets,
            additional_context=input_data.additional_context,
            generate_image=input_data.generate_image,
            is_premium=input_data.is_premium
        )
        
        # Calculate GPT costs
        input_text = f"{result['full_text']}\nContent type: {input_data.content_type}\nNumber of tweets: {input_data.num_tweets}"
        if input_data.additional_context:
            input_text += f"\nAdditional context: {input_data.additional_context}"
            
        output_text = result['article_summary'] + "\n" + "\n".join(tweet['tweet_text'] for tweet in result['generated_tweets'])
        
        gpt_costs = CostCalculator.calculate_gpt_cost(input_text, output_text)
        
        # Calculate image generation costs if applicable
        image_costs = None
        num_images = sum(1 for tweet in result['generated_tweets'] if tweet.get('image_url'))
        if num_images > 0:
            image_costs = CostCalculator.calculate_image_cost(num_images)
            
        # Calculate Firecrawl costs (1 credit per URL)
        firecrawl_costs = CostCalculator.calculate_firecrawl_cost(1)
        
        # Calculate total cost
        total_cost = CostCalculator.calculate_total_cost(
            gpt_costs, 
            image_cost=image_costs,
            firecrawl_cost=firecrawl_costs
        )
        
        # Create response object
        response = URLToTwitterResponse(
            article_title=result.get('article_title'),
            article_summary=result['article_summary'],
            full_text=result['full_text'],
            generated_tweets=[TwitterContentSchema(**tweet) for tweet in result['generated_tweets']],
            metadata=result.get('metadata'),
            cost_info=CostInfo(
                input_tokens=gpt_costs["input_tokens"],
                output_tokens=gpt_costs["output_tokens"],
                input_cost=gpt_costs["input_cost"],
                output_cost=gpt_costs["output_cost"],
                total_cost=total_cost,
                num_images_generated=num_images if num_images > 0 else None,
                image_generation_cost=image_costs["cost"] if image_costs else None,
                firecrawl_credits_used=1,
                firecrawl_cost=firecrawl_costs["cost"]
            )
        )
        
        # Cache the result as a dictionary
        set_cached_data(cache_key, response.model_dump())
        
        return response
    except ContentProcessingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/audio-to-twitter", response_model=AudioToTwitterResponse)
async def audio_to_twitter(
    file: UploadFile = File(...),
    content_type: str = Form("short", description="Type of content to generate (short, thread, quote, poll, long)"),
    num_tweets: int = Form(1, description="Number of tweets to generate"),
    additional_context: Optional[str] = Form(None, description="Additional context for tweet generation"),
    generate_image: bool = Form(False, description="Whether to generate an image for the first tweet"),
    is_premium: bool = Form(False, description="Whether this is a premium post (allows longer content)")
):
    """Process audio file and generate Twitter content"""
    try:
        # Convert form data to proper types
        num_tweets = int(num_tweets)  # Ensure num_tweets is an integer
        generate_image = generate_image.lower() == 'true' if isinstance(generate_image, str) else generate_image
        is_premium = is_premium.lower() == 'true' if isinstance(is_premium, str) else is_premium
        
        logger.info(f"[audio_to_twitter] Received request with num_tweets={num_tweets} (type: {type(num_tweets)})")
        
        # Process audio file
        result = await process_audio_file(
            file=file,
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            generate_image=generate_image,
            is_premium=is_premium
        )
        
        # Create response
        response = AudioToTwitterResponse(
            audio_transcript=result.audio_transcript,
            cleaned_transcript=result.cleaned_transcript,
            generated_tweets=[TwitterContentSchema(**tweet) for tweet in result.generated_tweets],
            metadata=result.metadata,
            cost_info=result.cost_info
        )

        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/image-to-twitter", response_model=ImageToTwitterResponse)
async def image_to_twitter(
    file: UploadFile = File(...),
    content_type: str = Form("short", description="Type of content to generate (short, long, thread)"),
    num_tweets: int = Form(1, description="Number of tweets to generate"),
    additional_context: Optional[str] = Form(None, description="Additional context for tweet generation"),
    generate_image: bool = Form(False, description="Whether to generate an image for the first tweet"),
    is_premium: bool = Form(False, description="Whether this is a premium post (allows longer content)")
):
    """Generate X (formerly Twitter) content from an uploaded image"""
    try:
        # Generate cache key
        cache_key = get_cache_key("image_twitter", f"{file.filename}_{content_type}_{num_tweets}_{additional_context}_{generate_image}_{is_premium}")
        
        # Check cache first
        cached_result = get_cached_data(cache_key)
        if cached_result:
            return cached_result
            
        # Process image
        processed_content = await process_image(file)
        
        # Generate tweets
        tweets, gpt_costs = await image_twitter_content(
            image_analysis=processed_content.full_text,
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            generate_image=generate_image,
            is_premium=is_premium
        )
        
        # Calculate costs
        input_text = f"{processed_content.full_text}\nContent type: {content_type}\nNumber of tweets: {num_tweets}"
        if additional_context:
            input_text += f"\nAdditional context: {additional_context}"
            
        output_text = "\n".join(tweet["tweet_text"] for tweet in tweets)
        
        gpt_costs = CostCalculator.calculate_gpt_cost(input_text, output_text)
        
        # Create response
        result = ImageToTwitterResponse(
            image_description=processed_content.full_text,
            generated_tweets=[TwitterContentSchema(**tweet) for tweet in tweets],  # Convert to TwitterContentSchema
            metadata={},
            cost_info=CostInfo(
                input_tokens=gpt_costs["input_tokens"],
                output_tokens=gpt_costs["output_tokens"],
                input_cost=gpt_costs["input_cost"],
                output_cost=gpt_costs["output_cost"],
                total_cost=gpt_costs["total_cost"]
            )
        )
        
        # Cache the result
        set_cached_data(cache_key, result)
        
        return result
    except ContentProcessingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/document-to-twitter", response_model=DocumentToTwitterResponse)
async def document_to_twitter(
    file: UploadFile = File(...),
    content_type: str = Form("short", description="Type of content to generate (short, long, thread)"),
    num_tweets: int = Form(1, description="Number of tweets to generate"),
    additional_context: Optional[str] = Form(None, description="Additional context for tweet generation"),
    generate_image: bool = Form(False, description="Whether to generate an image for the first tweet"),
    is_premium: bool = Form(False, description="Whether this is a premium post (allows longer content)")
):
    """Generate X (formerly Twitter) content from an uploaded document"""
    try:
        # Generate cache key
        cache_key = get_cache_key("document_twitter", f"{file.filename}_{content_type}_{num_tweets}_{additional_context}_{generate_image}_{is_premium}")
        
        # Check cache first
        cached_result = get_cached_data(cache_key)
        if cached_result:
            return cached_result
            
        # Process document
        processed_content = await process_document(file)
        
        # Generate tweets
        tweets, gpt_costs = await document_twitter_content(
            document_text=processed_content.full_text,  # Use document_text parameter
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            generate_image=generate_image,
            is_premium=is_premium
        )
        
        # Calculate costs
        input_text = f"{processed_content.full_text}\nContent type: {content_type}\nNumber of tweets: {num_tweets}"
        if additional_context:
            input_text += f"\nAdditional context: {additional_context}"
            
        output_text = processed_content.summary + "\n" + "\n".join(tweet["tweet_text"] for tweet in tweets)
        
        gpt_costs = CostCalculator.calculate_gpt_cost(input_text, output_text)
        
        # Create response
        result = DocumentToTwitterResponse(
            document_content=processed_content.full_text,
            document_summary=processed_content.summary,
            generated_tweets=tweets,  # Pass raw dictionaries
            cost_info=CostInfo(
                input_tokens=gpt_costs["input_tokens"],
                output_tokens=gpt_costs["output_tokens"],
                input_cost=gpt_costs["input_cost"],
                output_cost=gpt_costs["output_cost"],
                total_cost=gpt_costs["total_cost"]
            )
        )
        
        # Cache the result
        set_cached_data(cache_key, result)
        
        return result
    except ContentProcessingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/text-to-twitter", response_model=TextToTwitterResponse)
async def text_to_twitter(input_data: TextToTwitterInput):
    """Generate X (formerly Twitter) content from text input"""
    try:
        # Generate cache key with all input parameters as identifier
        identifier = f"{input_data.text[:50]}_{input_data.content_type}_{input_data.num_tweets}_{input_data.additional_context}_{input_data.generate_image}_{input_data.is_premium}"
        cache_key = get_cache_key("text_to_twitter", identifier)
        
        # Check cache
        cached_data = get_cached_data(cache_key)
        if cached_data:
            return TextToTwitterResponse(**cached_data)
        
        # Process text and generate tweets
        generated_tweets, gpt_costs = await process_text_to_twitter(
            text=input_data.text,
            content_type=input_data.content_type,
            num_tweets=input_data.num_tweets,
            additional_context=input_data.additional_context,
            generate_image=input_data.generate_image,
            is_premium=input_data.is_premium
        )
        
        # Create response
        result = TextToTwitterResponse(
            generated_tweets=generated_tweets,
            metadata={},
            cost_info=CostInfo(
                input_tokens=gpt_costs["input_tokens"],
                output_tokens=gpt_costs["output_tokens"],
                input_cost=gpt_costs["input_cost"],
                output_cost=gpt_costs["output_cost"],
                total_cost=gpt_costs["total_cost"]
            )
        )
        
        # Cache the result
        set_cached_data(cache_key, result.model_dump())
        
        return result
    except ContentProcessingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/generate-image", response_model=ImageGenerationResponse)
async def generate_image(request: ImageGenerationRequest):
    """Generate an image based on summary, tweet text and aspect ratio."""
    try:
        logger.info(f"Received image generation request: {request.dict()}")
        
        result = await generate_image_from_prompt(
            summary=request.summary,
            tweet_text=request.tweet_text,
            aspect_ratio=request.aspect_ratio
        )
        
        return ImageGenerationResponse(
            image_url=result["image_url"],
            image_prompt=result["image_prompt"],
            cost_info=result["cost_info"]
        )

    except Exception as e:
        logger.error(f"Error in generate_image endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate image: {str(e)}"
        )
