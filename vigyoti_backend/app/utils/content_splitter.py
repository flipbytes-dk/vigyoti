from typing import List
import re

def split_into_tweets(content: str, num_tweets: int, max_length: int = 280) -> List[str]:
    """
    Split content into multiple tweets intelligently.
    
    Args:
        content: The content to split
        num_tweets: Number of desired tweets
        max_length: Maximum length per tweet (280 for regular, 4000 for premium)
    
    Returns:
        List of tweet strings
    """
    # If content already contains post markers, split on those
    if "**Post" in content:
        tweets = re.split(r'\*\*Post \d+:\*\*\s*\n+', content)
        tweets = [t.strip() for t in tweets if t.strip()]
        return tweets[:num_tweets]
    
    # Otherwise, implement intelligent splitting logic
    # This is a basic implementation - you might want to use
    # more sophisticated NLP techniques
    
    # Remove any existing numbering or markers
    clean_content = re.sub(r'^\d+\.\s+', '', content, flags=re.MULTILINE)
    
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', clean_content)
    
    # Calculate approximate sentences per tweet
    sentences_per_tweet = max(1, len(sentences) // num_tweets)
    
    tweets = []
    current_tweet = []
    current_length = 0
    
    for sentence in sentences:
        sentence_length = len(sentence) + 1  # +1 for space
        
        # If adding this sentence would exceed max_length,
        # or we've reached our sentences_per_tweet target
        if (current_length + sentence_length > max_length or 
            len(current_tweet) >= sentences_per_tweet) and current_tweet:
            tweets.append(' '.join(current_tweet))
            current_tweet = []
            current_length = 0
            
            # Break if we've reached our desired number of tweets
            if len(tweets) >= num_tweets:
                break
        
        current_tweet.append(sentence)
        current_length += sentence_length
    
    # Add any remaining content
    if current_tweet and len(tweets) < num_tweets:
        tweets.append(' '.join(current_tweet))
    
    # Ensure we have exactly num_tweets
    while len(tweets) < num_tweets:
        tweets.append("...")  # Or some other placeholder
    
    return tweets[:num_tweets] 