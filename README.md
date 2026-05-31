# ReviewLens: AI Skincare Recommendation & Intelligence Platform

ReviewLens is a high-performance, AI-powered skincare intelligence platform that delivers expert-level, scientifically grounded product insights, trust-scoring, and personalized clinical recommendations.

---

## 📂 Project Structure

```
ReviewLens/
├── client/          # Frontend application (React + Vite)
├── server/          # Backend application API gateway (Node.js + Express)
├── ml_service/      # AI, RAG & Machine Learning microservice (Python + Flask)
├── database/        # SQL schemas, migration scripts, and seeds
└── README.md        # Setup and startup documentation (this file)
```

---

## ⚡ Quick Start & Startup Sequence

For the application to function fully, run all three services in separate terminals in the following sequence:

### 1. Database Setup
Ensure you have a MySQL server running (e.g. via XAMPP, local service, or Docker) and a database named `ai_recommender` created.
```bash
# Navigate to database folder
cd database

# Initialize schema and seed data
mysql -u root -p ai_recommender < schema_v3.sql
mysql -u root -p ai_recommender < migration_v3.sql
mysql -u root -p ai_recommender < feedback_schema.sql
mysql -u root -p ai_recommender < knowledge_schema.sql
mysql -u root -p ai_recommender < skincare_data.sql
mysql -u root -p ai_recommender < knowledge_data.sql
```

### 2. ML Service (Python Flask)
*Port: `8000`* | *Health Check: `http://localhost:8000/health`*
```bash
# Navigate to ml_service folder
cd ml_service

# (Optional) Create and activate a clean virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install exact python dependencies
pip install -r requirements.txt

# Run the Flask service
python app.py
```

### 3. Backend Gateway Server (Node.js Express)
*Port: `5000`* | *Health Check: `http://localhost:5000/health` or `http://localhost:5000/api/health`*
```bash
# Navigate to server folder
cd server

# Install backend dependencies
npm install

# Setup environment configuration
copy .env.example .env   # (Edit .env to supply database credentials & API keys)

# Start backend server in development mode
npm run dev
```

### 4. Frontend Client (React Vite)
*Port: `5173`* | *Development Server URL: `http://localhost:5173`*
```bash
# Navigate to client folder
cd client

# Install frontend dependencies
npm install

# Setup environment configuration
copy .env.example .env   # (Edit .env as needed)

# Start client development server
npm run dev
```

---

## 🔌 API Port & Microservice Architecture

The application communicates over the following standard localhost ports:
* **Frontend Client**: `http://localhost:5173` (Vite)
* **Backend API Gateway**: `http://localhost:5000` (Express)
* **ML Service Backend**: `http://localhost:8000` (Flask)

### 🏥 Health Check Endpoints
Use these endpoints to verify service health and connectivity status:
* **Backend Gateway Health Check**: `GET http://localhost:5000/health`
* **Backend API-scoped Health Check**: `GET http://localhost:5000/api/health`
* **ML Service Health Check**: `GET http://localhost:8000/health` (Returns LLM client connection flags for Gemini/Groq)

---

## ⚙️ Environment Variables Setup

### Backend Server (`server/.env`)
Create a `.env` file in the `/server` folder with:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key_here          # Enforced on startup
VITE_SUPABASE_URL=https://your-supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
ML_SERVICE_URL=http://localhost:8000
```

### ML Service (`ml_service/.env`)
Create a `.env` file in the `/ml_service` folder with:
```env
PORT=8000
FRONTEND_URL=http://localhost:5173           # Enforced for secure CORS restriction
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
VITE_SUPABASE_URL=https://your-supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Frontend Client (`client/.env`)
Create a `.env` file in the `/client` folder with:
```env
VITE_SUPABASE_URL=https://your-supabase-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
VITE_API_URL=http://localhost:5000
```

---

## 🛡️ Production Hardening Protections (Phase 1)
The system has been hardened for production-grade security:
1. **Zero Hardcoded Secrets**: All keys, URLs, and secrets have been verified and migrated to environment variables. Real credentials are never committed.
2. **CORS Restrictions**: Wildcard CORS domains have been replaced in the Python FastAPI microservice with a strict whitelist domain check enforcing `FRONTEND_URL`.
3. **Secure JWT Startup Check**: The Express server will gracefully crash (`process.exit(1)`) on boot if the required `JWT_SECRET` environment variable is not defined.
4. **API Rate Limiting**: Centralized rate limiting has been enforced via `express-rate-limit`:
   - **Chat APIs** (`/api/ai/chat/*`): 20 requests/minute limit.
   - **Review Submissions** (`/api/feedback/submit`): 10 requests/minute limit.
   - **Auth Gateways** (`/api/auth/*`): 5 requests/minute limit.
   - Evaluated requests exceeding thresholds are returned with standard HTTP 429 response structures.

