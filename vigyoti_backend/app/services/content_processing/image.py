import os
import base64
from typing import BinaryIO, List, Optional, Dict, Tuple
from fastapi import UploadFile
from openai import OpenAI
from ...schemas.twitter import TwitterContent as TwitterContentSchema
from ...schemas.content import ImageMetadata, ContentProcessingResponse
from ...core.exceptions import ContentProcessingError, FileTypeError, FileSizeError
from ...core.prompts import DEFAULT_IMAGE_ANALYSIS_PROMPT, TWITTER_CONTENT_PROMPT, IMAGE_TWITTER_PROMPT, TWITTER_CONTENT_GUIDELINES
from ...core.config import settings
from ...services.image_generation import generate_image_from_text
from ...utils.cost_calculator import CostCalculator
import logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

async def analyze_image_with_vision(image_data: bytes, prompt: str = None) -> Tuple[str, Dict]:
    """Analyze image using OpenAI Vision API"""
    try:
        # Encode image to base64
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Default prompt if none provided
        if not prompt:
            prompt = DEFAULT_IMAGE_ANALYSIS_PROMPT
        
        # Call Vision API
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        
        analysis = response.choices[0].message.content
        
        # Calculate vision API costs
        vision_costs = CostCalculator.calculate_gpt_cost(prompt, analysis, completion=response)
        
        return analysis, vision_costs
        
    except Exception as e:
        raise ContentProcessingError(f"Error analyzing image with Vision API: {str(e)}")

async def process_image(file: UploadFile, analysis_prompt: str = None) -> ContentProcessingResponse:
    """Process image file using OpenAI Vision"""
    try:
        # Validate file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise FileTypeError(f"Unsupported file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES.values())}")
        
        # Validate file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to start
        
        if file_size > MAX_FILE_SIZE:
            raise FileSizeError(f"File size exceeds maximum limit of {MAX_FILE_SIZE/1024/1024}MB")
        
        # Read image data
        image_data = await file.read()
        
        # Analyze image
        analysis, vision_costs = await analyze_image_with_vision(image_data, analysis_prompt)
        
        # Create metadata
        metadata = ImageMetadata(
            file_name=file.filename,
            file_size=file_size,
            file_type=ALLOWED_IMAGE_TYPES[file.content_type],
            dimensions=None  # Would need additional library like Pillow to get dimensions
        )
        
        # For images, the full text is the analysis and summary is the first part
        summary = analysis[:500] + "..." if len(analysis) > 500 else analysis
        
        return ContentProcessingResponse(
            source_id=file.filename,
            summary=summary,
            full_text=analysis,
            metadata=metadata.dict(),
            costs=vision_costs
        )
    
    except Exception as e:
        error_msg = f"Error processing image: {str(e)}"
        raise ContentProcessingError(error_msg)

async def generate_twitter_content(
    image_analysis: str,
    content_type: str,
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> Tuple[List[Dict], Dict]:
    """Generate X (formerly Twitter) content inspired by the image analysis"""
    try:
        # Format the Twitter content prompt
        plural_suffix = "s" if num_tweets > 1 else ""
        is_are = "are" if num_tweets > 1 else "is"
        
        # Get content type guidelines
        content_type_guidelines = TWITTER_CONTENT_GUIDELINES.get(
            content_type,
            TWITTER_CONTENT_GUIDELINES["short"]  # Default to short if type not found
        )
        
        # For premium long posts, enhance the prompt to encourage longer content
        if content_type == "long" and is_premium:
            additional_context = (additional_context or "") + """
            Since this is a premium post, please provide a comprehensive analysis that:
            1. Describes the image in detail
            2. Explores multiple perspectives and interpretations
            3. Connects to broader industry trends and implications
            4. Includes relevant examples and case studies
            5. Offers actionable insights and takeaways
            6. Uses formatting (paragraphs, emojis) for better readability
            7. Aims for at least 1000 words of engaging content
            """
        
        twitter_prompt = IMAGE_TWITTER_PROMPT.format(
            content=image_analysis,
            num_tweets=num_tweets,
            plural_suffix=plural_suffix,
            is_are=is_are,
            additional_context=additional_context or "",
            content_type_guidelines=content_type_guidelines
        )
        
        # Use higher max_tokens for premium long content
        max_tokens = 7000 if is_premium and content_type == "long" else 1000
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert at creating engaging X (formerly Twitter) content that draws creative insights and ideas from images. 
                    For premium users creating long-form content, you should write comprehensive, well-structured posts that are several paragraphs long (at least 1000 words) and make full use of the 25,000 character limit.
                    For regular users, limit posts to 280 characters."""
                },
                {"role": "user", "content": twitter_prompt}
            ],
            temperature=0.8,  # Slightly higher temperature for more creative responses
            max_tokens=max_tokens
        )
        
        # Parse the generated tweets
        generated_content = response.choices[0].message.content.strip()
        
        # Calculate Twitter content generation costs
        twitter_costs = CostCalculator.calculate_gpt_cost(twitter_prompt, generated_content, completion=response)
        
        tweets = []
        
        # Parsing logic based on content type and premium status
        if content_type == "long" and is_premium:
            logger.info("Generating premium long-form content...")
            # For premium long posts, treat the entire content as one post
            # Enforce 25,000 character limit
            tweet_text = generated_content[:25000] if len(generated_content) > 25000 else generated_content
            
            # Log the content length for debugging
            logger.info(f"Generated premium content length: {len(tweet_text)} characters")
            
            tweet_content = {
                "tweet_text": tweet_text,
                "is_thread": False,
                "thread_position": None,
                "image_url": None,
                "is_premium_content": True
            }
            
            # Generate image if requested
            if generate_image:
                logger.info("Generating image for premium post...")
                try:
                    image_url = await generate_image_from_text(image_analysis[:500])
                    if image_url:
                        tweet_content["image_url"] = image_url
                        logger.info(f"Added image URL to premium post: {image_url}")
                except Exception as e:
                    logger.error(f"Error generating image: {str(e)}")
            
            tweets.append(tweet_content)
        else:
            logger.info("Generating regular content...")
            # For regular posts, split by newlines and enforce 280 character limit
            for i, line in enumerate(generated_content.split('\n')):
                if line.strip():
                    # Truncate to 280 characters for regular posts
                    tweet_text = line.strip()[:280]
                    tweet_content = {
                        "tweet_text": tweet_text,
                        "is_thread": num_tweets > 1,
                        "thread_position": i + 1 if num_tweets > 1 else None,
                        "image_url": None,
                        "is_premium_content": False
                    }
                    
                    # Generate image for the first tweet if requested
                    if generate_image and i == 0:
                        logger.info("Generating image for first tweet...")
                        try:
                            image_url = await generate_image_from_text(image_analysis[:500])
                            if image_url:
                                tweet_content["image_url"] = image_url
                                logger.info(f"Added image URL to tweet: {image_url}")
                        except Exception as e:
                            logger.error(f"Error generating image: {str(e)}")
                    
                    tweets.append(tweet_content)
                    logger.info(f"Generated regular content with length: {len(tweet_text)}")
        
        return tweets[:num_tweets], twitter_costs
        
    except Exception as e:
        logger.error(f"Error generating X content: {str(e)}")
        raise ContentProcessingError(f"Error generating X content: {str(e)}")
