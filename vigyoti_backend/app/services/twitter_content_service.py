from typing import Optional, List
import openai
from ..schemas.audio import AudioToTwitterRequest, TwitterContent
from ..core.settings import get_settings

settings = get_settings()

class TwitterContentService:
    def __init__(self):
        self.openai_client = openai.OpenAI()
        self.max_tweet_length = 280
        self.premium_max_length = 25000  # For long-form content

    async def generate_tweets(self, transcription: str, request: AudioToTwitterRequest) -> TwitterContent:
        """Generate Twitter content from audio transcription"""
        try:
            # Prepare system prompt based on content type
            system_prompt = self._get_system_prompt(request.content_type)
            
            # Add context about length and number of tweets
            system_prompt += f"\nGenerate {request.num_tweets} tweet{'s' if request.num_tweets > 1 else ''}."
            if request.additional_context:
                system_prompt += f"\nAdditional context: {request.additional_context}"

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcription}
                ]
            )

            tweets = self._parse_tweets(response.choices[0].message.content)
            
            # Generate image if requested
            image_url = None
            if request.generate_image:
                image_url = await self._generate_image(tweets[0])

            return TwitterContent(tweets=tweets, image_url=image_url)

        except Exception as e:
            raise Exception(f"Error generating Twitter content: {str(e)}")

    def _get_system_prompt(self, content_type: str) -> str:
        """Get appropriate system prompt based on content type"""
        prompts = {
            "short": "Create a concise, engaging tweet that captures the main point. Keep it under 280 characters.",
            "thread": "Break down the content into a coherent thread. Each tweet should be self-contained yet flow naturally.",
            "quote": "Extract a powerful quote and present it in an impactful way.",
            "poll": "Create an engaging poll tweet with 2-4 options based on the content.",
            "long": "Create a detailed, long-form post that thoroughly explores the topic."
        }
        return prompts.get(content_type, prompts["short"])

    def _parse_tweets(self, content: str) -> List[str]:
        """Parse the generated content into individual tweets"""
        # Split by numbered bullets or newlines depending on format
        if "1." in content:
            tweets = [t.strip() for t in content.split("\n") if t.strip() and any(c.isdigit() for c in t)]
        else:
            tweets = [t.strip() for t in content.split("\n\n") if t.strip()]

        # Clean up tweet formatting
        tweets = [t.lstrip("1234567890. ") for t in tweets]
        
        return tweets

    async def _generate_image(self, tweet_text: str) -> Optional[str]:
        """Generate an image based on the tweet content"""
        try:
            response = await self.openai_client.images.generate(
                model="dall-e-3",
                prompt=f"Create an image that represents this tweet: {tweet_text}",
                size="1024x1024",
                quality="standard",
                n=1,
            )
            return response.data[0].url
        except Exception as e:
            print(f"Error generating image: {str(e)}")
            return None
