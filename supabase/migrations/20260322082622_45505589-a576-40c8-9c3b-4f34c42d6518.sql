
CREATE TABLE public.research_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  call_count integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.research_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own research usage"
  ON public.research_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research usage"
  ON public.research_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research usage"
  ON public.research_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
