-- ==============================================================================
-- REVIEWLENS: MIGRATION PHASE 6 - PRODUCT SCHEMA REFACTOR
-- Target: PostgreSQL / Supabase
-- Description: Sets up detail tables and alters the products table to support
--              the new Skincare and Electronics category schemas.
-- ==============================================================================

-- 1. Alter public.products table to add required price and timestamp fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_inr numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_original numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_updated timestamp with time zone DEFAULT now();

-- 2. Create public.skincare_details table
CREATE TABLE IF NOT EXISTS public.skincare_details (
    product_id bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    ingredients text DEFAULT '',
    key_ingredients text DEFAULT '',
    skin_type text DEFAULT '',
    concerns text DEFAULT ''
);

-- 3. Create public.electronics_details table
CREATE TABLE IF NOT EXISTS public.electronics_details (
    product_id bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    specifications_json jsonb DEFAULT '{}'::jsonb,
    technical_features text DEFAULT ''
);

-- 4. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.skincare_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electronics_details ENABLE ROW LEVEL SECURITY;

-- 5. Create secure public SELECT policies
DROP POLICY IF EXISTS "Skincare details are viewable by everyone" ON public.skincare_details;
CREATE POLICY "Skincare details are viewable by everyone" ON public.skincare_details
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Electronics details are viewable by everyone" ON public.electronics_details;
CREATE POLICY "Electronics details are viewable by everyone" ON public.electronics_details
    FOR SELECT USING (true);

-- 6. Create ALL policies for service role / authenticated writes
DROP POLICY IF EXISTS "Allow all operations on skincare details" ON public.skincare_details;
CREATE POLICY "Allow all operations on skincare details" ON public.skincare_details
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on electronics details" ON public.electronics_details;
CREATE POLICY "Allow all operations on electronics details" ON public.electronics_details
    FOR ALL USING (true) WITH CHECK (true);

-- 7. Add database indexes to speed up details lookups
CREATE INDEX IF NOT EXISTS idx_skincare_details_product_id ON public.skincare_details(product_id);
CREATE INDEX IF NOT EXISTS idx_electronics_details_product_id ON public.electronics_details(product_id);
