from sqlalchemy import Column, String, Float, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
import uuid
from ..schemas.audio import AudioStatus
from .base import Base

class AudioInput(Base):
    __tablename__ = "audio_inputs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text)
    language = Column(String(10), default="en")
    source_type = Column(String, nullable=False)  # upload/recording/stream
    duration = Column(Float)
    status = Column(SQLEnum(AudioStatus), nullable=False, default=AudioStatus.PENDING)
    transcription = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
