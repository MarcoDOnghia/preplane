-- Deny UPDATE and DELETE on usage_limits for all users
-- Only the SECURITY DEFINER function check_and_increment_usage should modify rows

CREATE POLICY "No user updates on usage_limits" ON public.usage_limits
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No user deletes on usage_limits" ON public.usage_limits
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (false);