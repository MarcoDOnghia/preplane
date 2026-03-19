
-- Recreate the view with SECURITY INVOKER to avoid security definer issue
DROP VIEW IF EXISTS public.public_proof_cards;

CREATE VIEW public.public_proof_cards
WITH (security_invoker = true)
AS
SELECT
  slug,
  one_liner,
  assumption,
  next_48h,
  insights,
  ask,
  image_url,
  loom_url,
  doc_url,
  published
FROM public.proof_cards
WHERE published = true;

-- Grant anonymous access to the view
GRANT SELECT ON public.public_proof_cards TO anon;

-- Add an anon RLS policy that only allows reading published cards (for the view to work with security invoker)
CREATE POLICY "Anon can read published proof cards"
  ON public.proof_cards
  FOR SELECT
  TO anon
  USING (published = true);
