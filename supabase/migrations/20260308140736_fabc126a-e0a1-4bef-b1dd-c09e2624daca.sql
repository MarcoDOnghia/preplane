
-- Remove INSERT and UPDATE policies on usage_limits so users cannot manipulate their own usage counts
-- The check_and_increment_usage function runs as SECURITY DEFINER and bypasses RLS
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_limits;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_limits;
