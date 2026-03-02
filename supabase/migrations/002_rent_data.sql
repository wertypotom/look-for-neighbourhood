-- 002_rent_data.sql
-- Run this in the Supabase SQL Editor

-- Table to store pre-loaded Zillow Rent Index (ZORI) data
CREATE TABLE IF NOT EXISTS public.rent_data (
  zip_code TEXT PRIMARY KEY,
  median_rent INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: No index on ZIP is needed because it's the PRIMARY KEY (already indexed).

-- Enable RLS (Row Level Security) - basic lockdown for a server-side only API
ALTER TABLE public.rent_data ENABLE ROW LEVEL SECURITY;

-- Create policies to allow the Service Role or Anon Key to read/write depending on backend setup
CREATE POLICY "Enable all actions for anon users" ON public.rent_data FOR ALL USING (true) WITH CHECK (true);
