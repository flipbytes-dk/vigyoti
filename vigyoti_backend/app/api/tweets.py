from fastapi import APIRouter, Request, HTTPException
from ..middleware.firebase_auth import firebase_auth
from ..models.tweet import TweetRequest, TweetResponse
from ..services.openai_service import generate_tweets

router = APIRouter()

@router.post("/generate")
@firebase_auth
async def generate_tweet(request: Request, tweet_request: TweetRequest) -> TweetResponse:
    try:
        # The user_id is now available in request.state.user_id
        user_id = request.state.user_id
        
        # Your existing tweet generation logic here
        tweets = await generate_tweets(tweet_request.content)
        
        return TweetResponse(tweets=tweets)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 