-- =========================================================================
-- REVIEWLENS: DYNAMIC PRODUCTS & VECTOR SEARCH MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Adds vector embedding support, custom properties, and review
--          ingestion schemas to the products table.
-- Instructions: Run this entire script once in the Supabase SQL Editor.
-- =========================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Upgrade Products table with dynamic fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS original_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated timestamp with time zone DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add unique constraint on external_id to support deduplication, ignoring nulls
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_external_id_key'
    ) THEN
        ALTER TABLE public.products ADD CONSTRAINT products_external_id_key UNIQUE (external_id);
    END IF;
END $$;

-- 3. Create Product Features table
CREATE TABLE IF NOT EXISTS public.product_features (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    feature_name text NOT NULL,
    feature_value text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Index for fast join queries on product features
CREATE INDEX IF NOT EXISTS idx_product_features_product_id ON public.product_features(product_id);

-- 4. Create Product Reviews table (dynamic review pipeline)
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    review_text text NOT NULL,
    rating numeric NOT NULL,
    sentiment text DEFAULT 'neutral',
    created_at timestamp with time zone DEFAULT now()
);

-- Index for fast lookup on product reviews
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);

-- Enable RLS for the new tables
ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Add select/insert policies viewable by everyone
DROP POLICY IF EXISTS "Allow public read of product features" ON public.product_features;
CREATE POLICY "Allow public read of product features" ON public.product_features 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert of product features" ON public.product_features;
CREATE POLICY "Allow public insert of product features" ON public.product_features 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of product reviews" ON public.product_reviews;
CREATE POLICY "Allow public read of product reviews" ON public.product_reviews 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert of product reviews" ON public.product_reviews;
CREATE POLICY "Allow public insert of product reviews" ON public.product_reviews 
    FOR INSERT WITH CHECK (true);

-- 5. Create Similarity Match Function (match_products RPC)
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
