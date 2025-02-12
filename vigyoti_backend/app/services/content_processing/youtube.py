from youtube_transcript_api import YouTubeTranscriptApi
from typing import Optional, Dict, List, Literal, Tuple
import re
from openai import AsyncOpenAI
import os
from ...schemas.content import YouTubeMetadata
from ...core.exceptions import ContentProcessingError
from ...core.cache import get_cache_key, get_cached_data, set_cached_data
from ...core.config import settings
from ..image_generation import generate_image_from_prompt
import logging
from ...utils.cost_calculator import CostCalculator
from ...core.settings import settings

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Configure proxy settings for YouTube transcript API
YOUTUBE_PROXIES = {"https": settings.SMARTPROXY_URL}

def extract_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from URL."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu.be\/)([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def create_twitter_prompt(
    transcript: str,
    content_type: str,
    num_tweets: int,
    additional_context: Optional[str]
) -> str:
    """Create a prompt for generating Twitter content"""
    base_prompt = f"""Based on the following YouTube video transcript, generate {num_tweets} different Twitter {'post' if num_tweets == 1 else 'posts'} that are {content_type} in nature. Each post should focus on a different aspect or insight from the video.

Transcript:
{transcript}

Guidelines based on content type:
"""

    type_guidelines = {
        "short": f"""Create {num_tweets} different concise, impactful tweets under 280 characters that:
- Capture different key insights or memorable moments from the video
- Use engaging language and tone
- Include relevant hashtags where appropriate
- Each tweet should focus on a distinct point or insight
- Separate each tweet with a double newline""",

        "thread": f"""Create a thread of {num_tweets} tweets where:
- Each tweet builds on the previous one
- The first tweet hooks the reader
- Ideas flow logically and maintain context
- Each tweet can stand alone but works better in sequence
- Format each tweet as [1/{num_tweets}], [2/{num_tweets}], etc.""",

        "quote": f"""Extract {num_tweets} different powerful quotes that:
- Capture different impactful statements or insights from the video
- Include proper attribution
- Add thoughtful reflection where appropriate
- Maintain the original context and meaning
- Separate each quote tweet with a double newline""",

        "poll": f"""Create {num_tweets} different engaging polls that:
- Ask clear, relevant questions about different aspects of the video
- Provide 2-4 distinct, meaningful options for each poll
- Encourage audience participation
- Relate directly to different key points from the content
- Separate each poll tweet with a double newline""",
        
        "long": f"""Create a single long-form post that:
- Captures the main insights and key takeaways from the video
- Uses engaging language and tone
- Includes relevant hashtags where appropriate
- Is well-structured and easy to read
- Is within the 25,000 character limit"""
    }

    prompt = base_prompt + type_guidelines[content_type]

    if additional_context:
        prompt += f"\n\nAdditional context to consider: {additional_context}"

    prompt += f"\n\nIMPORTANT: Generate exactly {num_tweets} tweets, no more, no less. Separate each tweet with a double newline."

    return prompt

async def fetch_transcript_and_summary(video_id: str) -> Dict[str, str]:
    """Fetch video transcript and generate summary."""
    try:
        # Get transcript from YouTube
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        full_transcript = " ".join([entry["text"] for entry in transcript_list])
        
        # Generate summary using OpenAI
        summary_response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that creates concise summaries."},
                {"role": "user", "content": f"Please summarize this video transcript:\n\n{full_transcript}"}
            ]
        )
        
        summary = summary_response.choices[0].message.content
        
        return {
            "video_title": "Video Title",  # You can get this from YouTube API if needed
            "video_summary": summary,
            "full_transcript": full_transcript
        }
    except Exception as e:
        logger.error(f"Error in fetch_transcript_and_summary: {str(e)}")
        raise ContentProcessingError(f"Failed to process video: {str(e)}")

async def generate_summary(transcript: str) -> Tuple[str, Dict]:
    """Generate a summary of the YouTube video transcript"""
    try:
        # Format the prompt for summary generation
        prompt = f"""Please provide a concise and informative summary of the following transcript:

        {transcript}

        Guidelines:
        1. Capture the main points and key ideas
        2. Maintain a clear and engaging tone
        3. Keep the summary focused and well-structured
        """

        # Generate summary using OpenAI
        summary_response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at creating clear and concise summaries."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        summary = summary_response.choices[0].message.content.strip()
        
        # Calculate token costs with completion object for accuracy
        gpt_costs = CostCalculator.calculate_gpt_cost(prompt, summary, completion=summary_response)
        
        return summary, gpt_costs
    except Exception as e:
        raise ContentProcessingError(f"Error generating summary: {str(e)}")

async def process_youtube_url(
    url: str,
    content_type: Literal["short", "thread", "quote", "poll", "long"],
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> Tuple[List[Dict], Dict]:
    """Process YouTube URL and generate Twitter content"""
    try:
        # Extract video ID from URL
        video_id = extract_video_id(url)
        if not video_id:
            raise ContentProcessingError("Invalid YouTube URL")
        
        # Get transcript and summary
        data = await fetch_transcript_and_summary(video_id)
        summary = data["video_summary"]
        summary_costs = data["gpt_costs"]
        
        # Generate tweets
        tweets, tweet_costs = await process_text_to_twitter(
            text=summary,
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            generate_image=generate_image,
            is_premium=is_premium
        )
        
        # Combine costs from summary and tweet generation
        total_costs = {}
        for key in ["input_tokens", "output_tokens", "input_cost", "output_cost", "total_cost"]:
            total_costs[key] = summary_costs.get(key, 0) + tweet_costs.get(key, 0)
        
        return tweets, total_costs
    
    except Exception as e:
        logger.error(f"Error processing YouTube URL: {str(e)}")
        raise ContentProcessingError(f"Error processing YouTube URL: {str(e)}")

async def generate_twitter_content(
    transcript: str,
    summary: str,
    content_type: str,
    num_tweets: int,
    additional_context: Optional[str] = None,
    is_premium: bool = False
) -> List[str]:
    """Generate Twitter content from video transcript."""
    try:
        # Use higher max_tokens for premium long content
        max_tokens = 7000 if is_premium and content_type == "long" else 1000

        if content_type == "long" and is_premium:
            # For premium long posts, create original content inspired by the video
            prompt = f"""Using the ideas and concepts from this video content as inspiration, create {num_tweets} engaging, comprehensive, and conversational {'piece' if num_tweets == 1 else 'pieces'}. Don't describe or reference the video itself - instead, create original content that explores the topics, concepts, and ideas presented.

The content should be your own original take on these topics:
{summary}

Title Guidelines:
- Each title MUST follow this EXACT format: "Title Text Here"
- Title text must be between 30-35 characters (excluding the number prefix)
- Keep titles professional and clear
- Avoid special characters, emojis, or excessive punctuation in titles
- Each title should be a hook but maintain consistent length with others
- Titles should be complete phrases, not fragments

Content Guidelines:
- Create original, valuable content that stands on its own
- Don't describe or reference the video or its content directly
- Write in a natural, flowing conversational style
- Share insights, perspectives, and practical applications
- Break down complex ideas into digestible sections
- Include relevant examples and real-world applications
- Weave in your own insights and expert perspectives
- You MUST use formatting (paragraphs, emojis) to enhance readability
- You MUST use bold or italics or insert emojis to emphasize key points
- Include relevant hashtags where they fit naturally
- Each piece should be between 1,000 and 25,000 characters
- Each piece should explore different aspects or angles of the topics

Style Notes:
- Write as if you're having an engaging conversation with the reader
- Use transitional phrases to connect ideas smoothly
- Share original insights and unique perspectives
- Make it engaging and shareable while being informative
- Use emojis sparingly and naturally, not forcing them

Additional Context:
{additional_context if additional_context else 'Focus on providing valuable insights and perspectives on these topics.'}

Please generate {num_tweets} separate {'piece' if num_tweets == 1 else 'pieces'}, each exploring different aspects of these topics. Start each piece with the title format specified above, then separate pieces with [NEW_CONTENT] marker."""

            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at creating engaging, conversational long-form content that feels natural and flowing, while being informative and valuable."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=max_tokens
            )

            # Get the content and clean it up
            content = response.choices[0].message.content.strip()
            
            # Split content into separate pieces
            pieces = content.split('[NEW_CONTENT]')
            
            # Clean and process each piece
            processed_pieces = []
            for piece in pieces:
                if piece.strip():
                    # Clean up the piece
                    cleaned_piece = piece.strip()
                    # Remove any "Analysis:" or similar prefixes
                    cleaned_piece = re.sub(r'^(Analysis|Section|Part)\s*\d*:?\s*', '', cleaned_piece, flags=re.MULTILINE)
                    
                    # Ensure minimum length
                    if len(cleaned_piece) >= 1000:
                        # Enforce maximum length while keeping content coherent
                        if len(cleaned_piece) > 25000:
                            cleaned_piece = cleaned_piece[:25000]
                            # Try to find a proper sentence ending to cut at
                            last_period = cleaned_piece.rfind('.')
                            if last_period > 1000:  # Only cut at period if we still have >1000 chars
                                cleaned_piece = cleaned_piece[:last_period + 1]
                        processed_pieces.append(cleaned_piece)
            
            # Ensure we have the requested number of pieces
            if len(processed_pieces) < num_tweets:
                logger.warning(f"Generated only {len(processed_pieces)} pieces, regenerating...")
                return await generate_twitter_content(transcript, summary, content_type, num_tweets, additional_context, is_premium)
            
            # If we have too many pieces, take only the requested number
            processed_pieces = processed_pieces[:num_tweets]
            
            return processed_pieces

        elif content_type == "short":
            prompt = f"""Generate {num_tweets} impactful and informative tweets from this video content. Each tweet should be a complete, standalone insight.

Summary of the Content:
{summary}

Key Points from Transcript:
{transcript[:1500]}...

Requirements for Each Tweet:
1. Length and Format:
   - Maximum 280 characters per tweet
   - Each tweet must be complete and meaningful on its own
   - Do not include any numbering or prefixes

2. Content Guidelines:
   - Focus on one clear, specific point per tweet
   - Include actual facts, numbers, or quotes when relevant
   - Make it informative yet engaging
   - Avoid vague or generic statements
   - Use active voice and direct language

3. Style Guidelines:
   - Start with 1-2 relevant emojis that match the content
   - Include 1-2 relevant hashtags at the end
   - Use professional but conversational tone
   - Make it shareable and engaging
   - Ensure each tweet provides value to the reader

4. Structure for Each Tweet:
   [Relevant Emoji(s)] → [Key Point/Insight] → [Supporting Detail if space allows] → [Relevant Hashtag(s)]

Additional Context to Consider:
{additional_context if additional_context else 'Focus on the most impactful insights from the content.'}

Generate {num_tweets} unique, high-quality tweets, each focusing on a different aspect of the content."""

        else:
            # For threads and other types
            is_thread = content_type == "thread"
            prompt = f"""Based on this video content, generate {num_tweets} {'tweet' if num_tweets == 1 else 'tweets'}.

Summary: {summary}

Full Transcript: {transcript}

Content Type: {content_type}
Number of Tweets: {num_tweets}
Tweet Style: {'Thread' if is_thread else 'Independent Tweets'}

{additional_context if additional_context else ''}

Guidelines:
- Keep tweets within 280 characters
- Include relevant hashtags where appropriate
- Maintain engaging tone and clarity
- Use appropriate emojis to enhance the message (1-3 emojis per tweet)
- Place emojis at the start of key points or alongside important terms
- Ensure emojis are relevant to the content (e.g., 🤖 for AI, 📊 for data, 💡 for insights)

{'Thread-specific guidelines:' if is_thread else 'Independent tweets guidelines:'}
{'''- Make tweets flow logically from one to the next
- Each tweet should build upon the previous one
- Maintain narrative continuity throughout the thread
- First tweet should hook the reader
- Last tweet should provide a strong conclusion
- Use consistent emoji themes throughout the thread''' if is_thread else '''- Each tweet should be completely independent
- Cover different aspects or insights from the content
- Each tweet should make sense on its own
- No need for continuity between tweets
- Use distinct emoji sets for each tweet'''}

Generate the tweets:"""

        # Generate content for non-premium long posts
        if not (content_type == "long" and is_premium):
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at creating engaging Twitter content."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=max_tokens
            )

            content = response.choices[0].message.content.strip()
            
            # Split content into tweets
            tweets = []
            for tweet in content.split('\n\n'):
                if tweet.strip():
                    # Clean up the tweet text
                    clean_tweet = re.sub(r'^[^A-Za-z0-9]*', '', tweet.strip())
                    if clean_tweet:
                        tweets.append(clean_tweet[:280])  # Enforce character limit
            
            # Ensure we have exactly the requested number of tweets
            if len(tweets) > num_tweets:
                tweets = tweets[:num_tweets]
            while len(tweets) < num_tweets:
                tweets.append(f"Additional insights from the video: {summary[:100]}...")
            
            return tweets

    except Exception as e:
        logger.error(f"Error generating Twitter content: {str(e)}")
        raise ContentProcessingError(f"Failed to generate Twitter content: {str(e)}")

async def process_text_to_twitter(
    text: str,
    content_type: str,
    num_tweets: int,
    additional_context: Optional[str],
    generate_image: bool,
    is_premium: bool
) -> Tuple[List[Dict], Dict]:
    """Process text to Twitter content"""
    try:
        # Generate Twitter content
        tweets_content = await generate_twitter_content(
            transcript=text,
            summary=text[:1000],  # Use first 1000 chars as summary
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            is_premium=is_premium
        )
        
        # Create tweet objects
        tweets_list = []
        for i, tweet_text in enumerate(tweets_content):
            tweet_content = {
                "tweet_text": tweet_text,
                "is_thread": num_tweets > 1,
                "thread_position": i if num_tweets > 1 else None,
                "image_url": None,
                "is_premium_content": is_premium and content_type == "long"
            }
            
            # Generate image for the first tweet if requested
            if generate_image and i == 0:
                logger.info("Generating image for tweet...")
                image_url = await generate_image_from_prompt(
                    prompt=text,
                    aspect_ratio="16:9"  # Default aspect ratio, you can adjust as needed
                )
                if image_url:
                    tweet_content["image_url"] = image_url
                    logger.info(f"Added image URL to tweet: {image_url}")
            
            tweets_list.append(tweet_content)
        
        return tweets_list, {"total_cost": 0.001}  # Add proper cost calculation

    except Exception as e:
        logger.error(f"Error in process_text_to_twitter: {str(e)}")
        raise ContentProcessingError(f"Failed to process text to Twitter: {str(e)}")

async def generate_additional_tweets(
    transcript: str,
    content_type: str,
    remaining_tweets: int,
    previous_content: str,
    additional_context: Optional[str]
) -> Tuple[str, Dict]:
    """Generate additional tweets if needed"""
    try:
        additional_response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a social media expert who creates engaging Twitter content."},
                {"role": "user", "content": f"Generate {remaining_tweets} more tweets in the same style, focusing on different aspects of the content that haven't been covered yet."}
            ]
        )
        additional_tweets = additional_response.choices[0].message.content.strip()
        
        # Calculate token costs
        gpt_costs = CostCalculator.calculate_gpt_cost(transcript, additional_tweets, completion=additional_response)
        
        return additional_tweets, gpt_costs
    except Exception as e:
        raise ContentProcessingError(f"Error generating additional tweets: {str(e)}")
