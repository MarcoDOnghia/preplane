ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS step_linkedin_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS linkedin_angles text NULL;