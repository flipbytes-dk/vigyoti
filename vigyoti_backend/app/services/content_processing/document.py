import os
import tempfile
from typing import BinaryIO, Optional, List, Tuple, Dict
from fastapi import UploadFile
import PyPDF2
import docx
import mammoth
from openai import OpenAI
from ...schemas.twitter import TwitterContent as TwitterContentSchema
from ...schemas.content import DocumentMetadata, ContentProcessingResponse
from ...core.exceptions import ContentProcessingError, FileTypeError, FileSizeError
from ...core.prompts import DOCUMENT_EXTRACTION_PROMPT
from ...core.config import settings
from ...utils.cost_calculator import CostCalculator
import logging

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

ALLOWED_DOCUMENT_TYPES = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt'
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

async def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise ContentProcessingError(f"Error extracting text from PDF: {str(e)}")

async def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(file_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise ContentProcessingError(f"Error extracting text from DOCX: {str(e)}")

async def extract_text_from_doc(file_path: str) -> str:
    """Extract text from DOC file using mammoth"""
    try:
        with open(file_path, "rb") as docx_file:
            result = mammoth.convert_to_text(docx_file)
            return result.value.strip()
    except Exception as e:
        raise ContentProcessingError(f"Error extracting text from DOC: {str(e)}")

async def extract_key_information(text: str) -> Tuple[str, Dict]:
    """Extract key information from document text using OpenAI"""
    try:
        # Format the extraction prompt
        extraction_prompt = DOCUMENT_EXTRACTION_PROMPT.format(content=text[:4000])
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at extracting key information from documents and preparing it for social media content creation."
                },
                {"role": "user", "content": extraction_prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        extracted_text = response.choices[0].message.content.strip()
        
        # Calculate extraction costs
        extraction_costs = CostCalculator.calculate_gpt_cost(extraction_prompt, extracted_text, completion=response)
        
        return extracted_text, extraction_costs
    except Exception as e:
        raise ContentProcessingError(f"Error extracting key information: {str(e)}")

async def generate_social_summary(text: str) -> str:
    """Generate a summary optimized for social media content"""
    try:
        summary_prompt = """
Create a concise summary of this document that would be engaging on social media:
1. Identify the most shareable insights or findings
2. Extract quotable statistics or facts
3. Highlight unique or surprising elements
4. Frame the content for social media engagement
5. Include relevant industry context

Content:
{content}
""".format(content=text[:2000])  # Use first 2000 chars for summary

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at creating engaging social media content from documents."
                },
                {"role": "user", "content": summary_prompt}
            ],
            temperature=0.5,
            max_tokens=300
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise ContentProcessingError(f"Error generating social summary: {str(e)}")

async def generate_twitter_content(
    document_text: str,  # Keep the original parameter name
    content_type: str,
    num_tweets: int = 1,
    additional_context: Optional[str] = None,
    generate_image: bool = False,
    is_premium: bool = False
) -> Tuple[List[Dict], Dict]:
    """Generate X (formerly Twitter) content from document text"""
    try:
        # Format the prompt
        twitter_prompt = f"""Based on the following document content, generate {num_tweets} engaging Twitter post{'s' if num_tweets > 1 else ''} that {'are' if num_tweets > 1 else 'is'} {content_type} in nature.
        
        Document Content:
        {document_text}
        
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
                {"role": "user", "content": twitter_prompt}
            ],
            temperature=0.8,
            max_tokens=max_tokens
        )
        
        # Parse the generated content
        generated_content = response.choices[0].message.content.strip()
        
        # Calculate Twitter content generation costs
        twitter_costs = CostCalculator.calculate_gpt_cost(twitter_prompt, generated_content, completion=response)
        
        tweets = []
        
        # Process content based on type and premium status
        if content_type == "long" and is_premium:
            # For premium long posts, treat the entire content as one post
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
                try:
                    from ..image_generation import generate_image_from_text
                    image_url = await generate_image_from_text(document_text[:500])
                    if image_url:
                        tweet_content["image_url"] = image_url
                        logger.info(f"Added image URL to premium post: {image_url}")
                except Exception as e:
                    logger.error(f"Error generating image: {str(e)}")
            
            tweets.append(tweet_content)
        else:
            # For regular posts, split by newlines and enforce 280 character limit
            for i, line in enumerate(generated_content.split('\n\n')):
                if line.strip():
                    tweet_content = {
                        "tweet_text": line.strip()[:280],
                        "is_thread": num_tweets > 1,
                        "thread_position": i + 1 if num_tweets > 1 else None,
                        "image_url": None,
                        "is_premium_content": False
                    }
                    
                    # Generate image for the first tweet if requested
                    if generate_image and i == 0:
                        logger.info("Generating image for first tweet...")
                        try:
                            from ..image_generation import generate_image_from_text
                            image_url = await generate_image_from_text(document_text[:500])
                            if image_url:
                                tweet_content["image_url"] = image_url
                                logger.info(f"Added image URL to tweet: {image_url}")
                        except Exception as e:
                            logger.error(f"Error generating image: {str(e)}")
                    
                    tweets.append(tweet_content)
        
        return tweets[:num_tweets], twitter_costs
    
    except Exception as e:
        logger.error(f"Error processing document to Twitter content: {str(e)}", exc_info=True)
        raise ContentProcessingError(f"Error processing document to Twitter content: {str(e)}")

async def process_document(file: UploadFile) -> ContentProcessingResponse:
    """Process document file and prepare content for social media"""
    try:
        # Validate file type
        if file.content_type not in ALLOWED_DOCUMENT_TYPES:
            raise FileTypeError(f"Unsupported file type. Allowed types: {', '.join(ALLOWED_DOCUMENT_TYPES.values())}")
        
        # Validate file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to start
        
        if file_size > MAX_FILE_SIZE:
            raise FileSizeError(f"File size exceeds maximum limit of {MAX_FILE_SIZE/1024/1024}MB")
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ALLOWED_DOCUMENT_TYPES[file.content_type]}") as temp_file:
            # Write uploaded file to temporary file
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()
            
            # Extract text based on file type
            if file.content_type == 'application/pdf':
                text = await extract_text_from_pdf(temp_file.name)
            elif file.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                text = await extract_text_from_docx(temp_file.name)
            elif file.content_type == 'application/msword':
                text = await extract_text_from_doc(temp_file.name)
            elif file.content_type == 'text/plain':
                with open(temp_file.name, 'r', encoding='utf-8') as f:
                    text = f.read().strip()
            else:
                text = ""
        
        # Clean up temporary file
        os.unlink(temp_file.name)
        
        if not text:
            raise ContentProcessingError("No text could be extracted from the document")
        
        # Extract key information and prepare for social media
        processed_text, extraction_costs = await extract_key_information(text)
        
        # Generate social media optimized summary
        summary = await generate_social_summary(processed_text)
        
        # Create metadata
        metadata = DocumentMetadata(
            file_name=file.filename,
            file_size=file_size,
            file_type=ALLOWED_DOCUMENT_TYPES[file.content_type],
            word_count=len(text.split())
        )
        
        return ContentProcessingResponse(
            source_id=file.filename,
            summary=summary,
            full_text=processed_text,
            metadata=metadata.dict(),
            costs=extraction_costs
        )
    
    except Exception as e:
        error_msg = f"Error processing document: {str(e)}"
        raise ContentProcessingError(error_msg)
