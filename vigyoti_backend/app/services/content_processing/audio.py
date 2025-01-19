import os
import tempfile
from typing import BinaryIO, List, Optional, Dict, Union
from pydantic import BaseModel
from openai import AsyncOpenAI
from fastapi import UploadFile
from mutagen import File as MutagenFile
from mutagen.wave import WAVE
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
from ...schemas.content import AudioMetadata, AudioToTwitterResponse
from ...schemas.twitter import TwitterContent as TwitterContentSchema
from ...schemas.cost import CostInfo
from ...core.exceptions import ContentProcessingError, FileTypeError, FileSizeError
from ...core.prompts import TRANSCRIPTION_CLEANUP_PROMPT, TWITTER_CONTENT_PROMPT, TWITTER_CONTENT_GUIDELINES
from ...core.config import settings
from ...core.cache import get_cache_key, get_cached_data, set_cached_data
from ...utils.cost_calculator import CostCalculator
import hashlib
from ..image_generation import generate_image_from_text
import logging
import aiofiles
import httpx
import re

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

ALLOWED_AUDIO_TYPES = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/x-m4a': 'm4a',
    'audio/mpeg3': 'mp3',
    'audio/x-mpeg-3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm'
}

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

def get_audio_hash(content: bytes) -> str:
    """Generate a unique hash for the audio content"""
    return hashlib.sha256(content).hexdigest()

async def clean_transcription(raw_transcript: str) -> str:
    """Clean and format transcription using OpenAI"""
    try:
        # Format the cleanup prompt
        cleanup_prompt = TRANSCRIPTION_CLEANUP_PROMPT.format(content=raw_transcript)
        
        # Call OpenAI API
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at cleaning up audio transcriptions and preparing them for social media content creation."
                },
                {"role": "user", "content": cleanup_prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent cleanup
            max_tokens=len(raw_transcript.split()) * 2  # Allow for some expansion
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise ContentProcessingError(f"Error cleaning transcription: {str(e)}")

async def generate_twitter_content(
    text: str,
    content_type: str,
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> tuple[List[Dict], dict]:
    """Generate Twitter content from text"""
    try:
        logger.info(f"[generate_twitter_content] Starting generation with num_tweets={num_tweets}")
        logger.info(f"Generating {num_tweets} tweet{'s' if num_tweets > 1 else ''} from text")
        is_are = "are" if num_tweets > 1 else "is"
        plural_suffix = "s" if num_tweets > 1 else ""
        
        # Get content type guidelines
        content_type_guidelines = TWITTER_CONTENT_GUIDELINES.get(content_type, TWITTER_CONTENT_GUIDELINES["short"])
        
        if content_type == "short":
            prompt = f"""Generate {num_tweets} impactful and informative tweets from this audio transcription. Each tweet should be a complete, standalone insight.

Content:
{text}

Requirements for Each Tweet:
1. Length and Format:
   - Maximum 280 characters per tweet
   - Each tweet must be complete and meaningful on its own
   - Start each tweet with "Tweet X:" (where X is the number)

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

Generate EXACTLY {num_tweets} unique, high-quality tweets, each focusing on a different aspect of the content."""
        else:
            is_thread = content_type == "thread"
            prompt = f"""Based on this audio transcription, generate {num_tweets} {'tweet' if num_tweets == 1 else 'tweets'}.

Content: {text}

Content Type: {content_type}
Number of Tweets: {num_tweets}
Tweet Style: {'Thread' if is_thread else 'Independent Tweets'}

{additional_context if additional_context else ''}

Guidelines:
- For short tweets, keep within 280 characters
- Include relevant hashtags where appropriate
- Maintain engaging tone and clarity
- Each tweet should be on a new line starting with "Tweet X:" (where X is the number)
- Do not include any other separators or markers
- Use appropriate emojis to enhance the message (1-3 emojis per tweet)
- Place emojis at the start of key points or alongside important terms
- Ensure emojis are relevant to the content (e.g., 🤖 for AI, 📊 for data, 💡 for insights)

{'Thread-specific guidelines:' if is_thread else 'Independent tweets guidelines:'}
{'''- Make tweets flow logically from one to the next
- Each tweet should build upon the previous one
- Maintain narrative continuity throughout the thread
- First tweet should hook the reader with engaging emoji
- Last tweet should provide a strong conclusion
- Use consistent emoji themes throughout the thread''' if is_thread else '''- Each tweet should be completely independent
- Cover different aspects or insights from the content
- Each tweet should make sense on its own
- No need for continuity between tweets
- Avoid references to other tweets
- Use distinct emoji sets for each tweet to match its specific topic'''}

Generate EXACTLY {num_tweets} tweets:"""
        
        # Get response from GPT
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a social media expert who creates engaging content for Twitter/X."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000 if is_premium else 500
        )
        
        # Extract tweets from response
        content = response.choices[0].message.content.strip()
        logger.info(f"[generate_twitter_content] Raw GPT response content: {content[:200]}...")
        
        # Parse numbered tweets
        tweet_pattern = r"Tweet (\d+):(.*?)(?=Tweet \d+:|$)"
        matches = re.finditer(tweet_pattern, content, re.DOTALL)
        
        tweets_dict = {}
        for match in matches:
            number = int(match.group(1))
            tweet_text = match.group(2).strip()
            tweets_dict[number] = tweet_text
        
        logger.info(f"[generate_twitter_content] Found {len(tweets_dict)} tweets in GPT response")
        
        # Ensure tweets are in correct order and we have exactly num_tweets
        tweets_text = [tweets_dict.get(i+1, f"Generated tweet {i+1} from audio content") for i in range(num_tweets)]
        logger.info(f"[generate_twitter_content] Final tweets_text array length: {len(tweets_text)}")
        
        # Calculate GPT costs using completion object
        gpt_costs = CostCalculator.calculate_gpt_cost(prompt, content, completion=response)
        
        tweets = []
        for i, tweet_text in enumerate(tweets_text):
            tweet_dict = {
                "tweet_text": tweet_text,
                "is_thread": num_tweets > 1,
                "thread_position": i + 1 if num_tweets > 1 else None,
                "image_url": None,
                "is_premium_content": is_premium
            }
            
            # Generate image for the first tweet if requested
            if generate_image and i == 0:
                logger.info("Generating image for first tweet...")
                image_url = await generate_image_from_text(text[:500])
                if image_url:
                    tweet_dict["image_url"] = image_url
                    logger.info(f"Added image URL to tweet: {image_url}")
            
            tweets.append(tweet_dict)
        
        logger.info(f"Generated {len(tweets)} tweets")
        return tweets, gpt_costs
    
    except Exception as e:
        logger.error(f"Error generating X content: {str(e)}")
        raise ContentProcessingError(f"Error generating X content: {str(e)}")

class AudioMetadata(BaseModel):
    duration: Optional[float] = None
    format: Optional[str] = None
    size: Optional[int] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None

def get_audio_metadata(file_path: str) -> AudioMetadata:
    """Extract metadata from audio file"""
    try:
        audio = MutagenFile(file_path)
        metadata = AudioMetadata()
        
        if isinstance(audio, (WAVE, MP3, MP4)):
            metadata.duration = audio.info.length
            metadata.format = audio.mime[0].split('/')[-1]
            metadata.size = os.path.getsize(file_path)
            metadata.sample_rate = audio.info.sample_rate
            metadata.channels = audio.info.channels
        
        return metadata
    except Exception as e:
        logger.error(f"Error extracting audio metadata: {str(e)}")
        return AudioMetadata()

def calculate_whisper_cost(duration_seconds: float) -> float:
    """Calculate cost for Whisper transcription"""
    # Convert seconds to minutes and round up to nearest minute
    duration_minutes = (duration_seconds + 59) // 60
    # Whisper cost is $0.006 per minute
    return duration_minutes * 0.006

async def transcribe_audio(file_path: str, content_type: str = None) -> str:
    """Transcribe audio using OpenAI's Whisper API"""
    try:
        # Generate cache key based on file content
        with open(file_path, 'rb') as f:
            content = f.read()
            file_hash = get_audio_hash(content)
            cache_key = get_cache_key("whisper-transcription", file_hash)
        
        # Check cache for transcription
        cached_transcript = get_cached_data(cache_key)
        if cached_transcript:
            logger.info("Using cached Whisper transcription")
            return cached_transcript
        
        # If not in cache, transcribe using Whisper
        logger.info("Transcribing audio with Whisper API")
        with open(file_path, 'rb') as audio_file:
            transcript = await client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1"
            )
            
        # Cache the transcription result
        set_cached_data(cache_key, transcript.text)
        
        return transcript.text
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise ContentProcessingError(f"Error transcribing audio: {str(e)}")

class AudioProcessingResult(BaseModel):
    audio_transcript: str
    cleaned_transcript: str
    generated_tweets: List[TwitterContentSchema]
    metadata: Optional[Dict] = None
    cost_info: CostInfo

async def process_audio_file(
    file: UploadFile,
    content_type: str = "short",
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> AudioToTwitterResponse:
    try:
        logger.info(f"[process_audio_file] Received request with num_tweets={num_tweets}, content_type={content_type}")
        # Validate file type
        if file.content_type not in ALLOWED_AUDIO_TYPES:
            logger.error(f"Invalid file type: {file.content_type}. Allowed types: {list(ALLOWED_AUDIO_TYPES.keys())}")
            raise FileTypeError(f"Unsupported file type. Allowed types: {', '.join(ALLOWED_AUDIO_TYPES.values())}")
        
        # Create a temporary file to store the uploaded content
        content = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            temp_file.write(content)
            temp_file.flush()
        
        # Get file metadata
        metadata = get_audio_metadata(temp_file.name)
        logger.info(f"Audio metadata: {metadata}")
        
        # Calculate Whisper cost
        whisper_duration_minutes = metadata.duration / 60 if metadata.duration else None
        whisper_cost = calculate_whisper_cost(metadata.duration) if metadata.duration else None
        logger.info(f"Whisper cost calculation: duration={metadata.duration}s, cost=${whisper_cost}")
        
        # Transcribe audio using Whisper
        transcript = await transcribe_audio(temp_file.name, content_type=file.content_type)
        
        # Clean up temporary file
        os.unlink(temp_file.name)
        
        # Clean up transcription
        cleaned_transcript = await clean_transcription(transcript)
        
        # Generate tweets
        logger.info(f"[process_audio_file] Calling generate_twitter_content with num_tweets={num_tweets}")
        tweets, gpt_costs = await generate_twitter_content(
            text=cleaned_transcript,
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            generate_image=generate_image,
            is_premium=is_premium
        )
        logger.info(f"[process_audio_file] Received {len(tweets)} tweets from generate_twitter_content")
        
        # Create TwitterContent objects from dictionaries
        tweet_objects = []
        for tweet_dict in tweets:
            tweet_obj = TwitterContentSchema(
                tweet_text=tweet_dict["tweet_text"],
                is_thread=tweet_dict["is_thread"],
                thread_position=tweet_dict["thread_position"],
                image_url=tweet_dict["image_url"],
                is_premium_content=tweet_dict["is_premium_content"]
            )
            tweet_objects.append(tweet_obj.model_dump())
        
        # Create response
        response = AudioToTwitterResponse(
            audio_transcript=transcript,
            cleaned_transcript=cleaned_transcript,
            generated_tweets=tweet_objects,
            metadata=metadata.dict() if metadata else None,
            cost_info=CostInfo(
                input_tokens=gpt_costs["input_tokens"],
                output_tokens=gpt_costs["output_tokens"],
                input_cost=gpt_costs["input_cost"],
                output_cost=gpt_costs["output_cost"],
                whisper_duration_minutes=whisper_duration_minutes,
                whisper_cost=whisper_cost,
                total_cost=(gpt_costs["total_cost"] or 0) + (whisper_cost or 0)
            )
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Error processing audio file: {str(e)}")
        raise ContentProcessingError(f"Error processing audio file: {str(e)}")

async def process_m3u8_url(url: str) -> AudioToTwitterResponse:
    """Process M3U8 URL and prepare content for social media"""
    try:
        # TODO: Implement M3U8 processing
        # 1. Download M3U8 stream
        # 2. Convert to audio
        # 3. Process with Whisper
        # For now, raise not implemented
        raise NotImplementedError("M3U8 processing not yet implemented")
        
    except Exception as e:
        error_msg = f"Error processing M3U8 URL: {str(e)}"
        raise ContentProcessingError(error_msg)
