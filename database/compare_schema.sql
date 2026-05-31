-- =========================================================================
-- REVIEWLENS: COMPARISON ENGINE SCHEMA MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Create review_analysis_cache and comparison_scores tables
-- =========================================================================

-- 1. Cache for product-specific NLP review analytical evaluations
CREATE TABLE IF NOT EXISTS public.review_analysis_cache (
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE PRIMARY KEY,
    positive_mentions jsonb DEFAULT '{}'::jsonb, -- e.g., {"battery": 15, "performance": 24, "ingredients": 18}
    negative_mentions jsonb DEFAULT '{}'::jsonb, -- e.g., {"battery": 2, "performance": 1}
    fake_review_probability integer DEFAULT 0, -- probability (0-100)
    flags jsonb DEFAULT '[]'::jsonb, -- lists audit warning flags, e.g. ["spam_burst"]
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Scores generated for user-specific product comparison queries
CREATE TABLE IF NOT EXISTS public.comparison_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    preference_scores jsonb NOT NULL, -- e.g., {"product_1": {"battery": 85}, "product_2": {"battery": 60}}
    winner_product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    explanation text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS policies
ALTER TABLE public.review_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view analysis caches" ON public.review_analysis_cache;
CREATE POLICY "Public can view analysis caches" ON public.review_analysis_cache
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage comparison scores" ON public.comparison_scores;
CREATE POLICY "Users can manage comparison scores" ON public.comparison_scores
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Indexes for performance acceleration
CREATE INDEX IF NOT EXISTS idx_comp_scores_users ON public.comparison_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_scores_products ON public.comparison_scores(product_1_id, product_2_id);
