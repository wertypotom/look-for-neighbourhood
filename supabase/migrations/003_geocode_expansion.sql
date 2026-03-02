-- 003_geocode_expansion.sql
-- Run this in the Supabase SQL Editor

-- Add city and state columns to the geocode_cache table
ALTER TABLE public.geocode_cache ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.geocode_cache ADD COLUMN IF NOT EXISTS state TEXT;
