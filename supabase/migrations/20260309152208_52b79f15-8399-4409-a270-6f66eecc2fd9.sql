CREATE OR REPLACE FUNCTION public.check_and_increment_usage(_user_id uuid, _feature text, _max_count integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Enforce caller identity: prevent manipulation of other users' limits
  IF auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

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