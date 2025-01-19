"""
Centralized location for all prompts used in the application.
This helps maintain consistency and makes it easier to update prompts across the application.
"""

# Image Analysis Prompts
DEFAULT_IMAGE_ANALYSIS_PROMPT = """
Look at this image and think creatively about the ideas, concepts, and themes it could inspire. Consider:
1. What broader topics or themes does this image evoke?
2. What metaphors or analogies could be drawn from the elements in this image?
3. What business, life, or technology lessons could this image represent?
4. What emotional responses or thoughts does this image trigger?
5. What current trends or discussions could this image relate to?
6. What unique perspectives or insights could be drawn from this scene?

Don't just describe what you see - interpret what it could mean and inspire.
"""

# Content Generation Prompts
TWEET_GENERATION_PROMPT = """
Using the themes and ideas inspired by this image:
{content}

Create {num_tweets} engaging tweet{plural_suffix} that {is_are} creative and thought-provoking. The tweets should:
1. Use the image as inspiration rather than describing it
2. Connect the visual elements to broader insights or ideas
3. Relate to current trends or discussions where relevant
4. Engage the audience with unique perspectives
5. Include relevant hashtags that extend beyond just describing the image

Additional context to consider: {additional_context}

Content Type Guidelines:
{content_type_guidelines}

Character Limits:
- Regular posts: Maximum 280 characters
- Premium posts (if is_premium=true): Maximum 25,000 characters

Ensure each post:
1. Stays within the appropriate character limit based on premium status
2. Maintains a natural, engaging tone
3. Uses appropriate hashtags that enhance the message
4. Creates value beyond just describing the image
"""

IMAGE_TWITTER_PROMPT = """
Using the themes and ideas inspired by this image:
{content}

Create {num_tweets} engaging tweet{plural_suffix} that {is_are} creative and thought-provoking. The tweets should:
1. Do describe the image and then use it as inspiration. 
2. Connect the visual elements to broader insights or ideas
3. Relate to current trends or discussions where relevant
4. Engage the audience with unique perspectives
5. Include relevant hashtags that extend beyond just describing the image

Additional context to consider: {additional_context}

Content Type Guidelines:
{content_type_guidelines}

Character Limits:
- Regular posts: Maximum 280 characters
- Premium posts (if is_premium=true): Maximum 25,000 characters

Ensure each post:
1. Stays within the appropriate character limit based on premium status
2. Maintains a natural, engaging tone
3. Uses appropriate hashtags that enhance the message
4. Creates value beyond just describing the image
"""

TWITTER_CONTENT_PROMPT = """
Create {num_tweets} engaging tweet{plural_suffix} that {is_are} creative and thought-provoking based on this content:
{content}

Additional context to consider: {additional_context}

Content Type Guidelines:
{content_type}

Character Limits:
- Regular posts: Maximum 280 characters
- Premium posts (if is_premium=true): Maximum 25,000 characters

Ensure each post:
1. Stays within the appropriate character limit based on premium status
2. Maintains a natural, engaging tone
3. Uses appropriate hashtags that enhance the message
"""

LINKEDIN_POST_PROMPT = """
Transform the following content into a professional LinkedIn post:
1. Start with a compelling hook
2. Break down complex ideas into digestible points
3. Include relevant industry insights
4. End with a clear call-to-action
5. Use appropriate professional tone
6. Include relevant hashtags
Original content:
{content}
"""

YOUTUBE_SUMMARY_PROMPT = """
Please provide a concise summary of this YouTube video transcript. Focus on:
1. Main topics or themes discussed
2. Key insights or takeaways
3. Important conclusions or calls to action

Transcript:
{transcript}
"""

TWITTER_CONTENT_GUIDELINES = {
    "short": """Create concise, impactful tweets under 280 characters that:
- Capture key insights or memorable moments
- Use engaging language and tone
- Include relevant hashtags where appropriate
- Maintain the original context and meaning""",

    "long": """Create a detailed, in-depth post up to 25,000 characters that:
- Starts with a captivating hook
- Provides comprehensive analysis and insights
- Includes relevant examples and analogies
- Uses formatting (line breaks, emojis) for readability
- Incorporates relevant hashtags throughout
- Ends with a thought-provoking conclusion""",

    "thread": """Create a cohesive thread where:
- Each tweet builds on the previous one
- The first tweet hooks the reader
- Ideas flow logically and maintain context
- Each tweet can stand alone but works better in sequence
- Format: [1/X], [2/X], etc.""",

    "quote": """Extract and present powerful quotes that:
- Capture impactful statements or insights
- Include proper attribution
- Add thoughtful reflection where appropriate
- Maintain the original context and meaning""",

    "poll": """Create engaging polls that:
- Ask clear, relevant questions
- Provide 2-4 distinct, meaningful options
- Encourage audience participation
- Relate directly to the content's key points"""
}

# Content Summary Prompts
ARTICLE_SUMMARY_PROMPT = """
Provide a concise summary of the following article that:
1. Captures the main thesis/argument
2. Includes key supporting points
3. Maintains the original tone and perspective
4. Highlights any significant conclusions
5. Preserves important statistics or data
Article content:
{content}
"""

PAPER_SUMMARY_PROMPT = """
Create an accessible summary of this academic paper that:
1. States the main research question/objective
2. Outlines the methodology used
3. Highlights key findings and conclusions
4. Explains practical implications
5. Uses clear, non-technical language where possible
Paper content:
{content}
"""

# Content Analysis Prompts
SENTIMENT_ANALYSIS_PROMPT = """
Analyze the sentiment and tone of the following content:
1. Overall emotional direction (positive/negative/neutral)
2. Key emotional triggers or themes
3. Style and tone of communication
4. Author's perspective or bias
5. Impact on potential readers
Content:
{content}
"""

CONTENT_IMPROVEMENT_PROMPT = """
Review the following content and suggest improvements for:
1. Clarity and readability
2. Engagement and impact
3. Structure and flow
4. Tone and style
5. Call-to-action effectiveness
Original content:
{content}
"""

# Audio Processing Prompts
TRANSCRIPTION_CLEANUP_PROMPT = """
Clean up and format this audio transcription while:
1. Correcting obvious transcription errors
2. Improving punctuation and formatting
3. Maintaining the original meaning and tone
4. Removing filler words and repetitions
5. Preserving important quotes and key points

Original transcription:
{content}
"""

# Document Processing Prompts
DOCUMENT_EXTRACTION_PROMPT = """
Extract and organize the key information from this document:
1. Main topics or themes
2. Important facts and figures
3. Key arguments or points
4. Conclusions or recommendations
5. Action items or next steps
Document content:
{content}
"""

# Custom Prompts for Specific Use Cases
TECHNICAL_CONTENT_PROMPT = """
Transform this technical content for a general audience:
1. Simplify complex concepts
2. Use analogies and examples
3. Maintain accuracy while improving accessibility
4. Include relevant context
5. Highlight practical applications
Technical content:
{content}
"""

MARKETING_CONTENT_PROMPT = """
Adapt this content for marketing purposes:
1. Highlight value propositions
2. Use persuasive language
3. Include clear benefits
4. Maintain brand voice
5. Add compelling calls-to-action
Original content:
{content}
"""
