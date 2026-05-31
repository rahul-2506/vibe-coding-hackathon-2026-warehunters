import os
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.getcwd(), '..', 'server', '.env'))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=GEMINI_API_KEY)

try:
    for model in client.models.list():
        print(f"Model: {model.name}, Supported: {model.supported_actions}")
except Exception as e:
    print("Error listing models:", e)
