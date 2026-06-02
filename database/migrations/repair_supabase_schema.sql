-- =========================================================================
-- REVIEWLENS: SUPABASE DATABASE REPAIR MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Safely repair schema, add missing columns, and create new tables
--          while maintaining absolute compatibility with existing Node.js backend
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- STEP 1: Safely upgrade products table
-- -------------------------------------------------------------------------
-- Alter products table to ensure all missing backend columns are present.
-- Uses `IF NOT EXISTS` to avoid disrupting any existing columns.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 80;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_amazon text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_flipkart text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS keywords jsonb DEFAULT '[]'::jsonb;

-- -------------------------------------------------------------------------
-- STEP 2: Create feedbacks table
-- -------------------------------------------------------------------------
-- Creates the feedbacks table incorporating both user requested columns
-- and the backend payload requirements for 100% backward compatibility.

CREATE TABLE IF NOT EXISTS public.feedbacks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    
    -- User-requested fields
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review text,
    emoji varchar(10),
    verified_purchase boolean DEFAULT false,
    helpful_votes integer DEFAULT 0,
    sentiment varchar(50) DEFAULT 'neutral',
    
    -- Backend-required fields for 100% compatibility with submitFeedback()
    product_name text,
    review_text text,
    source varchar(50),
    mentioned_ingredients text,
    trust_score integer DEFAULT 100,
    verdict varchar(20) DEFAULT 'Genuine',
    is_public boolean DEFAULT true,
    
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for feedbacks table
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Set up permissive/secure policies for feedbacks
DROP POLICY IF EXISTS "Public feedbacks are viewable by everyone" ON public.feedbacks;
CREATE POLICY "Public feedbacks are viewable by everyone" ON public.feedbacks
    FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert their own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can insert their own feedbacks" ON public.feedbacks
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own feedbacks" ON public.feedbacks;
CREATE POLICY "Users can manage their own feedbacks" ON public.feedbacks
    FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- STEP 3: Create comparison_history table
-- -------------------------------------------------------------------------
-- Stores chronological history of product comparisons ran by users

CREATE TABLE IF NOT EXISTS public.comparison_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    comparison_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for comparison_history
ALTER TABLE public.comparison_history ENABLE ROW LEVEL SECURITY;

-- Set up secure policies for comparison_history
DROP POLICY IF EXISTS "Users can view their own comparison history" ON public.comparison_history;
CREATE POLICY "Users can view their own comparison history" ON public.comparison_history
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own comparison history" ON public.comparison_history;
CREATE POLICY "Users can insert their own comparison history" ON public.comparison_history
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- -------------------------------------------------------------------------
-- STEP 4: Create saved_comparisons table
-- -------------------------------------------------------------------------
-- Allows users to save favorite comparisons and add optional custom notes

CREATE TABLE IF NOT EXISTS public.saved_comparisons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_1_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    product_2_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    
    -- Ensure same products aren't saved multiple times by the same user
    CONSTRAINT unique_user_comparison UNIQUE (user_id, product_1_id, product_2_id)
);

-- Enable RLS for saved_comparisons
ALTER TABLE public.saved_comparisons ENABLE ROW LEVEL SECURITY;

-- Set up secure policies for saved_comparisons
DROP POLICY IF EXISTS "Users can manage their saved comparisons" ON public.saved_comparisons;
CREATE POLICY "Users can manage their saved comparisons" ON public.saved_comparisons
    FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- STEP 5: Create Performance Indexes
-- -------------------------------------------------------------------------
-- Create single and compound indexes to accelerate standard query patterns

-- products indexing
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_trust_score ON public.products(trust_score);

-- feedbacks indexing
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON public.feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_product_id ON public.feedbacks(product_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_product_name ON public.feedbacks(product_name);
CREATE INDEX IF NOT EXISTS idx_feedbacks_is_public ON public.feedbacks(is_public);

-- comparison_history indexing
CREATE INDEX IF NOT EXISTS idx_comp_history_user_id ON public.comparison_history(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_history_products ON public.comparison_history(product_1_id, product_2_id);

-- saved_comparisons indexing
CREATE INDEX IF NOT EXISTS idx_saved_comp_user_id ON public.saved_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_comp_products ON public.saved_comparisons(product_1_id, product_2_id);
