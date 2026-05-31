-- =========================================================================
-- REVIEWLENS: SCIENTIFIC VERIFIERS SCHEMA MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Create product_scientific_verifiers table and seed active terms
-- =========================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.product_scientific_verifiers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_name text NOT NULL,
    term text NOT NULL,
    category text DEFAULT 'general',
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_scientific_verifiers_product_name 
    ON public.product_scientific_verifiers(product_name);

-- 3. Create unique index to prevent duplicate seeds
CREATE UNIQUE INDEX IF NOT EXISTS uq_scientific_verifiers 
    ON public.product_scientific_verifiers(product_name, term);

-- 4. Seed grounding active biochem terms
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
ON CONFLICT (product_name, term) DO NOTHING;
