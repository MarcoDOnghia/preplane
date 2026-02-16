
-- User job preferences
CREATE TABLE public.user_job_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  job_titles text[] DEFAULT '{}',
  locations text[] DEFAULT '{}',
  remote_preference text DEFAULT 'any',
  salary_min integer DEFAULT 0,
  salary_max integer DEFAULT 500000,
  salary_currency text DEFAULT 'USD',
  industries text[] DEFAULT '{}',
  company_sizes text[] DEFAULT '{}',
  experience_level text DEFAULT 'mid',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_job_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON public.user_job_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.user_job_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.user_job_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Saved jobs
CREATE TABLE public.saved_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  job_title text NOT NULL,
  company text NOT NULL DEFAULT '',
  location text DEFAULT '',
  salary_range text DEFAULT '',
  job_description text NOT NULL DEFAULT '',
  source_url text DEFAULT '',
  match_score integer DEFAULT 0,
  match_reasons text[] DEFAULT '{}',
  missing_skills text[] DEFAULT '{}',
  strengths text[] DEFAULT '{}',
  notes text DEFAULT '',
  status text DEFAULT 'saved',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved jobs" ON public.saved_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own saved jobs" ON public.saved_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saved jobs" ON public.saved_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved jobs" ON public.saved_jobs FOR DELETE USING (auth.uid() = user_id);
