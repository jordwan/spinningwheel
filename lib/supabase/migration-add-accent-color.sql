-- Migration: per-wheel accent colour (colour picker in the setup card)
-- Run this in the Supabase SQL editor. Safe to run more than once.
--
-- The app tolerates this column being absent (it retries writes/reads without it),
-- but shared wheels only remember their colour once it exists.

ALTER TABLE public.wheel_configurations
  ADD COLUMN IF NOT EXISTS accent_color TEXT
  CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$');

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'wheel_configurations'
  AND column_name = 'accent_color';
