
-- Create usage_limits table to track per-user daily AI feature usage
CREATE TABLE public.usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, usage_date)
);

-- Enable RLS
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/manage their own usage
CREATE POLICY "Users can view their own usage"
  ON public.usage_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.usage_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.usage_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- Security definer function to atomically check and increment usage
-- Returns true if allowed, false if limit exceeded
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  _user_id uuid,
  _feature text,
  _max_count integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Upsert: insert or increment
  INSERT INTO public.usage_limits (user_id, feature, usage_date, count)
  VALUES (_user_id, _feature, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature, usage_date)
  DO UPDATE SET count = usage_limits.count + 1
  RETURNING count INTO current_count;

  -- If over limit, roll back the increment
  IF current_count > _max_count THEN
    UPDATE public.usage_limits
    SET count = count - 1
    WHERE user_id = _user_id AND feature = _feature AND usage_date = CURRENT_DATE;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Revoke direct EXECUTE from public, only callable via service role / internal
REVOKE EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, text, integer) TO authenticated;
