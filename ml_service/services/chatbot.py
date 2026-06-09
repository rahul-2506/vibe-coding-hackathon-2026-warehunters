import json
import traceback
import concurrent.futures
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def run_with_timeout(func, timeout_sec, *args, **kwargs):
    """
    Executes a blocking function inside a worker thread with a strict timeout limit.
    """
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout_sec)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(f"External API request timed out after {timeout_sec} seconds.")


def local_rag_fallback(relevant_kb, matched_products, query):
    """
    Generates a high-fidelity local Markdown synthesis response when LLM APIs fail or timeout.
    """
    query_lower = query.lower().replace('.', '').replace('!', '').replace('?', '').strip()
    
    # 0. Check for general greetings/small talk first
    greetings = ['hello', 'hi', 'hey', 'greetings', 'sup', 'yo', 'howdy', 'hola', 'whats up', 'hello there', 'hi there', 'hey there']
    if any(g == query_lower or query_lower.startswith(g + ' ') or query_lower.endswith(' ' + g) for g in greetings):
        return (
            "### Introduction\n"
            "👋 **Hello! I'm VChat, your Clinical AI Assistant.**\n\n"
            "### Main Discussion\n"
            "How can I help you today? I am trained to assist you with Skincare formulation analysis and Electronics technical specifications comparison.\n\n"
            "### Point 1\n"
            "For Skincare, I can analyze ingredients, compare formulations, identify beneficial or harmful components, and recommend products based on your skin concerns.\n\n"
            "### Point 2\n"
            "For Electronics, I can compare processing power, RAM, storage, screen specifications, and evaluate value for money.\n\n"
            "### Conclusion\n"
            "What product category or query would you like to explore first?"
        )

    # Check for small talk / how are you / who are you
    if any(x in query_lower for x in ["how are you", "how you doing", "hows it going"]):
        return (
            "### Introduction\n"
            "😊 **I'm doing fantastic, thank you for asking!**\n\n"
            "### Main Discussion\n"
            "As your AI assistant, I'm ready to help you analyze product details, check specifications, or review formulation sheets.\n\n"
            "### Point 1\n"
            "I have deep access to catalog databases, ingredient safety profiles, and technical hardware benchmarks.\n\n"
            "### Point 2\n"
            "My current operational parameters are optimized to filter out irrelevant information and focus on quality data.\n\n"
            "### Conclusion\n"
            "Let me know what you'd like to search or compare today!"
        )
        
    if any(x in query_lower for x in ["who are you", "what is vchat"]):
        return (
            "### Introduction\n"
            "🌟 **I am VChat, your intelligent AI Shopping & Consultation Assistant.**\n\n"
            "### Main Discussion\n"
            "Unlike generic bots, I specialize in two core domains: clinical-grade Skincare and high-performance Electronics.\n\n"
            "### Point 1\n"
            "In skincare, I audit ingredients to help match your skin type and concerns without generic marketing buzzwords.\n\n"
            "### Point 2\n"
            "In electronics, I parse technical specifications to help you find the best value for your computing or mobile needs.\n\n"
            "### Conclusion\n"
            "Let's find your perfect product! Ask me to compare items or explain active parameters."
        )

    response_md = "### Introduction\n"
    response_md += f"Processing your query: \"{query}\" using our local inventory database.\n\n"
    
    response_md += "### Main Discussion\n"
    
    # 1. Product comparison mode
    if len(matched_products) >= 2:
        p1, p2 = matched_products[0], matched_products[1]
        response_md += f"We compared two matching items: **{p1['name']}** and **{p2['name']}**.\n\n"
        
        response_md += "### Point 1\n"
        response_md += f"**{p1['name']}** (${p1['price']}):\n"
        if p1['category'] == 'Skincare':
            response_md += f"- Key Actives: {p1.get('key_ingredients', 'N/A')}\n"
            response_md += f"- Target Skin Type: {p1.get('skin_type', 'N/A')}\n"
            response_md += f"- Concerns: {p1.get('concerns', 'N/A')}\n"
        else:
            specs = p1.get('specifications_json', {})
            response_md += f"- Specs: {', '.join([f'{k}: {v}' for k, v in specs.items()][:3])}\n"
            response_md += f"- Features: {p1.get('technical_features', 'N/A')}\n"
            
        response_md += "\n### Point 2\n"
        response_md += f"**{p2['name']}** (${p2['price']}):\n"
        if p2['category'] == 'Skincare':
            response_md += f"- Key Actives: {p2.get('key_ingredients', 'N/A')}\n"
            response_md += f"- Target Skin Type: {p2.get('skin_type', 'N/A')}\n"
            response_md += f"- Concerns: {p2.get('concerns', 'N/A')}\n"
        else:
            specs = p2.get('specifications_json', {})
            response_md += f"- Specs: {', '.join([f'{k}: {v}' for k, v in specs.items()][:3])}\n"
            response_md += f"- Features: {p2.get('technical_features', 'N/A')}\n"

        response_md += "\n### Conclusion\n"
        response_md += f"Based on specifications, **{p1['name']}** is suitable for users looking for its specific profile, whereas **{p2['name']}** serves as a direct alternative."

    # 2. Single product matched
    elif matched_products:
        p = matched_products[0]
        response_md += f"Found 1 direct match in inventory: **{p['name']}** (${p['price']}).\n\n"
        
        response_md += "### Point 1\n"
        response_md += "**Product Attributes:**\n"
        if p['category'] == 'Skincare':
            response_md += f"- Active Ingredients: {p.get('ingredients', 'N/A')}\n"
            response_md += f"- Key Actives: {p.get('key_ingredients', 'N/A')}\n"
            response_md += f"- Concerns Addressed: {p.get('concerns', 'N/A')}\n"
        else:
            specs = p.get('specifications_json', {})
            spec_details = ", ".join([f"{k}: {v}" for k, v in specs.items()])
            response_md += f"- Hardware Specs: {spec_details}\n"
            response_md += f"- Features: {p.get('technical_features', 'N/A')}\n"
            
        response_md += "\n### Point 2\n"
        response_md += "**Clinical / Performance Analysis:**\n"
        if p['category'] == 'Skincare':
            response_md += "• Grounded formulation matches the stated skincare concerns. Pairs well with a daily broad-spectrum sunscreen.\n"
        else:
            response_md += "• Hardware features indicate stable, professional-grade output aligned with expectations.\n"
            
        response_md += "\n### Conclusion\n"
        response_md += f"We highly recommend **{p['name']}** based on these verified database parameters."

    # 3. Scientific knowledge base grounding (but no direct product)
    else:
        response_md += "We found relevant articles in our knowledge base but no matching direct products in inventory.\n\n"
        
        response_md += "### Point 1\n"
        if relevant_kb:
            kb = relevant_kb[0]
            response_md += f"**Knowledge Article - {kb['topic']}**:\n{kb['content']}\n"
        else:
            response_md += "No direct knowledge article match.\n"
            
        response_md += "\n### Point 2\n"
        if len(relevant_kb) >= 2:
            kb2 = relevant_kb[1]
            response_md += f"**Alternative Reference - {kb2['topic']}**:\n{kb2['content']}\n"
        else:
            response_md += "No secondary article reference found.\n"
            
        response_md += "\n### Conclusion\n"
        response_md += "Please modify your search or ask about active ingredients (like Niacinamide or Salicylic Acid) or laptop hardware configurations."

    return response_md


def execute_gemini_rag(gemini_client, model_name, system_prompt, user_prompt):
    chat_session = gemini_client.chats.create(
        model=model_name,
        config={'system_instruction': system_prompt}
    )
    res = chat_session.send_message(user_prompt)
    return res.text


def execute_groq_rag(groq_client, model_name, system_prompt, user_prompt):
    chat_completion = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        model=model_name,
    )
    return chat_completion.choices[0].message.content


def execute_openai_request(api_key: str, system_prompt: str, user_prompt: str) -> str:
    import requests
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.7
    }
    response = requests.post(url, headers=headers, json=payload, timeout=12)
    if response.ok:
        return response.json()["choices"][0]["message"]["content"]
    else:
        raise ValueError(f"OpenAI API error {response.status_code}: {response.text}")


def perform_rag_chat(query, query_supabase, gemini_client, groq_client, GEMINI_MODEL, GROQ_MODEL, openai_key=None):
    """
    Coordinates semantic retrieval, queries Supabase, calls LLMs with 10s timeouts, and falls back gracefully.
    """
    query_lower = query.lower()
    
    try:
        # 1. Fetch inventories and databases from Supabase with relational details joins
        try:
            knowledge = query_supabase("knowledge_base")
            raw_products = query_supabase("products", {"select": "*,skincare_details(*),electronics_details(*)"})
            
            # Flatten product rows in Python
            products = []
            for r in raw_products:
                cat = r.get("category", "")
                if cat == 'Skincare & Beauty':
                    cat = 'Skincare'
                
                # Filter out unsupported categories at RAG level
                if cat != 'Skincare' and cat != 'Electronics':
                    continue
                
                skincare = r.get("skincare_details", {})
                if isinstance(skincare, list) and len(skincare) > 0:
                    skincare = skincare[0]
                elif not isinstance(skincare, dict):
                    skincare = {}
                    
                electronics = r.get("electronics_details", {})
                if isinstance(electronics, list) and len(electronics) > 0:
                    electronics = electronics[0]
                elif not isinstance(electronics, dict):
                    electronics = {}

                p = {
                    "id": r.get("id"),
                    "title": r.get("title") or r.get("name") or "Product",
                    "name": r.get("title") or r.get("name") or "Product",
                    "category": cat,
                    "price": r.get("price") or r.get("price_inr") or 0,
                    "brand": r.get("brand") or "Generic",
                    "description": r.get("description") or "",
                    "explanation": r.get("description") or "",
                    # Skincare details
                    "ingredients": skincare.get("ingredients") or "",
                    "key_ingredients": skincare.get("key_ingredients") or "",
                    "skin_type": skincare.get("skin_type") or "",
                    "concerns": skincare.get("concerns") or "",
                    # Electronics details
                    "specifications_json": electronics.get("specifications_json") or {},
                    "technical_features": electronics.get("technical_features") or ""
                }
                products.append(p)
                
            if not knowledge:
                raise ValueError("Knowledge base returns empty or is unreachable")
        except Exception as db_err:
            print(f"[CHATBOT SERVICE] Supabase query failed: {db_err}. Triggering offline static catalog fallback.")
            knowledge = [
                {
                    "topic": "Salicylic Acid",
                    "content": "Salicylic Acid is a beta hydroxy acid (BHA) that works by dissolving skin debris that clogs pores, acting as an anti-inflammatory to clear blackheads and prevent acne outbreaks.",
                    "keywords": "salicylic acid, BHA"
                },
                {
                    "topic": "Niacinamide",
                    "content": "Niacinamide is a form of vitamin B3 that regulates sebum production, strengthens the lipid barrier, reduces skin redness, and minimizes the appearance of pores.",
                    "keywords": "niacinamide, vitamin B3"
                }
            ]
            products = [
                {
                    "id": 1,
                    "title": "Minimalist 2% Salicylic Acid Serum",
                    "name": "Minimalist 2% Salicylic Acid Serum",
                    "category": "Skincare",
                    "price": 599,
                    "brand": "Minimalist",
                    "explanation": "A gentle chemical exfoliant that clears blackheads and regulates excess sebum.",
                    "description": "A gentle chemical exfoliant that clears blackheads and regulates excess sebum.",
                    "ingredients": "Aloe Barbadensis Leaf Juice, Salicylic Acid, Oligopeptide-10",
                    "key_ingredients": "Salicylic Acid 2%, Oligopeptide-10",
                    "skin_type": "Oily, Acne-Prone",
                    "concerns": "Blackheads, Acne, Clogged Pores"
                },
                {
                    "id": 2,
                    "title": "Dell XPS 13 Laptop",
                    "name": "Dell XPS 13 Laptop",
                    "category": "Electronics",
                    "price": 119990,
                    "brand": "Dell",
                    "explanation": "Precision crafted ultraportable laptop powered by Intel Core Ultra 7.",
                    "description": "Precision crafted ultraportable laptop powered by Intel Core Ultra 7.",
                    "specifications_json": {"Processor": "Intel Core Ultra 7", "RAM": "16GB LPDDR5x"},
                    "technical_features": "CNC Aluminum Chassis, InfinityEdge display"
                }
            ]

        # 2. SEMANTIC RETRIEVAL (TF-IDF Matching) over KB
        kb_texts = []
        for k in knowledge:
            topic = k.get('topic', k.get('title', ''))
            content = k.get('content', '')
            keywords = k.get('keywords', '')
            kb_texts.append(f"{topic} {content} {keywords}".lower())

        kb_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 3))
        kb_matrix = kb_vectorizer.fit_transform(kb_texts)
        query_vec = kb_vectorizer.transform([query_lower])
        similarities = cosine_similarity(query_vec, kb_matrix).flatten()
        
        threshold = 0.05
        top_indices = np.argsort(similarities)[::-1]
        relevant_kb = [knowledge[i] for i in top_indices if similarities[i] > threshold]
        
        # Keyword Fallback for KB
        if not relevant_kb:
            query_words = set(query_lower.split())
            for k in knowledge:
                topic = k.get('topic', k.get('title', ''))
                content = k.get('content', '')
                keywords = k.get('keywords', '')
                kb_search_area = f"{topic} {keywords} {content}".lower()
                if any(word in kb_search_area for word in query_words if len(word) > 3):
                    relevant_kb.append(k)
                    if len(relevant_kb) >= 2:
                        break

        # 3. PRODUCT MATCHING (TF-IDF Matching)
        prod_texts = []
        for p in products:
            spec_str = json.dumps(p.get("specifications_json", {}))
            text = f"{p['name']} {p['category']} {p['brand']} {p['explanation']} {p.get('ingredients')} {p.get('key_ingredients')} {p.get('skin_type')} {p.get('concerns')} {spec_str} {p.get('technical_features')}".lower()
            prod_texts.append(text)

        prod_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
        prod_matrix = prod_vectorizer.fit_transform(prod_texts)
        prod_query_vec = prod_vectorizer.transform([query_lower])
        prod_similarities = cosine_similarity(prod_query_vec, prod_matrix).flatten()
        
        matched_indices = np.where(prod_similarities > 0.05)[0]
        matched_products = [products[i] for i in matched_indices]
        matched_products = sorted(matched_products, key=lambda x: prod_similarities[products.index(x)], reverse=True)

        # 4. LLM API Synthesis with Timeout Control
        context = "SCIENTIFIC DATA:\n"
        for k in relevant_kb:
            topic = k.get('topic', k.get('title', ''))
            content = k.get('content', '')
            context += f"- {topic}: {content}\n"
        
        context += "\nPRODUCT INVENTORY:\n"
        for p in matched_products[:4]:
            context += f"- ID: {p['id']}, Name: {p['name']}, Category: {p['category']}, Brand: {p['brand']}, Price: INR {p['price']}\n"
            context += f"  Description: {p['explanation']}\n"
            if p['category'] == 'Skincare':
                context += f"  Ingredients: {p.get('ingredients')}\n"
                context += f"  Key Ingredients: {p.get('key_ingredients')}\n"
                context += f"  Skin Type: {p.get('skin_type')}\n"
                context += f"  Concerns: {p.get('concerns')}\n"
            elif p['category'] == 'Electronics':
                context += f"  Specifications: {json.dumps(p.get('specifications_json'))}\n"
                context += f"  Technical Features: {p.get('technical_features')}\n"

        system_prompt = """You are the Lead Clinical Shopping & Product Consultation Assistant for V-CHAT.
        You support only two categories: Skincare and Electronics. All other categories are disabled.
        
        INSTRUCTIONS:
        1. **Talk like a human**: Speak naturally, vary your opening sentences, and display warm conversational intelligence.
        2. **Clinical and Specification-based Logic**:
           - For Skincare: Analyze active formulation chemical ingredients, identify harmful/beneficial substances, check skin types compatibility, and map to skincare concerns.
           - For Electronics: Analyze processing chips, RAM configurations, screen qualities, battery capacities, and assess value-for-money.
        3. **Never make generic recommendations**: You MUST construct your reasoning and justifications strictly using the attributes defined in the database (ingredients, skin type, concerns, specifications, technical features). Do not invent features or properties.
        4. **Missing Profile Data**: If the user asks for a recommendation but has not specified crucial parameters (e.g., skin type/concern for skincare, or budget/use-case for electronics), ask friendly follow-up questions instead of guessing.
        5. **Formatting Structure**: You MUST format your response strictly using the following Markdown headers and section layout. Failure to use this exact heading structure is unacceptable:
           
           ### Introduction
           [Brief conversational overview or greeting acknowledging user needs]
           
           ### Main Discussion
           [Detailed comparison, product analysis, or explanation of ingredients/specifications]
           
           ### Point 1
           [First major analysis or recommendation point with specific details from database]
           
           ### Point 2
           [Second major analysis or recommendation point with specific details from database]
           
           ### Conclusion
           [Final professional verdict, advice, routine structure, or follow-up question]
        """
        
        user_prompt = f"USER QUESTION: \"{query}\"\n\n--- CONTEXTUAL DATASETS ---\n{context}"

        # Try OpenAI first if dynamic key is available
        if openai_key and openai_key.strip():
            try:
                print("[CHATBOT SERVICE] Requesting synthesis from OpenAI (gpt-4o-mini)...")
                response_text = execute_openai_request(openai_key.strip(), system_prompt, user_prompt)
                return response_text
            except Exception as e:
                print(f"[CHATBOT SERVICE] OpenAI RAG attempt failed: {e}. Trying other engines.")

        # Try Gemini second with 10s timeout
        if gemini_client and GEMINI_MODEL:
            try:
                print("[CHATBOT SERVICE] Requesting synthesis from Gemini with 10s timeout...")
                response_text = run_with_timeout(
                    execute_gemini_rag,
                    10,
                    gemini_client,
                    GEMINI_MODEL,
                    system_prompt,
                    user_prompt
                )
                return response_text
            except Exception as e:
                print(f"[CHATBOT SERVICE] Gemini RAG attempt timed out or failed: {e}. Trying Groq fallback.")

        # Try Groq third with 10s timeout
        if groq_client and GROQ_MODEL:
            try:
                print("[CHATBOT SERVICE] Requesting synthesis from Groq with 10s timeout...")
                response_text = run_with_timeout(
                    execute_groq_rag,
                    10,
                    groq_client,
                    GROQ_MODEL,
                    system_prompt,
                    user_prompt
                )
                return response_text
            except Exception as e:
                print(f"[CHATBOT SERVICE] Groq RAG attempt timed out or failed: {e}. Executing local fallback.")

        # Local synthesis fallback
        print("[CHATBOT SERVICE] Triggering category-aware local fallback synthesis...")
        return local_rag_fallback(relevant_kb, matched_products, query)

    except Exception as general_err:
        print(f"[CHATBOT SERVICE] Fatal error during perform_rag_chat: {general_err}")
        traceback.print_exc()
        return "An internal server error occurred while processing your query. Please check database tables."
