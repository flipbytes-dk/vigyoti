from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from ...schemas.audio import AudioToTwitterRequest, AudioProcessingResponse
from ...services.audio_service import AudioService
from ...services.twitter_content_service import TwitterContentService

router = APIRouter(prefix="/api/v1/content-sources")
audio_service = AudioService()
twitter_service = TwitterContentService()

@router.post("/audio-to-twitter", response_model=AudioProcessingResponse)
async def process_audio_to_twitter(
    file: UploadFile = File(...),
    content_type: str = Form(...),
    num_tweets: int = Form(1),
    additional_context: Optional[str] = Form(None),
    generate_image: bool = Form(False),
    is_premium: bool = Form(False)
):
    """Process audio file and generate Twitter content"""
    try:
        # Create request object
        request = AudioToTwitterRequest(
            content_type=content_type,
            num_tweets=num_tweets,
            additional_context=additional_context,
            generate_image=generate_image,
            is_premium=is_premium
        )

        # First transcribe the audio
        audio_input = await audio_service.create_audio_input({
            "title": file.filename,
            "source_type": "upload"
        })
        
        processed_audio = await audio_service.process_audio_file(file, audio_input)
        
        if not processed_audio.transcription:
            return AudioProcessingResponse(
                status="failed",
                error="Failed to transcribe audio"
            )

        # Generate Twitter content
        twitter_content = await twitter_service.generate_tweets(
            processed_audio.transcription,
            request
        )

        return AudioProcessingResponse(
            status="success",
            twitter_content=twitter_content
        )

    except Exception as e:
        return AudioProcessingResponse(
            status="failed",
            error=str(e)
        )
