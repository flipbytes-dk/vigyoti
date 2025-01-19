import os
from typing import Optional, BinaryIO
import whisper
from fastapi import UploadFile, HTTPException
from datetime import datetime

from ..schemas.audio import AudioInputCreate, AudioStatus
from ..models.audio import AudioInput
from ..core.settings import get_settings

settings = get_settings()

class AudioService:
    def __init__(self):
        self.model = whisper.load_model("base")
        self.supported_formats = [".mp3", ".wav", ".m4a", ".ogg"]

    async def create_audio_input(self, audio_data: AudioInputCreate) -> AudioInput:
        """Create a new audio input entry"""
        audio_input = AudioInput(
            title=audio_data.title,
            description=audio_data.description,
            language=audio_data.language,
            source_type=audio_data.source_type,
            status=AudioStatus.PENDING
        )
        # Save to database
        return audio_input

    async def process_audio_file(self, file: UploadFile, audio_input: AudioInput) -> AudioInput:
        """Process uploaded audio file"""
        # Validate file format
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in self.supported_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Supported formats: {', '.join(self.supported_formats)}"
            )

        try:
            # Update status to processing
            audio_input.status = AudioStatus.PROCESSING
            
            # Save file temporarily
            temp_path = f"temp_{audio_input.id}{file_ext}"
            with open(temp_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)

            # Transcribe audio
            result = self.model.transcribe(temp_path)
            
            # Update audio input with transcription
            audio_input.transcription = result["text"]
            audio_input.status = AudioStatus.COMPLETED
            audio_input.updated_at = datetime.utcnow()

            # Cleanup
            os.remove(temp_path)

            return audio_input

        except Exception as e:
            audio_input.status = AudioStatus.FAILED
            audio_input.updated_at = datetime.utcnow()
            raise HTTPException(status_code=500, detail=str(e))

    async def process_audio_stream(self, audio_stream: BinaryIO, audio_input: AudioInput) -> AudioInput:
        """Process audio from stream (e.g., microphone input)"""
        try:
            # Update status to processing
            audio_input.status = AudioStatus.PROCESSING
            
            # Save stream temporarily
            temp_path = f"temp_{audio_input.id}.wav"
            with open(temp_path, "wb") as buffer:
                buffer.write(audio_stream.read())

            # Transcribe audio
            result = self.model.transcribe(temp_path)
            
            # Update audio input with transcription
            audio_input.transcription = result["text"]
            audio_input.status = AudioStatus.COMPLETED
            audio_input.updated_at = datetime.utcnow()

            # Cleanup
            os.remove(temp_path)

            return audio_input

        except Exception as e:
            audio_input.status = AudioStatus.FAILED
            audio_input.updated_at = datetime.utcnow()
            raise HTTPException(status_code=500, detail=str(e))
