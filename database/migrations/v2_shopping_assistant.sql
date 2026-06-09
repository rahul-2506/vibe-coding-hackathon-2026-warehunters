-- ==============================================================================
-- REVIEWLENS V2: CONSOLIDATED DATABASE SCHEMAS & SHOPPING ASSISTANT MIGRATION
-- Target: PostgreSQL / Supabase
-- Description: Sets up pgvector columns, match_products function, dynamic product
--              reviews, search cache, chat sessions, user memories, preferences,
--              and analytics event tables.
-- Instructions: Run this entire script in the Supabase SQL Editor.
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Upgrade products table with dynamic fields and pgvector column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS original_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated timestamp with time zone DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add unique constraint on external_id to support deduplication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_external_id_key'
    ) THEN
        ALTER TABLE public.products ADD CONSTRAINT products_external_id_key UNIQUE (external_id);
    END IF;
END $$;

-- 2. Create Product Features table
CREATE TABLE IF NOT EXISTS public.product_features (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    feature_name text NOT NULL,
    feature_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Create Product Reviews table (dynamic review pipeline)
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    review_text text NOT NULL,
    rating numeric NOT NULL,
    sentiment text DEFAULT 'neutral',
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Chat Sessions Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    sender text NOT NULL CHECK (sender IN ('user', 'assistant')),
    message text NOT NULL,
    data jsonb DEFAULT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 6. User Memories Table (AI Shopping Agent Persistent Context)
CREATE TABLE IF NOT EXISTS public.user_memories (
    user_id text PRIMARY KEY,
    memory jsonb DEFAULT '{
        "skin_type": "",
        "concerns": [],
        "budget": "",
        "favorite_brands": [],
        "allergies": [],
        "past_recommendations": [],
        "conversation_summary": "",
        "tool_history": []
    }'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- 7. User Preferences Table (Structured personalization filters)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    skin_type text DEFAULT 'normal',
    budget numeric DEFAULT 1500,
    concerns text[] DEFAULT '{}'::text[],
    preferred_brands text[] DEFAULT '{}'::text[],
    disliked_ingredients text[] DEFAULT '{}'::text[],
    product_interests jsonb DEFAULT '[]'::jsonb,
    recommendation_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 8. Search Cache Table (Aggregator caching layer)
CREATE TABLE IF NOT EXISTS public.search_cache (
    query text PRIMARY KEY,
    results jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

-- 9. User Search History Table (Analytics & Recents)
CREATE TABLE IF NOT EXISTS public.user_search_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    query text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 10. User Product Events Table (Analytics, personalization feedback)
CREATE TABLE IF NOT EXISTS public.user_product_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- 'view', 'click', 'wishlist', 'compare', 'like', 'dislike', 'purchase', 'share'
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 11. User Conversations Table
CREATE TABLE IF NOT EXISTS public.user_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text DEFAULT 'New Shopping Dialogue',
    context jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & DEFINE POLICIES
-- ==============================================================================
ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_conversations ENABLE ROW LEVEL SECURITY;

-- Define Policies
DROP POLICY IF EXISTS "Allow public read of product features" ON public.product_features;
CREATE POLICY "Allow public read of product features" ON public.product_features FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of product features" ON public.product_features;
CREATE POLICY "Allow public insert of product features" ON public.product_features FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of product reviews" ON public.product_reviews;
CREATE POLICY "Allow public read of product reviews" ON public.product_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert of product reviews" ON public.product_reviews;
CREATE POLICY "Allow public insert of product reviews" ON public.product_reviews FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage messages in their sessions" ON public.chat_messages;
CREATE POLICY "Users can manage messages in their sessions" ON public.chat_messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.chat_sessions 
        WHERE chat_sessions.id = chat_messages.session_id 
        AND (chat_sessions.user_id = auth.uid() OR chat_sessions.user_id IS NULL)
    )
);

DROP POLICY IF EXISTS "Allow users to manage their own memories" ON public.user_memories;
CREATE POLICY "Allow users to manage their own memories" ON public.user_memories FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Public read-only search cache" ON public.search_cache;
CREATE POLICY "Public read-only search cache" ON public.search_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role write search cache" ON public.search_cache;
CREATE POLICY "Service role write search cache" ON public.search_cache FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can manage their search history" ON public.user_search_history;
CREATE POLICY "Users can manage their search history" ON public.user_search_history FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their product events" ON public.user_product_events;
CREATE POLICY "Users can manage their product events" ON public.user_product_events FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their conversations" ON public.user_conversations;
CREATE POLICY "Users can manage their conversations" ON public.user_conversations FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_product_features_product_id ON public.product_features(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON public.user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON public.search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON public.user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_events_user_id ON public.user_product_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_events_product_id ON public.user_product_events(product_id);
CREATE INDEX IF NOT EXISTS idx_user_product_events_type ON public.user_product_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_conversations_user_id ON public.user_conversations(user_id);

-- ==============================================================================
-- CREATE SIMILARITY MATCH RPC FUNCTION FOR VECTOR SEARCH
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.match_products (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  external_id text,
  title text,
  brand text,
  category text,
  description text,
  image_url text,
  product_url text,
  price numeric,
  original_price numeric,
  rating numeric,
  review_count integer,
  source text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.external_id,
    COALESCE(p.title, p.name) as title,
    p.brand,
    p.category,
    p.description,
    COALESCE(p.image_url, p.thumbnail) as image_url,
    p.product_url,
    p.price,
    COALESCE(p.original_price, p.price) as original_price,
    p.rating,
    COALESCE(p.review_count, p.reviews_count) as review_count,
    p.source,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.products p
  WHERE p.embedding IS NOT NULL
    AND (category_filter IS NULL OR p.category = category_filter)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
