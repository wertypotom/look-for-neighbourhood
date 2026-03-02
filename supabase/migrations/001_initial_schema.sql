-- 001_initial_schema.sql
-- Run this in the Supabase SQL Editor

-- 1. Cache Table for general API responses and AI Enriched Reports
CREATE TABLE IF NOT EXISTS public.cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  source TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_cache_key ON public.cache(key);
-- Index to quickly find and manually purge expired items if needed
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON public.cache(expires_at);

-- 2. Geocode Cache Table for Zip -> Lat/Lng
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  zip_code TEXT PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast zip lookups
CREATE INDEX IF NOT EXISTS idx_geocode_cache_zip ON public.geocode_cache(zip_code);

-- Enable RLS (Row Level Security) - basic lockdown for a server-side only API
ALTER TABLE public.cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- Create policies to allow the Service Role to read/write (assuming the backend uses the service key or anon key depending on your setup)
-- If using Anon Key in the backend, you must enable these:
CREATE POLICY "Enable all actions for anon users" ON public.cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for anon users" ON public.geocode_cache FOR ALL USING (true) WITH CHECK (true);
