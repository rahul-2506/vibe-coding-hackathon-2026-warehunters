import os
import random

# Pre-compiled high-fidelity bot templates for fallback/demo speed
BOT_TEMPLATES = {
    'promotional': [
        "OMG!!! THIS PRODUCT IS A LIFE CHANGER!!! I got a 50% discount using code SAVE50! Buy it immediately!!! Best ever!",
        "Absolutely amazing!!! Recommended by my favorite influencer. It works perfectly and is so cheap! Best product of 2026!",
        "THE BEST PRODUCT EVER!!! RATING 5/5 Stars! Incredible results in just two days. Don't think, just buy it now!!!",
        "Highly recommend! Excellent seller support, fast shipping, and absolute luxury packaging. Check out my review video on Instagram!",
        "Wow, wow, wow! This is beautiful. I will buy another 10 packs for my friends! Absolute masterpiece, LOVE IT!"
    ],
    'negative_spam': [
        "DO NOT BUY!!! THIS IS A COMPLETE SCAM!!! The bottle was empty, toxic smell, and it gave me massive breakouts instantly!!!",
        "Worst experience ever! Totally cheap copy, fake ingredients, and expensive. Customer support ignored my emails. Zero stars!",
        "TERRIBLE QUALITY! My skin got red, itchy, and irritated within one use. This should be banned from stores immediately!!!",
        "DO NOT TRUST THIS BRAND! Total waste of money, it's just plain oil and bad chemicals. Horrible product!",
        "Scam alerts! The package was damaged, liquid spilled everywhere, and it looks like a cheap replica. Return it now!"
    ],
    'generic_repetitive': [
        "Very good product, very good quality, very fast shipping, very good brand. Buy it, buy it, buy it!",
        "Nice nice nice. I like it. Perfect perfect. Best best. Simple simple. Great great. Buy buy buy!",
        "Highly recommended! Great value for money, great performance, great design. Recommended recommended recommended!",
        "Good item. Fits perfectly. Fast delivery. Happy customer. Excellent buy. Good good good.",
        "Excellent. Super fast, super clean, super quality. Highly satisfied with my purchase. Super super super!"
    ]
}

def generate_synthetic_review(product_name, tone='promotional'):
    """
    Generates a realistic bot-like review for a product.
    Tries to call Gemini API if keys are configured, fallback to high-fidelity local templates.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            # Let's try request-based fetch to avoid library mismatch errors
            import json
            import urllib.request
            
            prompt = f"Write a highly realistic, spammy, bot-like product review for '{product_name}'. The tone should be {tone}. Keep it under 60 words. Make it obviously look like artificial spam (abuse of capitals, repeated exclamation marks, or repetitive generic phrases)."
            
            url = f"https://generativetoolkit.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
            with urllib.request.urlopen(req, timeout=5) as response:
                res = json.loads(response.read().decode())
                text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    return text
        except Exception as e:
            print(f"Gemini API generation failed: {e}. Using local fallback templates.")

    # Local template generation
    templates = BOT_TEMPLATES.get(tone, BOT_TEMPLATES['promotional'])
    selected = random.choice(templates)
    
    # Intelligently weave the product name into the bot templates
    insertions = [
        f"Regarding {product_name}: ",
        f"This {product_name} is insane! ",
        f"Just got my {product_name}! ",
        ""
    ]
    prefix = random.choice(insertions)
    return f"{prefix}{selected}"
