
-- Add application_method column to track how the user applied
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS application_method text;
