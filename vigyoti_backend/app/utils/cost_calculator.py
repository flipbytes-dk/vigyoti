import tiktoken
import logging
from typing import Dict, Union, Tuple
from openai.types.completion import Completion

logger = logging.getLogger(__name__)

class CostCalculator:
    GPT_4O_MINI_INPUT_COST = 0.15 / 1_000_000  # $0.15 per 1M input tokens
    GPT_4O_MINI_OUTPUT_COST = 0.60 / 1_000_000  # $0.60 per 1M output tokens
    WHISPER_COST_PER_MINUTE = 0.006  # $0.006 per minute
    IMAGE_GENERATION_COST = 0.05  # $0.05 per image
    FIRECRAWL_COST_PER_CREDIT = 83 / 100_000  # $83 per 100,000 credits

    @staticmethod
    def get_token_count(text: str) -> int:
        """Count tokens in a text string using tiktoken"""
        encoding = tiktoken.encoding_for_model("gpt-4o-mini")
        return len(encoding.encode(text))

    @classmethod
    def calculate_gpt_cost(cls, input_text: str, output_text: str, completion: Completion = None) -> Dict[str, Union[int, float]]:
        """Calculate cost for GPT-4o-mini usage"""
        if completion and hasattr(completion, 'usage'):
            # Use actual token counts from OpenAI response
            input_tokens = completion.usage.prompt_tokens
            output_tokens = completion.usage.completion_tokens
        else:
            # Fall back to tiktoken estimation if completion object not provided
            input_tokens = cls.get_token_count(input_text)
            output_tokens = cls.get_token_count(output_text)
            logger.warning("Using tiktoken estimation for token counts as completion object not provided")
        
        input_cost = input_tokens * cls.GPT_4O_MINI_INPUT_COST
        output_cost = output_tokens * cls.GPT_4O_MINI_OUTPUT_COST
        total_cost = input_cost + output_cost
        
        # Round costs to 6 decimal places to avoid floating point errors
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost": round(input_cost, 6),
            "output_cost": round(output_cost, 6),
            "total_cost": round(total_cost, 6)
        }

    @classmethod
    def calculate_whisper_cost(cls, duration_seconds: float) -> Dict[str, float]:
        """Calculate cost for Whisper model usage"""
        duration_minutes = duration_seconds / 60
        cost = duration_minutes * cls.WHISPER_COST_PER_MINUTE
        return {
            "duration_minutes": round(duration_minutes, 2),
            "cost": round(cost, 6)
        }

    @classmethod
    def calculate_image_cost(cls, num_images: int = 1) -> Dict[str, float]:
        """Calculate cost for image generation"""
        cost = num_images * cls.IMAGE_GENERATION_COST
        return {
            "num_images": num_images,
            "cost": round(cost, 6)
        }

    @classmethod
    def calculate_firecrawl_cost(cls, num_credits: int = 1) -> Dict[str, float]:
        """Calculate cost for Firecrawl API usage"""
        cost = num_credits * cls.FIRECRAWL_COST_PER_CREDIT
        return {
            "num_credits": num_credits,
            "cost": round(cost, 6)
        }

    @classmethod
    def calculate_total_cost(cls, gpt_cost: Dict[str, Union[int, float]], 
                           whisper_cost: Dict[str, float] = None,
                           image_cost: Dict[str, float] = None,
                           firecrawl_cost: Dict[str, float] = None) -> float:
        """Calculate total cost combining all service costs"""
        total = gpt_cost["total_cost"]
        if whisper_cost:
            total += whisper_cost["cost"]
        if image_cost:
            total += image_cost["cost"]
        if firecrawl_cost:
            total += firecrawl_cost["cost"]
        return round(total, 6)
