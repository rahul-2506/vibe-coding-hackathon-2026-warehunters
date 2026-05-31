-- =========================================================================
-- REVIEWLENS: REVIEWS SCHEMA CONSOLIDATION MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Unify feedbacks and reviews under a single reviews table,
--          perform safe records migration, and drop the feedbacks table
-- =========================================================================

-- 1. Ensure reviews table exists with all standard columns
CREATE TABLE IF NOT EXISTS public.reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    product_name text, -- for name-based fallback compatibility
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

-- 2. Safely migrate existing data from feedbacks to reviews if table exists
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
        
        -- Drop the feedbacks table once data is fully secure
        DROP TABLE public.feedbacks;
    END IF;
END $$;

-- 3. Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Public reviews are viewable by everyone" ON public.reviews
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert reviews" ON public.reviews;
CREATE POLICY "Users can insert reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
