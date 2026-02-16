
-- Add new columns for ATS analysis
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS ats_score integer DEFAULT 0;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS keywords_found jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS keywords_missing jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS formatting_issues jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS quick_wins jsonb DEFAULT '[]'::jsonb;

-- Add columns for interview prep
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS interview_questions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS questions_to_ask jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS company_brief text DEFAULT '';

-- Add columns for multiple cover letter versions
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS cover_letter_versions jsonb DEFAULT '[]'::jsonb;

-- Add columns for application tracking
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'preparing';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS applied_date timestamp with time zone;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS follow_up_date timestamp with time zone;
