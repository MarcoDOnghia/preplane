
-- Waitlist signups
CREATE TABLE public.role_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.role_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist entries"
  ON public.role_waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own waitlist entries"
  ON public.role_waitlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Waitlist insights
CREATE TABLE public.role_waitlist_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  insight text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_waitlist_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own waitlist insights"
  ON public.role_waitlist_insights FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own waitlist insights"
  ON public.role_waitlist_insights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
