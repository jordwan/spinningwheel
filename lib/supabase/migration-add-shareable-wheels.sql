-- Migration to add shareable wheel functionality to existing database
-- Run this SQL in your Supabase SQL editor if you already have the schema.sql tables

-- Add new columns to wheel_configurations table
ALTER TABLE public.wheel_configurations
  ADD COLUMN IF NOT EXISTS team_name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS input_method TEXT CHECK (input_method IN ('custom', 'random', 'numbers'));

-- Create new indexes for slug and public configurations
CREATE INDEX IF NOT EXISTS idx_wheel_configurations_slug
  ON public.wheel_configurations(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wheel_configurations_public
  ON public.wheel_configurations(is_public, created_at DESC)
  WHERE is_public = true;

-- Verify the migration
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'wheel_configurations'
  AND table_schema = 'public'
ORDER BY ordinal_position;
