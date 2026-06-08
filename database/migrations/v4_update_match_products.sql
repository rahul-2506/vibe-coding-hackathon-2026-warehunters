-- ==============================================================================
-- REVIEWLENS: MIGRATION V4 - UPDATE MATCH_PRODUCTS RPC FUNCTION
-- Target: PostgreSQL / Supabase
-- Description: Recreates public.match_products to accept 4 parameters:
--              1. query_embedding (vector(1536))
--              2. match_threshold (float)
--              3. match_count (int)
--              4. category_filter (text)
-- ==============================================================================

-- Drop the old 3-parameter function if it exists to avoid overload conflicts
DROP FUNCTION IF EXISTS public.match_products(vector, float, int);
DROP FUNCTION IF EXISTS public.match_products(vector, double precision, integer);

-- Recreate function with 4 parameters supporting category filtering
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
