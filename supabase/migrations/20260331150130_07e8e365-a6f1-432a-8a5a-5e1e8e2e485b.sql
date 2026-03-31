
-- Enable RLS on beta_whitelist
ALTER TABLE public.beta_whitelist ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anon) to read the whitelist for signup checks
CREATE POLICY "Anyone can check whitelist"
ON public.beta_whitelist
FOR SELECT
TO anon, authenticated
USING (true);
