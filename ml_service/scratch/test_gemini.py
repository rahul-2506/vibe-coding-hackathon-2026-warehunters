import os
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.getcwd(), '..', 'server', '.env'))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("No key found")
    exit()

client = genai.Client(api_key=GEMINI_API_KEY)
model = "gemini-1.5-flash"

try:
    response = client.models.generate_content(
        model=model,
        contents="Hello, are you working?"
    )
    print("Gemini Response:", response.text)
except Exception as e:
    print("Gemini Error:", e)
