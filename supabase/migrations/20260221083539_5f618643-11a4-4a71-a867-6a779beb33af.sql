
-- Add columns to track CV editing state
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS current_cv text,
ADD COLUMN IF NOT EXISTS applied_suggestions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_edited timestamp with time zone;
