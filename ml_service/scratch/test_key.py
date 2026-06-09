import os
import requests

key = os.environ.get("GEMINI_API_KEY", "")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={key}"
payload = {
    "contents": [{"parts": [{"text": "Hello"}]}]
}
headers = {"Content-Type": "application/json"}

try:
    res = requests.post(url, headers=headers, json=payload)
    print(f"Status Code: {res.status_code}")
    print("Response JSON:")
    print(res.text)
except Exception as e:
    print(f"Error occurred: {e}")
