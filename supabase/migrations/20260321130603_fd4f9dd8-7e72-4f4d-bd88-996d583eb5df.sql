
CREATE TABLE public.campaign_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  signal_type text NOT NULL,
  text text NOT NULL,
  source_url text,
  date text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own signals"
  ON public.campaign_signals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own signals"
  ON public.campaign_signals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own signals"
  ON public.campaign_signals FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
