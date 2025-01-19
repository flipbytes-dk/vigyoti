from openai import OpenAI
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

audio_file= open("/Users/dhirajkhanna/Downloads/Italian.m4a", "rb")
translation = client.audio.translations.create(
  model="whisper-1", 
  file=audio_file
)
# Save translation to a text file
with open("translation_output.md", "w", encoding="utf-8") as output_file:
    output_file.write(f"# Audio Translation\n\n{translation.text}")
print("Translation saved to translation_output.md")