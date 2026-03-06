
-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  role text NOT NULL,
  jd_text text NOT NULL DEFAULT '',
  cv_version text NOT NULL DEFAULT '',
  match_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'targeting',
  step_cv_done boolean NOT NULL DEFAULT false,
  step_connection_done boolean NOT NULL DEFAULT false,
  step_outreach_done boolean NOT NULL DEFAULT false,
  step_proof_done boolean NOT NULL DEFAULT false,
  step_cover_letter_done boolean NOT NULL DEFAULT false,
  step_followup_done boolean NOT NULL DEFAULT false,
  connection_name text,
  connection_url text,
  outreach_message text,
  proof_suggestion text,
  cover_letter text,
  followup_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enforce max 10 campaigns per user via trigger
CREATE OR REPLACE FUNCTION public.enforce_campaign_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.campaigns WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'You have 10 active campaigns. PrepLane is built for focus — complete or archive one before adding a new one.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_campaign_limit_trigger
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_limit();
