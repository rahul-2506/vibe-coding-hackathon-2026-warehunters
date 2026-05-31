import pandas as pd
import json
import urllib.request
import os
import random

def fetch_products():
    """Fetches products from DummyJSON to align categories and IDs."""
    try:
        url = "https://dummyjson.com/products?limit=100"
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            return data.get("products", [])
    except Exception as e:
        print(f"Failed to fetch products from DummyJSON: {e}")
        # Fallback to static dummy list if network is down during seed execution
        return [{"id": i, "title": f"Mock Product {i}", "category": "beauty" if i%2==0 else "groceries"} for i in range(1, 101)]

def process_and_map_reviews():
    excel_path = r"C:\Users\acer\Desktop\ReviewLens\ml_service\merged_reviews_dataset.xlsx"
    output_path = r"C:\Users\acer\Desktop\ReviewLens\database\reviews_seed.json"
    
    print("Reading Excel reviews dataset...")
    df = pd.read_excel(excel_path)
    
    print(f"Loaded {len(df)} reviews from Excel. Fetching product catalog...")
    products = fetch_products()
    
    # Keyword sets for targeted categorization matching
    beauty_keywords = ["skin", "face", "wash", "cream", "smell", "scent", "acne", "oil", "clean", "glow", "serum", "hair", "dry", "soft", "makeup", "mascara", "eyelash", "fragrance", "perfume", "bottle"]
    grocery_keywords = ["taste", "organic", "fresh", "sweet", "flavor", "natural", "eat", "juice", "delicious", "healthy", "bag", "pack"]
    tech_keywords = ["screen", "battery", "phone", "laptop", "charger", "fast", "speed", "camera", "display", "sound", "keyboard", "device"]

    mapped_reviews = []
    
    # Seed random to ensure reproducible runs
    random.seed(42)
    
    print("Mapping reviews to products...")
    for prod in products:
        p_id = prod["id"]
        p_title = prod["title"]
        p_category = prod.get("category", "").lower()
        
        # Determine product relevant keywords based on category
        if "beauty" in p_category or "fragrances" in p_category or "skincare" in p_category:
            target_keywords = beauty_keywords
        elif "groceries" in p_category:
            target_keywords = grocery_keywords
        elif "smartphones" in p_category or "laptops" in p_category or "mobile" in p_category:
            target_keywords = tech_keywords
        else:
            target_keywords = ["product", "good", "bad", "buy", "quality", "price"]

        # Filter df for reviews that match keywords
        # Convert reviews to strings, handling any non-string values
        df_str = df['review'].astype(str)
        matched_df = df[df_str.str.lower().str.contains('|'.join(target_keywords), na=False)]
        
        # If too few matches, fallback to generic subset
        if len(matched_df) < 15:
            matched_df = df
            
        # Sample 15 reviews for this product
        sample_size = min(15, len(matched_df))
        sampled = matched_df.sample(n=sample_size, random_state=random.randint(1, 1000))
        
        emojis_pos = ["😊", "😍", "👍", "✨", "❤️"]
        emojis_neg = ["😒", "😢", "👎", "⚠️", "😡"]
        sources = ["Amazon Customer", "Verified Buyer", "Kaggle Skincare Panel", "Walmart Shopper", "Target Guest"]
        ingredients = ["Salicylic Acid", "Neem Extracts", "Turmeric", "Saffron", "Hyaluronic Acid", "Niacinamide", "Vitamin C", "Aloe Vera"]

        for _, row in sampled.iterrows():
            text = str(row["review"])
            label = int(row["label"]) # 1 = Genuine, 0 = Suspicious/Fake
            
            # Setup dynamic features
            if label == 1:
                rating = random.choice([4, 5])
                verdict = "Genuine"
                trust_score = random.randint(82, 100)
                sentiment = "positive"
                emoji = random.choice(emojis_pos)
            else:
                # Suspicious reviews could be promotional spam (high rating) or malicious attack (low rating)
                rating = random.choice([1, 2, 5])
                verdict = "Suspicious"
                trust_score = random.randint(20, 65)
                sentiment = "positive" if rating == 5 else "negative"
                emoji = random.choice(emojis_neg) if rating < 3 else random.choice(emojis_pos)
            
            # Identify any present skincare ingredients
            found_ing = [ing for ing in ingredients if ing.lower() in text.lower()]
            mentioned = ", ".join(found_ing) if found_ing else "None"

            mapped_reviews.append({
                "product_id": p_id,
                "product_name": p_title,
                "rating": rating,
                "review_text": text,
                "emoji": emoji,
                "source": random.choice(sources),
                "mentioned_ingredients": mentioned,
                "trust_score": trust_score,
                "verdict": verdict,
                "is_public": True,
                "user_id": random.randint(1, 20),
                "sentiment": sentiment,
                "authenticity_score": trust_score
            })
            
    # Make sure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(mapped_reviews, f, indent=4, ensure_ascii=False)
        
    print(f"Successfully generated seed file containing {len(mapped_reviews)} reviews!")

if __name__ == "__main__":
    process_and_map_reviews()
