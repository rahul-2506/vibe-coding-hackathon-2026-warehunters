-- =========================================================================
-- REVIEWLENS: CONSOLIDATED SUPABASE MASTER DATABASE REPAIR & STANDARDISATION
-- Target: PostgreSQL / Supabase
-- Purpose: Unifies all schema definitions, creates missing tables, repairs 
--          watchlist layouts, standardises reviews, and sets up secure RLS.
-- Instructions: Run this entire script once in the Supabase SQL Editor.
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- STEP 1: Upgraded Profiles & Products (Verification)
-- -------------------------------------------------------------------------
-- Ensures standard profiles and products tables are fully aligned.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 80;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_amazon text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_flipkart text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS keywords jsonb DEFAULT '[]'::jsonb;

-- -------------------------------------------------------------------------
-- STEP 2: Create Watchlists Table (with JSONB items alignment)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlists (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    items jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT watchlists_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.watchlists;
CREATE POLICY "Users can manage their own watchlist" ON public.watchlists
    FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- STEP 3: Create Comparison Infrastructure
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comparison_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    comparison_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_comparisons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT unique_user_comparison UNIQUE (user_id, product_1_id, product_2_id)
);

CREATE TABLE IF NOT EXISTS public.comparison_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    preference_scores jsonb NOT NULL,
    winner_product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    explanation text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.comparison_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage comparison history" ON public.comparison_history;
CREATE POLICY "Users can manage comparison history" ON public.comparison_history
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage saved comparisons" ON public.saved_comparisons;
CREATE POLICY "Users can manage saved comparisons" ON public.saved_comparisons
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage comparison scores" ON public.comparison_scores;
CREATE POLICY "Users can manage comparison scores" ON public.comparison_scores
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- -------------------------------------------------------------------------
-- STEP 4: Create Product Scientific Verifiers Table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_scientific_verifiers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name text NOT NULL,
    term text NOT NULL,
    category text DEFAULT 'general',
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scientific_verifiers_product_name 
    ON public.product_scientific_verifiers(product_name);

INSERT INTO public.product_scientific_verifiers (product_name, term, category) VALUES
('The Derma Co 1% Salicylic Acid Facewash', 'salicylic', 'active'),
('The Derma Co 1% Salicylic Acid Facewash', 'BHA', 'active'),
('The Derma Co 1% Salicylic Acid Facewash', 'sebum', 'active'),
('Himalaya Purifying Neem Facewash', 'neem', 'active'),
('Himalaya Purifying Neem Facewash', 'turmeric', 'active'),
('Himalaya Purifying Neem Facewash', 'antibacterial', 'active'),
('Mamaearth Ubtan Facewash', 'saffron', 'active'),
('Mamaearth Ubtan Facewash', 'turmeric', 'active'),
('Mamaearth Ubtan Facewash', 'brightening', 'active')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------
-- STEP 5: Create and Standardise Reviews Table (Consolidation)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    product_name text,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text text NOT NULL,
    emoji varchar(10),
    source varchar(50) DEFAULT 'Customer',
    mentioned_ingredients text,
    trust_score integer DEFAULT 100,
    verdict varchar(20) DEFAULT 'Genuine',
    is_public boolean DEFAULT true,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    sentiment varchar(20) DEFAULT 'neutral',
    authenticity_score integer DEFAULT 100,
    created_at timestamp with time zone DEFAULT now()
);

-- Safely migrate existing feedbacks data to consolidated reviews table if feedbacks exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feedbacks') THEN
        INSERT INTO public.reviews (
            product_name, rating, review_text, emoji, source, 
            mentioned_ingredients, trust_score, verdict, is_public, user_id, created_at
        )
        SELECT 
            product_name, rating, review_text, emoji, source, 
            mentioned_ingredients, trust_score, verdict, is_public, user_id, created_at
        FROM public.feedbacks
        ON CONFLICT DO NOTHING;
        
        -- Drop the legacy feedbacks table once data is migrated
        DROP TABLE public.feedbacks;
    END IF;
END $$;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Public reviews are viewable by everyone" ON public.reviews
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert reviews" ON public.reviews;
CREATE POLICY "Users can insert reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- -------------------------------------------------------------------------
-- STEP 6: Indexes for Accelerated Performance
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_user_id ON public.comparison_history(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_comp_user_id ON public.saved_comparisons(user_id);
