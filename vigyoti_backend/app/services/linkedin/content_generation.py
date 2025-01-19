from typing import List, Optional
from ...core.prompts import LINKEDIN_POST_PROMPT, CONTENT_IMPROVEMENT_PROMPT
from ...core.exceptions import ContentProcessingError
from openai import OpenAI
import os
import time
from tenacity import retry, stop_after_attempt, wait_exponential

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def create_linkedin_prompt(
    source_text: str,
    post_type: str,  # "article", "update", "thought_leadership"
    tone: str,
    target_audience: str,
    keywords: List[str],
    goal: str,
    custom_instructions: Optional[str] = None
) -> str:
    """Create a customized LinkedIn post generation prompt"""
    base_prompt = LINKEDIN_POST_PROMPT
    
    # Add custom parameters to the prompt
    custom_params = f"""
Additional Parameters:
- Type: {post_type}
- Tone: {tone}
- Target Audience: {target_audience}
- Keywords to include: {', '.join(keywords)}
- Goal: {goal}
{f"- Custom Instructions: {custom_instructions}" if custom_instructions else ""}

Source Content:
{source_text}
"""
    
    return base_prompt + custom_params

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry_error_callback=lambda retry_state: None
)
def _generate_content_with_retry(prompt: str, max_tokens: int = 1000) -> str:
    """Generate content with retry logic for rate limits"""
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        if "rate limit" in str(e).lower():
            # If we hit rate limit, sleep for a bit before retry
            time.sleep(5)
            raise e
        raise ContentProcessingError(f"Error generating content: {str(e)}")

def generate_linkedin_content(
    source_text: str,
    post_type: str,
    tone: str,
    target_audience: str,
    keywords: List[str],
    goal: str,
    custom_instructions: Optional[str] = None,
    num_variations: int = 1
) -> List[str]:
    """Generate LinkedIn post content with retry logic for rate limits"""
    prompt = create_linkedin_prompt(
        source_text=source_text,
        post_type=post_type,
        tone=tone,
        target_audience=target_audience,
        keywords=keywords,
        goal=goal,
        custom_instructions=custom_instructions
    )
    
    variations = []
    for _ in range(num_variations):
        try:
            content = _generate_content_with_retry(prompt)
            if content:
                # Try to improve the content
                improvement_prompt = CONTENT_IMPROVEMENT_PROMPT.format(
                    platform="LinkedIn",
                    content=content
                )
                improved_content = _generate_content_with_retry(improvement_prompt, max_tokens=1500)
                variations.append(improved_content or content)
            else:
                raise ContentProcessingError("Failed to generate content")
        except Exception as e:
            raise ContentProcessingError(f"Error in content generation: {str(e)}")
    
    return variations
