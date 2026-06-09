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
        return "👋 **Hello! I'm VChat, your Clinical AI Skincare Consultant.**\n\nHow can I help you with your skincare routine today? I can help you find products, compare formulas, check review trust scores, or explain clinical active ingredients like Niacinamide or Salicylic Acid!"

    # Check for small talk / how are you / who are you
    if any(x in query_lower for x in ["how are you", "how you doing", "hows it going"]):
        return "😊 **I'm doing fantastic, thank you for asking!**\n\nAs your AI skincare expert, I'm fully charged and ready to analyze formulas, build routines, or audit product reviews. How is your skin feeling today?"
        
    if any(x in query_lower for x in ["who are you", "what is vchat"]):
        return "🌟 **I am VChat, your intelligent Clinical AI Skincare Shopping Assistant.**\n\nUnlike standard customer service bots, I have deep access to product databases, chemical ingredient safety profiles, and verified review fraud scanners. Let's find your perfect routine!"
        
    if "joke" in query_lower or "laugh" in query_lower:
        return "🧴 **Here's a quick skincare joke for you:**\n\n*Why did the skin cell go to school?*\n*To get a little brighter, but it ended up getting exfoliated instead!* 💫\n\nHow can I help you brighten your actual routine today?"

    if any(x in query_lower for x in ["thank you", "thanks", "awesome"]):
        return "💖 **You are very welcome!** It is my absolute pleasure to guide you. Let me know if you want to compare other brands or tweak your current routine steps."

    response_md = ""
    
    # 1. Product comparison mode
    if len(matched_products) >= 2:
        response_md += "⚖️ **NEURAL COMPARISON MODE ENABLED (Offline Fallback)**\n\n"
        p1, p2 = matched_products[0], matched_products[1]
        response_md += f"| Feature | {p1['name']} | {p2['name']} |\n"
        response_md += "| :--- | :--- | :--- |\n"
        response_md += f"| Category | {p1['category']} | {p2['category']} |\n"
        response_md += f"| Base Price | ${p1['price']} | ${p2['price']} |\n"
        response_md += f"| Core Focus | {p1['explanation'][:50]}... | {p2['explanation'][:50]}... |\n\n"
        response_md += f"🚀 **Verdict:** {p1['name']} is highly matched for standard clinical categories, while {p2['name']} offers a different active compound profile.\n\n"
    
    # 2. Single product matched
    elif matched_products:
        best_product = matched_products[0]
        response_md += f"📦 **INVENTORY SYNERGY: Clinical Match**\n"
        response_md += f"Found **{best_product['name']}** (${best_product['price']}) in active stock.\n\n"
        response_md += "✅ **Dermatological Pros:**\n"
        response_md += f"• Targeted {best_product['category']} action.\n"
        if "salicylic" in best_product['explanation'].lower():
            response_md += "• Deep pore keratolytic cleansing using BHA.\n"
        if "neem" in best_product['explanation'].lower():
            response_md += "• Organic antimicrobial defense preserving dermal acidic mantle.\n"
        if "ubtan" in best_product['explanation'].lower():
            response_md += "• Brightens skin using traditional turmeric extracts.\n"
        
        response_md += "\n⚠️ **Clinical Cautions:**\n"
        response_md += "• Introduce gradually to assess barrier tolerance.\n"
        response_md += "• Apply high-SPF sunscreen daily during active treatment.\n\n"

    # 3. Scientific knowledge base grounding
    if relevant_kb:
        response_md += "🔬 **NEURAL SEARCH: Scientific Grounding**\n"
        for kb in relevant_kb:
            response_md += f"**{kb['topic']}**: {kb['content']}\n"
        response_md += "\n"
    
    if not response_md:
        response_md = f"🔍 **NEURAL SCAN COMPLETE:** I currently have no direct matching scientific entries for your query about \"{query}\". Please ask about active ingredients like Salicylic Acid, Neem, or Ubtan."
    else:
        response_md += "🤖 **SYSTEM VERDICT:** Fully aligned with local skincare intelligence databases (LLM offline fallback mode active)."

    return response_md


def execute_gemini_rag(gemini_client, model_name, system_prompt, user_prompt):
    """
    Sub-function for thread execution
    """
    chat_session = gemini_client.chats.create(
        model=model_name,
        config={'system_instruction': system_prompt}
    )
    res = chat_session.send_message(user_prompt)
    return res.text


def execute_groq_rag(groq_client, model_name, system_prompt, user_prompt):
    """
    Sub-function for thread execution
    """
    chat_completion = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        model=model_name,
    )
    return chat_completion.choices[0].message.content


def execute_openai_request(api_key: str, system_prompt: str, user_prompt: str) -> str:
    """
    Direct HTTPS proxy to OpenAI completions endpoint using request payloads.
    """
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
        # 1. Fetch inventories and databases from Supabase
        try:
            knowledge = query_supabase("knowledge_base")
            products = query_supabase("products")
                
            if not knowledge:
                raise ValueError("Knowledge base returns empty or is unreachable")
        except Exception as db_err:
            print(f"[CHATBOT SERVICE] Supabase offline or failed to fetch: {db_err}. Triggering offline static catalog fallback.")
            knowledge = [
                {
                    "topic": "Salicylic Acid",
                    "sub_topic": "Mechanism of Action",
                    "content": "Salicylic Acid is a beta hydroxy acid (BHA) that works by dissolving skin debris that clogs pores, acting as an anti-inflammatory and helping red, inflamed pimples and pustules go away faster.",
                    "keywords": "salicylic acid, bha, pores, acne, exfoliant"
                },
                {
                    "topic": "Neem Extracts",
                    "sub_topic": "Antimicrobial Benefits",
                    "content": "Neem contains active compounds like nimbin and azadirachtin which exhibit strong antibacterial, antifungal, and anti-inflammatory properties, making it highly effective against acne-causing bacteria without stripping natural skin moisture.",
                    "keywords": "neem, antibacterial, antimicrobial, acne"
                },
                {
                    "topic": "Ubtan",
                    "sub_topic": "Traditional Skin Brightening",
                    "content": "Traditional Ubtan formulation combining turmeric, saffron, and sandalwood extracts helps gently exfoliate the skin, reduce hyperpigmentation, combat dullness, and improve overall skin texture and tone.",
                    "keywords": "ubtan, turmeric, saffron, bright, glow"
                }
            ]
            products = [
                {
                    "id": 101,
                    "title": "Salicylic Acid Cleanser",
                    "name": "Salicylic Acid Cleanser",
                    "category": "Skincare",
                    "price": 12.99,
                    "explanation": "A deep-cleansing BHA formula designed to penetrate pores, clear blackheads, and regulate excess sebum secretion.",
                    "description": "A deep-cleansing BHA formula designed to penetrate pores, clear blackheads, and regulate excess sebum secretion."
                },
                {
                    "id": 102,
                    "title": "Neem & Turmeric Face Wash",
                    "name": "Neem & Turmeric Face Wash",
                    "category": "Skincare",
                    "price": 9.99,
                    "explanation": "A gentle antibacterial face wash that cleanses skin of impurities and prevents future breakouts without drying.",
                    "description": "A gentle antibacterial face wash that cleanses skin of impurities and prevents future breakouts without drying."
                },
                {
                    "id": 103,
                    "title": "Ubtan Skin Radiance Scrub",
                    "name": "Ubtan Skin Radiance Scrub",
                    "category": "Skincare",
                    "price": 14.99,
                    "explanation": "An organic brightening scrub crafted with turmeric, saffron, and walnut shell powder to gently polish and reveal glowing skin.",
                    "description": "An organic brightening scrub crafted with turmeric, saffron, and walnut shell powder to gently polish and reveal glowing skin."
                }
            ]

        # 2. SEMANTIC RETRIEVAL (TF-IDF Matching)
        kb_texts = []
        for k in knowledge:
            topic = k.get('topic', k.get('title', ''))
            sub_topic = k.get('sub_topic', k.get('category', ''))
            content = k.get('content', '')
            keywords = k.get('keywords', '')
            kb_texts.append(f"{topic} {sub_topic} {content} {keywords}".lower())

        kb_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 3))
        kb_matrix = kb_vectorizer.fit_transform(kb_texts)
        query_vec = kb_vectorizer.transform([query_lower])
        similarities = cosine_similarity(query_vec, kb_matrix).flatten()
        
        threshold = 0.05
        top_indices = np.argsort(similarities)[::-1]
        relevant_kb = [knowledge[i] for i in top_indices if similarities[i] > threshold]
        
        # Keyword Fallback if semantic overlap is sparse
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

        # 3. PRODUCT MATCHING
        prod_texts = [f"{p['title'] or p['name']} {p['category']} {p['explanation'] or p['description']}".lower() for p in products]
        prod_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
        prod_matrix = prod_vectorizer.fit_transform(prod_texts)
        prod_query_vec = prod_vectorizer.transform([query_lower])
        prod_similarities = cosine_similarity(prod_query_vec, prod_matrix).flatten()
        
        matched_indices = np.where(prod_similarities > 0.05)[0]
        matched_products = [products[i] for i in matched_indices]
        matched_products = sorted(matched_products, key=lambda x: prod_similarities[products.index(x)], reverse=True)
        
        # Standardize product naming for downstream tasks
        for p in matched_products:
            if 'name' not in p or not p['name']:
                p['name'] = p.get('title', 'Skincare Product')

        # 4. LLM API Synthesis with Timeout Control
        context = "SCIENTIFIC DATA:\n"
        for k in relevant_kb:
            topic = k.get('topic', k.get('title', ''))
            content = k.get('content', '')
            context += f"- {topic}: {content}\n"
        
        context += "\nPRODUCT INVENTORY:\n"
        for p in matched_products[:3]:
            context += f"- {p['name']} (${p['price']}): {p['explanation'] or p['description']}\n"

        system_prompt = """You are the Lead Clinical Skincare Expert & Shopping Assistant for V-CHAT.
        Your personality is 50% ChatGPT (incredibly human-like, conversational, witty, empathetic), 25% Expert Skincare Consultant, and 25% Intelligent Shopping Assistant.
        
        INSTRUCTIONS:
        1. **Talk like a human**: Speak naturally, vary your opening sentences, use active empathy. NEVER sound robotic, machine-like, or scripted.
        2. **Grounded clinical logic**: Strictly ground recommendations and science in the provided SCIENTIFIC DATA and PRODUCT INVENTORY. If recommending products, use their exact names and prices.
        3. **Missing Profile Data**: If the user is asking for product recommendations or a routine but has not mentioned their skin type, concern, or budget, ask helpful, friendly step-by-step follow-up questions instead of guessing.
        4. **Tone**: Curiously friendly, authoritative yet completely approachable. Use premium terminologies naturally (e.g. "stratum corneum," "sebum regulation," "lipid barrier") but keep it conversational.
        5. **Small Talk & Humor**: Handle small talk, humor, jokes, and greetings naturally. Do not force product recommendations into casual small talk.
        6. **Formatting Structure**: You MUST format your response strictly using the following Markdown headers and section layout:
           
           ### Introduction
           [Brief overview of the topic or problem]
           
           ### Main Discussion
           [Detailed explanation, features, analysis, or conversation content]
           
           ### Point 1
           [First major point or explanation]
           
           ### Point 2
           [Second major point or explanation]
           
           ### Example / Demonstration
           [Optional examples or scenarios, omit this section if not relevant]
           
           ### Conclusion
           [Final summary, recommendation, or closing statement]
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

        # 5. Local synthesis fallback if all APIs are offline
        print("[CHATBOT SERVICE] Triggering high-fidelity local fallback synthesis...")
        return local_rag_fallback(relevant_kb, matched_products, query)

    except Exception as general_err:
        print(f"[CHATBOT SERVICE] Fatal error during perform_rag_chat: {general_err}")
        traceback.print_exc()
        return "An internal server error occurred while processing your query. Please check database tables."
    finally:
        pass
