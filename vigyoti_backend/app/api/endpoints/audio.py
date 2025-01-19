from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import List
from ...schemas.audio import AudioInputCreate, AudioInputResponse
from ...services.audio_service import AudioService

router = APIRouter()
audio_service = AudioService()

@router.post("/upload", response_model=AudioInputResponse)
async def upload_audio(
    title: str,
    file: UploadFile = File(...),
    description: str = None,
    language: str = "en"
):
    """Upload and process an audio file"""
    audio_data = AudioInputCreate(
        title=title,
        description=description,
        language=language,
        source_type="upload"
    )
    
    # Create audio input entry
    audio_input = await audio_service.create_audio_input(audio_data)
    
    # Process the audio file
    processed_audio = await audio_service.process_audio_file(file, audio_input)
    
    return AudioInputResponse.from_orm(processed_audio)

@router.post("/stream", response_model=AudioInputResponse)
async def stream_audio(
    audio_data: AudioInputCreate,
    audio_stream: UploadFile = File(...)
):
    """Process audio from a stream (e.g., microphone input)"""
    # Create audio input entry
    audio_input = await audio_service.create_audio_input(audio_data)
    
    # Process the audio stream
    processed_audio = await audio_service.process_audio_stream(audio_stream.file, audio_input)
    
    return AudioInputResponse.from_orm(processed_audio)
