import os
import json
import urllib.request

# Load environment variables
load_dotenv(dotenv_path='../server/.env')
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("Groq API Key not found!")
    exit()

MODEL = "llama-3.3-70b-versatile" 

products = [
    {
        "id": 101,
        "name": "The Derma Co 1% Salicylic Acid Facewash",
        "price": 300.0,
        "category": "Skincare",
        "explanation": "A highly effective exfoliating cleanser formulated with 1-2% Salicylic Acid. Designed specifically for oily and acne-prone skin, it penetrates deep into pores to dissolve sebum and prevent future breakouts. Best used with a 60-second massage for maximum contact time."
    },
    {
        "id": 102,
        "name": "Himalaya Purifying Neem Facewash",
        "price": 150.0,
        "category": "Skincare",
        "explanation": "A soap-free, herbal formulation that cleanses impurities and helps clear pimples. A natural blend of Neem and Turmeric brings together their antibacterial and antifungal properties to prevent the recurrence of acne over time."
    },
    {
        "id": 103,
        "name": "Mamaearth Ubtan Facewash",
        "price": 325.0,
        "category": "Skincare",
        "explanation": "Inspired by traditional beauty secrets, this Ubtan facewash uses Turmeric and Saffron to deeply cleanse and brighten skin. It is effective in removing tan and restoring natural glow without stripping away essential moisture."
    }
]

product_context = ""
for p in products:
    product_context += f"ID: {p['id']}, Name: {p['name']}, Price: ${p['price']}, Category: {p['category']}, Features: {p['explanation']}\n"

system_prompt = """You are a High-Precision Product Recommendation Engine.
Your goal is to match user queries with the most relevant products from our inventory.

INSTRUCTIONS:
1. Analyze the user prompt to understand their needs (budget, category, features, skin concerns).
2. Select up to 5 best matching products from the provided inventory.
3. For each selected product, provide:
   - matchScore: (0-100)
   - explanation: A short (1-2 sentence) reason why this product matches.
   - relativityTags: A list of 1-2 relevant tags (e.g., {"label": "Best Value", "color": "#10b981"}).
4. Return ONLY a JSON list of objects with these keys: "id", "matchScore", "explanation", "relativityTags".
5. If NO products match well, return an empty list [].
6. DO NOT include any text other than the JSON array."""

user_query = f"USER PROMPT: i want a facewash for my acne skin\n\nINVENTORY:\n{product_context}"

print("Sending request to Groq...")
url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {GROQ_API_KEY}"
}
payload = {
    "model": MODEL,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query}
    ],
    "response_format": {"type": "json_object"}
}

req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
try:
    with urllib.request.urlopen(req, timeout=10) as response:
        res = json.loads(response.read().decode())
        text = res["choices"][0]["message"]["content"].strip()
        print("RESPONSE:")
        print(text)
except Exception as e:
    print(f"Error: {e}")
