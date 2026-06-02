-- ==============================================================================
-- REVIEWLENS: AUTHORITATIVE SUPABASE POSTGRESQL MASTER DATABASE SCHEMA
-- Version: 1.0.0
-- Authority: Single source of truth for database migrations and deployments
-- ==============================================================================

-- Enable required core PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- Optional 1536-dim embeddings support

-- ------------------------------------------------------------------------------
-- 1. PRODUCTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text DEFAULT '',
    name text DEFAULT '',
    description text,
    explanation text,
    features jsonb DEFAULT NULL, -- e.g., JSON arrays or objects
    category text,
    price numeric NOT NULL,
    rating numeric(3, 2),
    brand text DEFAULT 'Generic',
    stock integer DEFAULT 0,
    thumbnail text,
    image_url text,
    images jsonb DEFAULT '[]'::jsonb,
    trust_score integer DEFAULT 80,
    reviews_count integer DEFAULT 0,
    affiliate_amazon text,
    affiliate_flipkart text,
    keywords jsonb DEFAULT '[]'::jsonb,
    ai_summary_cache jsonb DEFAULT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. PROFILES TABLE (Linked to Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username text UNIQUE,
    email text,
    avatar_url text,
    age integer,
    skin_type text DEFAULT 'normal',
    max_budget numeric DEFAULT 1500,
    preferred_categories text[] DEFAULT '{}'::text[],
    viewed_products integer[] DEFAULT '{}'::integer[],
    recommendation_history jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. WATCHLISTS TABLE (Linked to auth.users & products)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlists (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    product_id integer NOT NULL,
    product_name text,
    category text,
    price numeric,
    image_url text,
    target_price numeric,
    added_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, product_id)
);

-- ------------------------------------------------------------------------------
-- 4. FEEDBACKS TABLE (User reviews & AI sentiment audits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    
    -- User-focused input fields
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review text,
    emoji varchar(10),
    verified_purchase boolean DEFAULT false,
    helpful_votes integer DEFAULT 0,
    sentiment varchar(50) DEFAULT 'neutral',
    
    -- NLP Analysis & legacy python pipeline fields
    product_name text,
    review_text text,
    source varchar(50) DEFAULT 'Customer',
    mentioned_ingredients text,
    trust_score integer DEFAULT 100,
    verdict varchar(20) DEFAULT 'Genuine',
    is_public boolean DEFAULT true,
    
    created_at timestamp with time zone DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. REVIEW ANALYSIS CACHE (Aggregated NLP sentiment analysis metrics)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_analysis_cache (
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE PRIMARY KEY,
    positive_mentions jsonb DEFAULT '{}'::jsonb, -- e.g., {"battery": 15, "ingredients": 18}
    negative_mentions jsonb DEFAULT '{}'::jsonb, -- e.g., {"battery": 2, "sebum": 4}
    fake_review_probability integer DEFAULT 0, -- (0-100)%
    flags jsonb DEFAULT '[]'::jsonb, -- e.g., ["spam_burst", "temporal_anomaly"]
    updated_at timestamp with time zone DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. COMPARISON SCORES (Results of specific query comparison analyses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comparison_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    preference_scores jsonb NOT NULL, -- e.g., {"product_1": {"Ingredients": 85}, "product_2": {"Ingredients": 70}}
    winner_product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    explanation text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. COMPARISON HISTORY (Chronological query history of comparisons ran)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comparison_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    comparison_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 8. SAVED COMPARISONS (User saved comparisons history with custom notes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_comparisons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unique_user_comparison UNIQUE (user_id, product_1_id, product_2_id)
);

-- ------------------------------------------------------------------------------
-- 9. KNOWLEDGE BASE (Grounding corpus for AI RAG pipeline queries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    embedding vector(1536), -- Vector embeddings (OpenAI / Gemini)
    source text,
    tags text[] DEFAULT '{}'::text[],
    topic text,
    sub_topic text,
    keywords text,
    created_at timestamp with time zone DEFAULT now()
);

-- ==============================================================================
-- TRIGGERS & PL/PGSQL PROCEDURAL FUNCTIONS
-- ==============================================================================

-- Trigger: Automatic Profile creation on Auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, avatar_url, age, skin_type, max_budget, preferred_categories)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/bottts/svg?seed=' || NEW.id),
    25,
    'normal',
    1500,
    '{"Skincare", "Electronics"}'::text[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: Bidirectional synchronization for knowledge_base
CREATE OR REPLACE FUNCTION public.sync_knowledge_base_columns()
RETURNS trigger AS $$
BEGIN
    -- Sync title and topic
    IF NEW.title IS NOT NULL AND NEW.topic IS NULL THEN
        NEW.topic := NEW.title;
    ELSIF NEW.topic IS NOT NULL AND NEW.title IS NULL THEN
        NEW.title := NEW.topic;
    END IF;

    -- Sync category and sub_topic
    IF NEW.category IS NOT NULL AND NEW.sub_topic IS NULL THEN
        NEW.sub_topic := NEW.category;
    ELSIF NEW.sub_topic IS NOT NULL AND NEW.category IS NULL THEN
        NEW.category := NEW.sub_topic;
    END IF;

    -- Sync tags array and comma-separated keywords string
    IF NEW.tags IS NOT NULL AND cardinality(NEW.tags) > 0 AND NEW.keywords IS NULL THEN
        NEW.keywords := array_to_string(NEW.tags, ', ');
    ELSIF NEW.keywords IS NOT NULL AND (NEW.tags IS NULL OR cardinality(NEW.tags) = 0) THEN
        NEW.tags := string_to_array(NEW.keywords, ', ');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_knowledge_base_columns ON public.knowledge_base;
CREATE TRIGGER trg_sync_knowledge_base_columns
BEFORE INSERT OR UPDATE ON public.knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.sync_knowledge_base_columns();

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- 1. profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. watchlists policies
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.watchlists;
CREATE POLICY "Users can view their own watchlist" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own watchlist" ON public.watchlists;
CREATE POLICY "Users can insert their own watchlist" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own watchlist" ON public.watchlists;
CREATE POLICY "Users can delete their own watchlist" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own watchlist" ON public.watchlists;
CREATE POLICY "Users can update their own watchlist" ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);

-- 3. feedbacks policies
DROP POLICY IF EXISTS "Public feedbacks are viewable by everyone" ON public.feedbacks;
CREATE POLICY "Public feedbacks are viewable by everyone" ON public.feedbacks FOR SELECT USING (is_public = true);
DROP POLICY IF EXISTS "Users can insert their own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can insert their own feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Users can manage their own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can manage their own feedbacks" ON public.feedbacks FOR ALL USING (auth.uid() = user_id);

-- 4. review_analysis_cache policies
DROP POLICY IF EXISTS "Public can view analysis caches" ON public.review_analysis_cache;
CREATE POLICY "Public can view analysis caches" ON public.review_analysis_cache FOR SELECT USING (true);

-- 5. comparison_scores policies
DROP POLICY IF EXISTS "Users can manage comparison scores" ON public.comparison_scores;
CREATE POLICY "Users can manage comparison scores" ON public.comparison_scores FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- 6. comparison_history policies
DROP POLICY IF EXISTS "Users can view their own comparison history" ON public.comparison_history;
CREATE POLICY "Users can view their own comparison history" ON public.comparison_history FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own comparison history" ON public.comparison_history;
CREATE POLICY "Users can insert their own comparison history" ON public.comparison_history FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 7. saved_comparisons policies
DROP POLICY IF EXISTS "Users can manage their saved comparisons" ON public.saved_comparisons;
CREATE POLICY "Users can manage their saved comparisons" ON public.saved_comparisons FOR ALL USING (auth.uid() = user_id);

-- 8. knowledge_base policies
DROP POLICY IF EXISTS "Knowledge base is viewable by everyone" ON public.knowledge_base;
CREATE POLICY "Knowledge base is viewable by everyone" ON public.knowledge_base FOR SELECT USING (true);

-- ==============================================================================
-- DATABASE PERFORMANCE INDEXES
-- ==============================================================================

-- products indexing
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_trust_score ON public.products(trust_score);

-- feedbacks indexing
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON public.feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_product_id ON public.feedbacks(product_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_is_public ON public.feedbacks(is_public);

-- comparison_scores indexing
CREATE INDEX IF NOT EXISTS idx_comp_scores_users ON public.comparison_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_scores_products ON public.comparison_scores(product_1_id, product_2_id);

-- comparison_history indexing
CREATE INDEX IF NOT EXISTS idx_comp_history_user_id ON public.comparison_history(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_products ON public.comparison_history(product_1_id, product_2_id);

-- saved_comparisons indexing
CREATE INDEX IF NOT EXISTS idx_saved_comp_user_id ON public.saved_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_comp_products ON public.saved_comparisons(product_1_id, product_2_id);

-- knowledge_base indexing
CREATE INDEX IF NOT EXISTS idx_kb_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_topic ON public.knowledge_base(topic);
CREATE INDEX IF NOT EXISTS idx_kb_title ON public.knowledge_base(title);
CREATE INDEX IF NOT EXISTS idx_kb_tags ON public.knowledge_base USING GIN(tags);
