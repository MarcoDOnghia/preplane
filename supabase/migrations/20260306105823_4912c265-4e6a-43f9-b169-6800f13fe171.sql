
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  linkedin_url text,
  country text NOT NULL,
  city text,
  remote_friendly boolean NOT NULL DEFAULT false,
  size text NOT NULL CHECK (size IN ('startup', 'scaleup', 'boutique', 'mid-size')),
  categories text[] NOT NULL DEFAULT '{}',
  description text,
  why_good_for_juniors text,
  prestige_level integer NOT NULL DEFAULT 3 CHECK (prestige_level BETWEEN 1 AND 5),
  hiring_juniors boolean NOT NULL DEFAULT true,
  added_by text CHECK (added_by IN ('manual', 'community')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Public read access, no write for regular users
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);
