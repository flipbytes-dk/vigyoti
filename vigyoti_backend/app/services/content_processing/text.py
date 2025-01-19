import os
from typing import List, Optional, Literal
from openai import OpenAI
from ...core.exceptions import ContentProcessingError
from ...schemas.twitter import TwitterContent as TwitterContentSchema
from ...core.config import settings
from ...services.image_generation import generate_image_from_text
from ...utils.cost_calculator import CostCalculator
import logging

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def process_text_to_twitter(
    text: str,
    content_type: Literal["short", "thread", "quote", "poll", "long"],
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> tuple[List[TwitterContentSchema], dict]:
    """Generate X (formerly Twitter) content from input text"""
    try:
        # Format the prompt
        plural_suffix = "s" if num_tweets > 1 else ""
        is_are = "are" if num_tweets > 1 else "is"
        
        prompt = f"""Based on the following text, generate {num_tweets} engaging Twitter post{plural_suffix} that {is_are} {content_type} in nature.
        
        Text Content:
        {text}
        
        Additional Context:
        {additional_context or 'No additional context provided.'}
        
        Guidelines:
        1. For premium long posts, create comprehensive content up to 25,000 characters
        2. For regular posts, stay within 280 characters
        3. Use engaging language and appropriate hashtags
        4. Include relevant emojis for visual appeal
        5. Format content for optimal readability
        """
        
        # Use higher max_tokens for premium long content
        max_tokens = 7000 if is_premium and content_type == "long" else 1000
        
        # Generate content using OpenAI
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at creating engaging X (formerly Twitter) content."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=max_tokens
        )
        
        # Parse the generated content
        generated_content = response.choices[0].message.content.strip()
        
        # Calculate costs
        input_text = prompt
        output_text = generated_content
        gpt_costs = CostCalculator.calculate_gpt_cost(input_text, output_text, completion=response)
        
        # Generate image if requested
        image_url = None
        if generate_image:
            logger.info("Generating image for tweet...")
            try:
                image_url = await generate_image_from_text(text[:500])
                if image_url:
                    logger.info(f"Successfully generated image URL: {image_url}")
            except Exception as e:
                logger.error(f"Error generating image: {str(e)}")
        
        # Process content based on type and premium status
        tweets = []
        if content_type == "long" and is_premium:
            # For premium long posts, treat the entire content as one post
            tweet_text = generated_content[:25000] if len(generated_content) > 25000 else generated_content
            logger.info(f"Generated premium content length: {len(tweet_text)} characters")
            
            tweet_content = {
                "tweet_text": tweet_text,
                "is_thread": False,
                "thread_position": None,
                "image_url": image_url,  # Add image URL to premium post
                "is_premium_content": True
            }
            tweets.append(TwitterContentSchema(**tweet_content))
        else:
            # For regular posts, split by newlines and enforce 280 character limit
            for i, line in enumerate(generated_content.split('\n\n')):
                if line.strip():
                    tweet_content = {
                        "tweet_text": line.strip()[:280],
                        "is_thread": num_tweets > 1,
                        "thread_position": i + 1 if num_tweets > 1 else None,
                        "image_url": image_url if i == 0 else None,  # Add image URL only to first tweet
                        "is_premium_content": False
                    }
                    tweets.append(TwitterContentSchema(**tweet_content))
        
        return tweets[:num_tweets], gpt_costs
    
    except Exception as e:
        logger.error(f"Error in process_text_to_twitter: {str(e)}")
        raise ContentProcessingError(f"Error generating Twitter content: {str(e)}")
