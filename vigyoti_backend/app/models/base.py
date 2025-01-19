from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, DateTime
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    """Base class for all models"""
    pass

class TimestampedModel(Base):
    """Base model with created_at and updated_at timestamps"""
    __abstract__ = True
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now()) 