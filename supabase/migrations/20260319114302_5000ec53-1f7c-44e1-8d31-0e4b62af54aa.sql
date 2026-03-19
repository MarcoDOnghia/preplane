
-- Create proof_cards table
CREATE TABLE public.proof_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  slug text UNIQUE NOT NULL,
  one_liner text,
  ask text,
  insights jsonb,
  image_url text,
  loom_url text,
  doc_url text,
  assumption text,
  next_48h text,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.proof_cards ENABLE ROW LEVEL SECURITY;

-- Users can read/write own cards
CREATE POLICY "Users can view their own proof cards"
  ON public.proof_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own proof cards"
  ON public.proof_cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proof cards"
  ON public.proof_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proof cards"
  ON public.proof_cards FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Public SELECT for published cards (no auth required)
CREATE POLICY "Anyone can view published proof cards"
  ON public.proof_cards FOR SELECT TO anon
  USING (published = true);

-- Storage bucket for proof card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-cards', 'proof-cards', true);

-- Storage RLS: authenticated users can upload to proof-cards
CREATE POLICY "Authenticated users can upload proof card images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proof-cards');

CREATE POLICY "Anyone can view proof card images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'proof-cards');

CREATE POLICY "Users can update their proof card images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'proof-cards');

CREATE POLICY "Users can delete their proof card images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proof-cards');

-- Updated_at trigger
CREATE TRIGGER update_proof_cards_updated_at
  BEFORE UPDATE ON public.proof_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
