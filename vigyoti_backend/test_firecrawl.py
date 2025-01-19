import os
from firecrawl import FirecrawlApp
import json

# Initialize FireCrawl client
api_key = os.getenv("FIRECRAWL_API_KEY")
if not api_key:
    print("Error: FIRECRAWL_API_KEY environment variable not set")
    exit(1)

firecrawl = FirecrawlApp(api_key=api_key)

# Test URL
url = "https://blog.codeium.com/blog/cascade-agent"

try:
    # Make request
    response = firecrawl.scrape_url(url, params={'formats': ['markdown']})
    
    # Print response
    print("Response type:", type(response))
    print("\nFull response:")
    print(json.dumps(response, indent=2))
    
except Exception as e:
    print(f"Error: {str(e)}")
