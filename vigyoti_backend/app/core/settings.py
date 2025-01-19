from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # OpenAI settings
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_API_KEY: str

    # YouTube settings
    YOUTUBE_API_KEY: str

    # API URLs and ports
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"

    # API Keys
    FIRECRAWL_API_KEY: str
    REPLICATE_API_TOKEN: str
    REPLICATE_MODEL_VERSION: str = "ideogram-ai/ideogram-v2-turbo"
    PHOENIX_API_KEY: str

    # Twitter settings
    TWITTER_CLIENT_ID: str
    TWITTER_CLIENT_SECRET: str
    TWITTER_CALLBACK_URL: str
    
    # Database
    DATABASE_URL: str

    # Stripe Configuration
    STRIPE_SECRET_KEY: str
    STRIPE_PUBLISHABLE_KEY: str

    # Firebase Configuration
    FIREBASE_PROJECT_ID: str = "vigyoti-dev"
    FIREBASE_PRIVATE_KEY: str
    FIREBASE_CLIENT_EMAIL: str

    # Proxy settings
    SMARTPROXY_USERNAME: str
    SMARTPROXY_PASSWORD: str
    SMARTPROXY_URL: Optional[str] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Construct SMARTPROXY_URL if username and password are provided
        if self.SMARTPROXY_USERNAME and self.SMARTPROXY_PASSWORD:
            self.SMARTPROXY_URL = f"http://{self.SMARTPROXY_USERNAME}:{self.SMARTPROXY_PASSWORD}@gate.smartproxy.com:7000"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"  # Allow extra fields in environment variables

settings = Settings() 