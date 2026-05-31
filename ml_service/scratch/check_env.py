import os
from dotenv import load_dotenv

env_path = os.path.join(os.getcwd(), '..', 'server', '.env')
print(f"Loading from: {os.path.abspath(env_path)}")
load_dotenv(dotenv_path=env_path)

key = os.getenv("GEMINI_API_KEY")
if key:
    print(f"Key found: {key[:10]}...")
else:
    print("Key NOT found!")
