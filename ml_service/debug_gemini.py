import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='server/.env')
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("API Key not found!")
    exit()

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

def test_gemini_rag(query, context_science, context_products):
    prompt = f"""
    You are an EXPERT AI Skincare Scientist named V-CHAT.
    Your mission is to provide high-fidelity, scientifically grounded advice inspired by dermatology.
    
    USER QUESTION: "{query}"
    
    --- SCIENTIFIC KNOWLEDGE BASE (USE THIS FOR FACTS) ---
    {context_science}
    
    --- PRODUCT INVENTORY (USE THIS FOR RECOMMENDATIONS) ---
    {context_products}
    
    INSTRUCTIONS:
    1. If the science is available in the KNOWLEDGE BASE, use it. If not, state you are scanning.
    2. Always link the science to a product in the INVENTORY.
    3. Be clinical but accessible. Use terms like "melanin synthesis" or "BHA penetration."
    4. Format with professional Markdown (headers, bolding).
    5. Always conclude with "ROBOTIC VERDICT: [Grounded/Synthetically Generated]"
    """
    
    response = model.generate_content(prompt)
    print(f"\nQUERY: {query}")
    print(f"RESPONSE:\n{response.text}")

if __name__ == "__main__":
    # Simulate a real query context
    science = "Kojic Acid: A tyrosinase inhibitor that reduces melanin production. Effective for hyperpigmentation."
    products = "1% Kojic Acid Face Wash ($12): Targets dark spots and improves skin tone."
    
    test_gemini_rag("How does kojic acid help with dark spots?", science, products)
