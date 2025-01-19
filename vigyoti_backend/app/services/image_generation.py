import os
import replicate
import logging
from typing import Optional, Dict, Literal
from openai import OpenAI
from ..core.exceptions import ContentProcessingError, InvalidCredentialsError
from ..core.settings import settings
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set Replicate API token
os.environ["REPLICATE_API_TOKEN"] = settings.REPLICATE_API_TOKEN

# Initialize OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)

async def generate_image_prompt(summary: str, tweet_text: str) -> str:
    """Generate an appropriate image prompt using GPT-4o-mini."""
    try:
        prompt = f"""Based on the following summary and tweet, create a detailed image generation prompt.
        The prompt should describe a visually appealing and relevant image that complements the tweet and should be concise, precise and not too verbose.

        Summary: {summary}

        Tweet: {tweet_text}

        Guidelines for the image prompt:
        - Be specific and descriptive
        - Focus on visual elements
        - Include style suggestions (e.g., photorealistic, dramatic lighting, etc.)
        - Avoid text or words in the image
        - Keep it concise but detailed
        - Focus on the main message or emotion of the tweet

        Generate an image prompt:"""

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at creating detailed image generation prompts that capture the essence of text content."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200
        )

        image_prompt = response.choices[0].message.content.strip()
        logger.info(f"Generated image prompt: {image_prompt}")
        return image_prompt

    except Exception as e:
        logger.error(f"Error generating image prompt: {str(e)}")
        raise ContentProcessingError(f"Failed to generate image prompt: {str(e)}")

async def generate_image_from_prompt(
    summary: str,
    tweet_text: str,
    aspect_ratio: Literal["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "16:10", "10:16", "3:1", "1:3"]
) -> Dict[str, any]:
    """Generate an image using Ideogram v2 Turbo model based on the content and aspect ratio."""
    try:
        # Verify API token is set
        if not os.getenv("REPLICATE_API_TOKEN"):
            raise InvalidCredentialsError("REPLICATE_API_TOKEN environment variable is not set")

        logger.info("REPLICATE_API_TOKEN is set and available")
        
        # Generate appropriate image prompt
        image_prompt = await generate_image_prompt(summary, tweet_text)
        
        # Configure the model parameters based on Ideogram v2 Turbo requirements
        model_params = {
            "prompt": image_prompt,
            "magic_prompt_option": "Auto",
            "aspect_ratio": aspect_ratio,
            "resolution": "None",
            "style_type": "None"
        }
        
        logger.info(f"Calling Replicate Ideogram with parameters: {model_params}")
        
        # Create Replicate client with explicit token
        client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
        
        # Run the model using the client
        output = await client.async_run(
            "ideogram-ai/ideogram-v2-turbo",
            input=model_params
        )
        
        # Convert FileOutput to string URL
        image_url = str(output) if output else None
        logger.info(f"Replicate output converted to URL: {image_url}")
        
        if not image_url:
            raise ContentProcessingError("No image URL generated")

        # Return the URL string and the prompt used
        return {
            "image_url": image_url,
            "image_prompt": image_prompt,  # Include the generated prompt in response
            "cost_info": {
                "prompt_generation_cost": 0.01,  # Cost for GPT-4 prompt generation
                "image_generation_cost": 0.05,   # Cost for Ideogram image generation
                "total_cost": 0.06
            }
        }

    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise ContentProcessingError(f"Failed to generate image: {str(e)}")

# Add alias for backward compatibility
generate_image_from_text = generate_image_from_prompt
