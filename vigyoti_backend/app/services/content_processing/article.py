import os
from firecrawl import FirecrawlApp
from typing import Dict, Optional, Literal, List, Tuple
from datetime import datetime
from urllib.parse import urlparse
from openai import AsyncOpenAI
from ...schemas.content import ArticleMetadata, ContentProcessingResponse
from ...schemas.twitter import TwitterContent as TwitterContentSchema
from ...core.exceptions import ContentProcessingError, InvalidCredentialsError
from ...core.prompts import ARTICLE_SUMMARY_PROMPT, PAPER_SUMMARY_PROMPT
from ...core.cache import get_cache_key, get_cached_data, set_cached_data
from ..image_generation import generate_image_from_text
from ...core.config import settings
from ...utils.cost_calculator import CostCalculator
import re
import logging

# Initialize clients
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
if not firecrawl_api_key:
    raise InvalidCredentialsError("FIRECRAWL_API_KEY environment variable is not set")
firecrawl = FirecrawlApp(api_key=firecrawl_api_key)

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_text(text: str) -> str:
    """Clean extracted text by removing extra whitespace and normalizing line breaks"""
    # Remove multiple newlines
    text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
    # Remove multiple spaces
    text = ' '.join(text.split())
    return text

def create_twitter_prompt(
    text: str,
    content_type: str,
    num_tweets: int,
    additional_context: Optional[str]
) -> str:
    """Create a prompt for generating Twitter content from article text"""
    # Start with user's specific requirements if provided
    prompt = ""
    if additional_context:
        prompt = f"""IMPORTANT USER REQUIREMENTS:
{additional_context}

Please ensure that ALL generated tweets strictly follow and incorporate these specific requirements while maintaining authenticity and engagement.

"""

    # Add base prompt
    prompt += f"""Based on the following article content, generate {num_tweets} different Twitter {'post' if num_tweets == 1 else 'posts'} that are {content_type} in nature. Each post should focus on a different aspect or insight from the article while adhering to the user requirements above (if provided).

Article Content:
{text}

Guidelines based on content type:
"""

    type_guidelines = {
        "short": f"""Create {num_tweets} different concise, impactful tweets under 280 characters that:
- Capture different key insights or memorable points from the article
- Use engaging language and tone
- Include relevant hashtags where appropriate
- Each tweet should focus on a distinct point or insight
- Ensure each tweet aligns with the user's specific requirements (if provided)
- Separate each tweet with a double newline""",

        "thread": f"""Create a thread of {num_tweets} tweets where:
- Each tweet builds on the previous one
- The first tweet hooks the reader
- Ideas flow logically and maintain context
- Each tweet can stand alone but works better in sequence
- Ensure the entire thread aligns with the user's specific requirements (if provided)
- Format each tweet as [1/{num_tweets}], [2/{num_tweets}], etc.""",

        "quote": f"""Extract {num_tweets} different powerful quotes that:
- Capture different impactful statements or insights from the article
- Include proper attribution
- Add thoughtful reflection where appropriate
- Maintain the original context and meaning
- Ensure quote selection and commentary align with user's specific requirements (if provided)
- Separate each quote tweet with a double newline""",

        "poll": f"""Create {num_tweets} different engaging polls that:
- Ask clear, relevant questions about different aspects of the article
- Provide 2-4 distinct, meaningful options for each poll
- Encourage audience participation
- Relate directly to different key points from the content
- Ensure poll questions and options align with user's specific requirements (if provided)
- Separate each poll tweet with a double newline""",
        "long": f"""Create a comprehensive, well-structured post that is several paragraphs long (at least 1000 words)
- Capture the main insights or key points from the article
- Use engaging language and tone
- Include relevant hashtags where appropriate
- Ensure the post aligns with the user's specific requirements (if provided)
- Make full use of the 25,000 character limit"""
    }

    prompt += type_guidelines[content_type]

    prompt += f"\n\nIMPORTANT: Generate exactly {num_tweets} tweets, no more, no less. Separate each tweet with a double newline."
    
    if additional_context:
        prompt += "\n\nFINAL REMINDER: Review each generated tweet to ensure it fully incorporates and aligns with the user requirements specified at the beginning of this prompt."

    return prompt

async def generate_summary(text: str, is_paper: bool = False) -> str:
    """Generate a summary of the text using OpenAI"""
    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": PAPER_SUMMARY_PROMPT if is_paper else ARTICLE_SUMMARY_PROMPT},
                {"role": "user", "content": text}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise ContentProcessingError(f"Error generating summary: {str(e)}")

def extract_metadata_from_response(response: Dict) -> ArticleMetadata:
    """Extract metadata from FireCrawl response"""
    try:
        metadata = ArticleMetadata(
            title=response.get('title'),
            author=response.get('author'),
            published_date=datetime.fromisoformat(response['published']) if response.get('published') else None,
            word_count=len(response.get('text', '').split()) if response.get('text') else None
        )
        return metadata
    except Exception as e:
        # If metadata extraction fails, return minimal metadata
        return ArticleMetadata(
            title=None,
            author=None,
            published_date=None,
            word_count=None
        )

async def fetch_article_and_summary(url: str) -> Dict:
    """Fetch article content and generate summary, with caching"""
    try:
        # Check cache first
        cache_key = get_cache_key("article", url)
        logger.info(f"Checking cache for article content with key: {cache_key}")
        
        cached_data = get_cached_data(cache_key)
        if cached_data:
            logger.info(f"✅ Cache HIT: Found cached article content for URL: {url}")
            return cached_data
            
        logger.info(f"❌ Cache MISS: No cached content found for URL: {url}. Fetching from FireCrawl...")

        # Validate URL
        parsed_url = urlparse(url)
        if not all([parsed_url.scheme, parsed_url.netloc]):
            raise ContentProcessingError("Invalid URL format")

        # Scrape the URL with FireCrawl
        try:
            scrape_result = firecrawl.scrape_url(
                url,
                params={'formats': ['markdown']}  # Only request markdown format as per documentation
            )
            logger.info(f"FireCrawl response: {scrape_result}")  # Debug logging
            
            if not scrape_result:
                raise ContentProcessingError("Empty response from FireCrawl")
            
            # The markdown content is directly in the 'markdown' key
            content = scrape_result.get('markdown')
            if not content:
                raise ContentProcessingError("No markdown content found in FireCrawl response")
                
            full_text = clean_text(content)
            
            # Generate summary optimized for social media content
            summary = await generate_summary(full_text)
            logger.info("Generated summary from article content")
            
            # Cache the results
            data = {
                "full_text": full_text,
                "summary": summary,
                "metadata": extract_metadata_from_response(scrape_result).dict()
            }
            if set_cached_data(cache_key, data):
                logger.info(f"✅ Successfully cached article content with key: {cache_key}")
            else:
                logger.warning(f"⚠️ Failed to cache article content with key: {cache_key}")
            
            return data

        except Exception as e:
            logger.error(f"Error scraping URL with FireCrawl: {str(e)}")
            raise ContentProcessingError(f"Error processing article: {str(e)}")

    except Exception as e:
        raise ContentProcessingError(f"Error processing article: {str(e)}")

async def process_url_to_twitter(
    url: str,
    content_type: Literal["short", "thread", "quote", "poll", "long"],
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> List[TwitterContentSchema]:
    """Process URL and generate Twitter content with optional image generation"""
    try:
        # Get article content and summary
        article_data = await fetch_article_and_summary(url)
        logger.info(f"Article data fetched successfully for URL: {url}")
        
        # Use higher max_tokens for premium long content
        max_tokens = 7000 if is_premium and content_type == "long" else 1000
        
        # Generate tweets
        tweets_response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are a social media expert who creates engaging Twitter content.
                    For premium users creating long-form content, you should write comprehensive,
                    well-structured posts that are several paragraphs long (at least 1000 words)
                    and make full use of the 25,000 character limit."""
                },
                {"role": "user", "content": create_twitter_prompt(
                    article_data["summary"],
                    content_type,
                    num_tweets,
                    additional_context
                )}
            ],
            temperature=0.8,  # Slightly higher temperature for more creative responses
            max_tokens=max_tokens
        )
        
        # Process the tweets
        tweets = []
        generated_content = tweets_response.choices[0].message.content.strip()
        
        if content_type == "long" and is_premium:
            # For premium long posts, treat the entire content as one post
            # Enforce 25,000 character limit
            tweet_text = generated_content[:25000] if len(generated_content) > 25000 else generated_content
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
                image_url = await generate_image_from_text(article_data["summary"])
                if image_url:
                    tweet_content["image_url"] = image_url
                    logger.info(f"Added image URL to premium post: {image_url}")
            
            tweets.append(tweet_content)
        else:
            # Split by double newlines for multiple tweets
            tweet_texts = generated_content.split("\n\n")
            logger.info(f"Generated {len(tweet_texts)} tweets")
            
            for i, tweet_text in enumerate(tweet_texts):
                if not tweet_text.strip():
                    continue
                    
                tweet_content = {
                    "tweet_text": tweet_text.strip()[:280],  # Enforce 280 char limit for regular tweets
                    "is_thread": num_tweets > 1,
                    "thread_position": i + 1 if num_tweets > 1 else None,
                    "image_url": None,
                    "is_premium_content": False
                }
                
                # Generate image for the first tweet if requested
                if generate_image and i == 0:
                    logger.info("Generating image for first tweet...")
                    image_url = await generate_image_from_text(article_data["summary"])
                    if image_url:
                        tweet_content["image_url"] = image_url
                        logger.info(f"Added image URL to tweet: {image_url}")
                
                tweets.append(tweet_content)
        
        response_data = {
            "article_title": article_data.get("title"),
            "article_summary": article_data["summary"],
            "full_text": article_data["full_text"],
            "generated_tweets": tweets[:num_tweets],  # Ensure we only return requested number of tweets
            "metadata": article_data.get("metadata")
        }
        logger.info(f"Final response data: {response_data}")
        return response_data
        
    except Exception as e:
        logger.error(f"Error in process_url_to_twitter: {str(e)}", exc_info=True)
        raise ContentProcessingError(f"Error processing URL: {str(e)}")

async def process_article_url(url: str) -> ContentProcessingResponse:
    """Process article URL using FireCrawl and prepare content for social media"""
    try:
        # Validate URL format
        if not url or not urlparse(url).scheme:
            raise ContentProcessingError("Invalid URL format")

        # Check cache first
        cache_key = get_cache_key("article", url)
        cached_data = get_cached_data(cache_key)
        if cached_data:
            logger.info(f"Cache hit for URL: {url}")
            return ContentProcessingResponse(
                source_id=url,
                summary=cached_data["summary"],
                full_text=cached_data["full_text"],
                metadata=cached_data["metadata"]
            )

        # If not in cache, scrape the URL with FireCrawl
        try:
            scrape_result = firecrawl.scrape_url(
                url,
                params={'formats': ['markdown']}
            )
            logger.info(f"FireCrawl response: {scrape_result}")
            
            if not scrape_result:
                raise ContentProcessingError("Empty response from FireCrawl")
            
            # The markdown content is directly in the 'markdown' key
            content = scrape_result.get('markdown')
            if not content:
                raise ContentProcessingError("No markdown content found in FireCrawl response")
                
            full_text = clean_text(content)
            
            # Generate summary optimized for social media content
            summary = await generate_summary(full_text)
            
            # Extract metadata
            metadata = extract_metadata_from_response(scrape_result)
            
            # Cache the results
            data = {
                "full_text": full_text,
                "summary": summary,
                "metadata": metadata.dict()
            }
            set_cached_data(cache_key, data)
            
            return ContentProcessingResponse(
                source_id=url,
                summary=summary,
                full_text=full_text,
                metadata=metadata.dict()
            )

        except Exception as e:
            logger.error(f"Error scraping URL with FireCrawl: {str(e)}")
            raise ContentProcessingError(f"Error processing article URL: {str(e)}")

    except Exception as e:
        error_msg = f"Error processing article URL: {str(e)}"
        logger.error(error_msg)
        raise ContentProcessingError(error_msg)

async def process_arxiv_url(url: str) -> ContentProcessingResponse:
    """Process Arxiv paper URL and prepare content for social media"""
    try:
        # Extract Arxiv ID from URL
        arxiv_id = url.split('/')[-1]
        if not arxiv_id:
            raise ContentProcessingError("Invalid Arxiv URL format")

        # Check cache first
        cache_key = get_cache_key("arxiv", arxiv_id)
        cached_data = get_cached_data(cache_key)
        if cached_data:
            logger.info(f"Cache hit for Arxiv ID: {arxiv_id}")
            return ContentProcessingResponse(
                source_id=arxiv_id,
                summary=cached_data["summary"],
                full_text=cached_data["full_text"],
                metadata=cached_data["metadata"]
            )

        # If not in cache, use FireCrawl to scrape the Arxiv page
        try:
            scrape_result = firecrawl.scrape_url(
                url,
                params={'formats': ['markdown']}
            )
            logger.info(f"FireCrawl response: {scrape_result}")
            
            if not scrape_result:
                raise ContentProcessingError("Empty response from FireCrawl")
            
            # The markdown content is directly in the 'markdown' key
            content = scrape_result.get('markdown')
            if not content:
                raise ContentProcessingError("No markdown content found in FireCrawl response")
                
            full_text = clean_text(content)
            
            # Generate summary optimized for social media content
            summary = await generate_summary(full_text, is_paper=True)
            
            # Extract metadata
            metadata = {
                'paper_id': arxiv_id,
                'title': scrape_result.get('title'),
                'authors': scrape_result.get('authors', '').split(','),
                'categories': [cat.strip() for cat in scrape_result.get('categories', '').split()],
                'abstract': scrape_result.get('abstract')
            }
            
            # Cache the results
            data = {
                "full_text": full_text,
                "summary": summary,
                "metadata": metadata
            }
            set_cached_data(cache_key, data)
            
            return ContentProcessingResponse(
                source_id=arxiv_id,
                summary=summary,
                full_text=full_text,
                metadata=metadata
            )

        except Exception as e:
            logger.error(f"Error scraping URL with FireCrawl: {str(e)}")
            raise ContentProcessingError(f"Error processing Arxiv URL: {str(e)}")

    except Exception as e:
        error_msg = f"Error processing Arxiv URL: {str(e)}"
        logger.error(error_msg)
        raise ContentProcessingError(error_msg)
