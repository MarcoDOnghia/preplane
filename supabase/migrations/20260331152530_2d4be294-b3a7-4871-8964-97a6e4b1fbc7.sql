-- 1. Drop the public SELECT policy on beta_whitelist
DROP POLICY IF EXISTS "Anyone can check whitelist" ON beta_whitelist;
DROP POLICY IF EXISTS "Public read beta_whitelist" ON beta_whitelist;

-- 2. Create a security definer function to check membership
CREATE OR REPLACE FUNCTION public.is_email_whitelisted(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.beta_whitelist WHERE email = lower(trim(_email))
  )
$$;

-- 3. Only service_role can read the table directly
CREATE POLICY "Service role can read beta_whitelist"
ON beta_whitelist FOR SELECT
TO service_role
USING (true);

-- 4. Lock down research_usage: remove INSERT and UPDATE for authenticated
DROP POLICY IF EXISTS "Users can insert their own research usage" ON research_usage;
DROP POLICY IF EXISTS "Users can update their own research usage" ON research_usage;