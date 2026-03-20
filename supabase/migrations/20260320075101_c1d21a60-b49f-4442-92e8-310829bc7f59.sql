
DROP VIEW IF EXISTS public.public_proof_cards;

CREATE VIEW public.public_proof_cards
WITH (security_invoker = false)
AS SELECT slug, one_liner, assumption, next_48h, insights, ask, image_url, loom_url, doc_url, published
FROM public.proof_cards
WHERE published = true;

ALTER VIEW public.public_proof_cards OWNER TO postgres;

GRANT SELECT ON public.public_proof_cards TO anon;
GRANT SELECT ON public.public_proof_cards TO authenticated;

DROP POLICY IF EXISTS "Anon can read published proof cards" ON public.proof_cards;
