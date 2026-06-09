-- ==============================================================================
-- REVIEWLENS: MIGRATION V5 - REAL-TIME PRICING FIELDS
-- Target: PostgreSQL / Supabase
-- Description: Adds columns to support real-time pricing refresh across Amazon,
--              Flipkart, Myntra, Nykaa, and Croma.
-- ==============================================================================

-- Add columns if they do not exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS current_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_price_update timestamp with time zone;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_comparison jsonb DEFAULT '[]'::jsonb;

-- Populate current_price from existing price for initial sync
UPDATE public.products 
SET current_price = price 
WHERE current_price IS NULL;
