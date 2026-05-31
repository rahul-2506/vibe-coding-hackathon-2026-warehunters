# ReviewLens Python ML AI Service (FastAPI)

This is the production-ready FastAPI AI server for the ReviewLens project. It acts as the intelligent backend bridging database semantic searches, custom NLP machine learning classifiers, and generative AI models (Gemini & Groq).

---

## Prerequisite Setup

Ensure you have Python 3.9+ installed on your system.

### 1. Install Dependencies
Navigate into the `ml_service` directory and install the updated requirements:
```bash
cd ml_service
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` inside the `ml_service` directory:
```bash
cp .env.example .env
```
Fill in your credentials:
* **GEMINI_API_KEY**: Your Google Gemini API key (recommended primary engine).
* **GROQ_API_KEY**: Your Groq API key (used as an automated fallback engine).
* **VITE_SUPABASE_URL** & **VITE_SUPABASE_ANON_KEY**: Credentials to connect to Supabase for live product and knowledge database querying.

> [!NOTE]
> If no API keys are configured, the microservice automatically triggers intelligent offline fallback algorithms to prevent any visible errors or app crashes during demos.

---

## Running the Server

Start the FastAPI microservice on its required address (`localhost:8000`):

```bash
python app.py
```
Or start it directly using Uvicorn:
```bash
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

---

## API Endpoints Verified

* **GET `/health`**: Returns system configuration and connectivity diagnostics.
* **POST `/rag_chat`**: Coordinates semantic retrieval, Supabase querying, and LLM synthesis with offline fallbacks. Returns both `reply` and `response` tags.
* **POST `/predict`**: Real/Fake review classifier running lazy-trained Naive Bayes.
* **POST `/compare_analysis`**: Clinical comparative analysis between two products.
* **POST `/recommend_products`**: Visual and query matches using Gemini.
* **POST `/clinical_recommend`**: Highly robust local clinical matching based on user concern/skin type.
* **POST `/scrape_price`**: DuckDuckGo search price scraper.
* **POST `/search_by_image`** & **`/ocr_search`**: Multimodal visual label extraction and matching.
