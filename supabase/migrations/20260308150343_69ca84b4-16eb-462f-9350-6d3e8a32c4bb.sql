-- Remove the UPDATE policy on usage_limits so users cannot reset their own usage counters
DROP POLICY IF EXISTS "Users can update their own usage" ON public.usage_limits;