import uvicorn
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv(override=True)

if __name__ == "__main__":
    # Get configuration from environment variables
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    environment = os.getenv("ENVIRONMENT", "development")
    
    # Run the server
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=environment == "development",  # Enable auto-reload in development
        log_level="info"  # Add this for better debugging
    )
