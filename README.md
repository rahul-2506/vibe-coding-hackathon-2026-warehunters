# VChat AI - Production Deployment Guide & Architecture

VChat is an intelligent, multi-tier AI product recommendation engine consisting of a React Vite frontend, an Express Node.js backend proxy, and a FastAPI Python ML service. 

## 🏗️ Architecture & Deployment Strategy

Your production architecture is split across three robust platforms for scalability:

1. **Frontend (Vercel)**: React + Vite application (`/client`).
2. **Backend (Vercel Serverless / Node)**: Express.js server (`/server`).
3. **ML Service (Render)**: Python FastAPI service (`/ml_service`).
4. **Database (Supabase)**: PostgreSQL with pgvector for RAG.

---

## 🔑 Environment Variables & Keys Checklist

Before deploying, ensure you have these keys ready. 

### 1. Backend (`/server/.env`) -> Deployed on Vercel
| Variable | Value/Source | Purpose |
|----------|-------------|---------|
| `PORT` | `5000` | Port for the Node server. |
| `JWT_SECRET` | *(Your secure random string)* | Used for user session authentication. |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | CORS restriction to allow only your UI to talk to the API. |
| `VITE_SUPABASE_URL` | `https://<YOUR_ID>.supabase.co` | Connects Node to the Supabase database. |
| `VITE_SUPABASE_ANON_KEY` | *(Your Supabase Anon Key)* | Connects Node to Supabase securely. |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Your Supabase Role Key)* | For administrative DB access (bypassing RLS). |
| `ML_SERVICE_URL` | `https://your-ml-service.onrender.com` | Links the Node backend to the Render Python AI service. |
| `PRICE_SCRAPER_URL` | *(Optional)* | For external price scraping microservices. |
| `GROQ_API_KEY` | `gsk_...` | **CRITICAL:** The sole AI engine powering the VChat LLM logic. |

### 2. Frontend (`/client/.env`) -> Deployed on Vercel
| Variable | Value/Source | Purpose |
|----------|-------------|---------|
| `VITE_API_URL` | `https://your-backend.vercel.app` | Points the UI to your Vercel Node backend. |
| `VITE_SUPABASE_URL` | `https://<YOUR_ID>.supabase.co` | Direct UI -> Supabase connection (for auth/realtime). |
| `VITE_SUPABASE_ANON_KEY` | *(Your Supabase Anon Key)* | Required for Supabase client initialization. |

### 3. ML Service (`/ml_service/.env`) -> Deployed on Render
| Variable | Value/Source | Purpose |
|----------|-------------|---------|
| `PORT` | `18001` (Render will override) | Port for FastAPI. |
| `SUPABASE_URL` | `https://<YOUR_ID>.supabase.co` | Python RAG engine DB connection. |
| `SUPABASE_ANON_KEY` | *(Your Supabase Anon Key)* | Python DB connection. |
| `GROQ_API_KEY` | `gsk_...` | Used by the Python service for any auxiliary vector/inference fallbacks. |

---

## 🚀 Step-by-Step Deployment Plan

### Phase 1: Deploy ML Service to Render
Render is perfect for Python/FastAPI because it installs `requirements.txt` natively and binds to the exposed port.

1. Create a new **Web Service** on Render connected to your GitHub repo.
2. Set the Root Directory to `ml_service`.
3. Set the Build Command: `pip install -r requirements.txt`
4. Set the Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Add all the **ML Service Environment Variables** listed above.
6. Deploy and copy the resulting URL (e.g., `https://vchat-ml.onrender.com`).

### Phase 2: Deploy Node Backend to Vercel
Vercel can host Express apps using `vercel.json` serverless functions.

1. Ensure your `server/vercel.json` exists to route `/*` to `server.js` (or deploy via Vercel CLI).
2. Create a new project in Vercel. Set the Root Directory to `server`.
3. Override the Start Command to: `node server.js` (or leave default if Vercel detects Express).
4. **Crucial:** Add all **Backend Environment Variables**. Set `ML_SERVICE_URL` to the Render URL from Phase 1!
5. Deploy and copy the resulting backend URL (e.g., `https://vchat-api.vercel.app`).

### Phase 3: Deploy React Frontend to Vercel
1. Create another new project in Vercel. Set the Root Directory to `client`.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`
4. Add all **Frontend Environment Variables**. Set `VITE_API_URL` to the Backend URL from Phase 2!
5. Deploy.

### Phase 4: Final Verification
1. Open the Vercel frontend URL.
2. The diagnostic panel will automatically ping your Vercel backend (`/api/health`).
3. The Vercel backend will verify its own `GROQ_API_KEY` (AI: Yes) and asynchronously ping the Render ML service.
4. Try sending a chat message to ensure Groq responds and Supabase RAG retrieves products!
