import os
import requests
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../server/.env')
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "")

def query_supabase(table, params=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
        if response.ok:
            return response.json()
        return []
    except Exception:
        return []

def test_rag(query):
    query = query.lower()
    knowledge = query_supabase("knowledge_base")
    if not knowledge:
        print("Knowledge base is empty or unreachable.")
        return
        
    kb_texts = [f"{k['topic']} {k['sub_topic']} {k['content']} {k['keywords']}".lower() for k in knowledge]
    kb_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
    kb_matrix = kb_vectorizer.fit_transform(kb_texts)
    query_vec = kb_vectorizer.transform([query])
    
    similarities = cosine_similarity(query_vec, kb_matrix).flatten()
    print(f"\nQuery: {query}")
    for i, score in enumerate(similarities):
        if score > 0:
            print(f"Match: {knowledge[i]['topic']} | Score: {score:.4f}")

if __name__ == "__main__":
    queries = [
        "tyrosinase inhibition",
        "salicylic acid mechanism",
        "uneven texture",
        "60-second truth"
    ]
    for q in queries:
        test_rag(q)
