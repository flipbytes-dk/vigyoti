from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from dotenv import load_dotenv
import os
from phoenix.otel import register
from openinference.instrumentation.openai import OpenAIInstrumentor
from .api.v1 import content_sources_router, twitter_router
import logging

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables first
load_dotenv(override=True)

# Verify OpenAI API key is set
if not os.getenv("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = os.getenv("PHOENIX_API_KEY")
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

# configure the Phoenix tracer
tracer_provider = register(
  endpoint="https://app.phoenix.arize.com/v1/traces",
) 

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

# Get port from environment variable
PORT = int(os.getenv("PORT", 8000))

app = FastAPI(
    title="Content Generation API",
    description="API for generating social media content from various sources",
    version="1.0.0",
    root_path="",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers without prefix (prefix is defined in the routers)
app.include_router(content_sources_router)
app.include_router(twitter_router)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# For AWS Lambda
handler = Mangum(app)
