
-- Create a restricted view for public proof card display (excludes user_id and campaign_id)
CREATE OR REPLACE VIEW public.public_proof_cards AS
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

-- Grant anonymous access to the view only
GRANT SELECT ON public.public_proof_cards TO anon;

-- Drop the overly permissive anon SELECT policy on proof_cards
DROP POLICY IF EXISTS "Anyone can view published proof cards" ON public.proof_cards;
