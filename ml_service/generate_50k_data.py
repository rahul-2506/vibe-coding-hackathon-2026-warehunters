import pandas as pd
import random

# Core components to mix and match
real_templates = [
    "I have been using {brand} for {time} and my {skin_concern} has improved significantly.",
    "The {ingredient} in this facewash is excellent for {benefit}.",
    "Best purchase! My {skin_concern} is finally under control thanks to {brand}.",
    "Highly recommended for {skin_type} skin. It's gentle and effective.",
    "The texture of {brand} is amazing, and it smells like {ingredient}.",
    "Clinically proven results! My dermatologist suggested {brand}.",
    "Finally found something that works for {skin_concern} without drying my face.",
    "The {ingredient} really helps with {benefit}. 5 stars!",
    "Genuine product. I love how {brand} makes my skin feel soft.",
    "Great for daily use. My {skin_concern} is gone."
]

fake_templates = [
    "Total waste of money, {brand} is a scam.",
    "Do not buy, it gave me terrible {skin_concern} and rashes.",
    "Fake product, the bottle was empty and smelled like chemicals.",
    "Worse experience ever. {brand} ruined my skin barrier.",
    "It's just plain water, doesn't do anything for {benefit}.",
    "Scam alert! This is not the original {brand} product.",
    "Terrible quality, the {ingredient} is missing I think.",
    "Made my {skin_type} skin even worse. Never again.",
    "Bad smell and weird consistency. Avoid {brand}.",
    "I want a refund, {brand} is not working at all."
]

brands = ["The Derma Co", "Himalaya", "Mamaearth"]
ingredients = ["Salicylic Acid", "Neem", "Turmeric", "Saffron", "Vitamin C", "Hyaluronic Acid", "Niacinamide"]
skin_concerns = ["acne", "pimples", "blackheads", "oily skin", "dryness", "tanning", "dullness"]
benefits = ["pore cleansing", "skin brightening", "oil control", "hydration", "clear skin"]
skin_types = ["oily", "dry", "combination", "sensitive", "normal"]
times = ["2 weeks", "a month", "3 days", "a few months"]

generated_data = []

print("Generating 50,000 synthetic reviews...")

for i in range(25000):
    # Generate Real Review
    template = random.choice(real_templates)
    review = template.format(
        brand=random.choice(brands),
        ingredient=random.choice(ingredients),
        skin_concern=random.choice(skin_concerns),
        benefit=random.choice(benefits),
        skin_type=random.choice(skin_types),
        time=random.choice(times)
    )
    generated_data.append({'review': review, 'label': 1})

    # Generate Fake Review
    template = random.choice(fake_templates)
    review = template.format(
        brand=random.choice(brands),
        ingredient=random.choice(ingredients),
        skin_concern=random.choice(skin_concerns),
        benefit=random.choice(benefits),
        skin_type=random.choice(skin_types)
    )
    generated_data.append({'review': review, 'label': 0})

df = pd.DataFrame(generated_data)
# Shuffle the data
df = df.sample(frac=1).reset_index(drop=True)

df.to_excel('merged_reviews_dataset.xlsx', index=False)
print(f"Successfully generated {len(df)} lines and saved to merged_reviews_dataset.xlsx")
