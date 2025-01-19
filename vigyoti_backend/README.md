# Content Generation API

A FastAPI-based backend service for generating social media content from various sources.

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/          # API version 1 endpoints
│   ├── core/            # Core application configuration
│   ├── models/          # Database models
│   ├── schemas/         # Pydantic schemas for request/response
│   ├── services/        # Business logic services
│   └── utils/           # Utility functions
├── requirements.txt     # Python dependencies
└── README.md           # Project documentation
```

## Features

- Content generation from multiple sources:
  - YouTube videos
  - MP3/MP4 files
  - M3U8 files
  - Article URLs
  - Arxiv papers
  - Documents
  - Images
- Social media platform support:
  - Twitter/X
  - LinkedIn
- Authentication and authorization
- AWS Lambda deployment ready

## Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with required credentials:
```
OPENAI_API_KEY=your_openai_key
YOUTUBE_API_KEY=your_youtube_key
FIRECRAWL_API_KEY=your_firecrawl_key
```

4. Run the development server:
```bash
uvicorn app.main:app --reload
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## AWS Deployment

The application is configured for AWS Lambda deployment using Mangum. Follow AWS SAM or Serverless Framework documentation for deployment instructions.
