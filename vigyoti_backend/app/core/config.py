from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import firebase_admin
from firebase_admin import credentials

class Settings(BaseSettings):
    # API Keys
    OPENAI_API_KEY: str
    YOUTUBE_API_KEY: Optional[str] = None
    FIRECRAWL_API_KEY: Optional[str] = None
    REPLICATE_API_TOKEN: Optional[str] = None
    PHOENIX_API_KEY: Optional[str] = None
    
    # Database
    DATABASE_URL: str
    
    # Stripe Configuration
    STRIPE_SECRET_KEY: str
    STRIPE_PUBLISHABLE_KEY: str
    
    # Firebase Configuration
    FIREBASE_PROJECT_ID: str = "vigyoti-dev"
    FIREBASE_PRIVATE_KEY: str
    FIREBASE_CLIENT_EMAIL: str
    
    # OpenAI Configuration
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Frontend Configuration
    NEXT_PUBLIC_API_URL: Optional[str] = "http://localhost:8000"
    
    # Redis Configuration
    REDIS_HOST: Optional[str] = "localhost"
    REDIS_PORT: Optional[int] = 6379
    REDIS_DB: Optional[int] = 0
    REDIS_PASSWORD: Optional[str] = None
    CACHE_TTL: Optional[int] = 604800  # 7 days in seconds
    
    # Proxy Configuration
    SMARTPROXY_USERNAME: Optional[str] = None
    SMARTPROXY_PASSWORD: Optional[str] = None
    SMARTPROXY_HOST: str = "gate.smartproxy.com"
    SMARTPROXY_PORT: int = 10001
    
    # Twitter Configuration
    TWITTER_CLIENT_ID: Optional[str] = None
    TWITTER_CLIENT_SECRET: Optional[str] = None
    TWITTER_CALLBACK_URL: Optional[str] = None

    @property
    def SMARTPROXY_URL(self) -> Optional[str]:
        if self.SMARTPROXY_USERNAME and self.SMARTPROXY_PASSWORD:
            return f"http://{self.SMARTPROXY_USERNAME}:{self.SMARTPROXY_PASSWORD}@{self.SMARTPROXY_HOST}:{self.SMARTPROXY_PORT}"
        return None

    @property
    def SMARTPROXY_PROXIES(self) -> dict:
        if url := self.SMARTPROXY_URL:
            return {
                'http': url,
                'https': url
            }
        return {}

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "allow"  # This allows extra fields in the environment variables

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()

# Initialize Firebase Admin
try:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": settings.FIREBASE_PROJECT_ID,
        "private_key": settings.FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
        "client_email": settings.FIREBASE_CLIENT_EMAIL,
    })
    firebase_admin.initialize_app(cred)
except ValueError as e:
    print(f"Firebase initialization error: {e}")
