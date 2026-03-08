
-- 1) Replace permissive INSERT policy on usage_limits with a deny policy
-- Only the SECURITY DEFINER function check_and_increment_usage should insert rows
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.usage_limits;

CREATE POLICY "No user inserts on usage_limits" ON public.usage_limits
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);

-- 2) Restrict companies SELECT from public to authenticated only
DROP POLICY IF EXISTS "Anyone can read companies" ON public.companies;

CREATE POLICY "Authenticated users can read companies" ON public.companies
  FOR SELECT TO authenticated
  USING (true);
