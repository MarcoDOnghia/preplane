-- Add archived column
ALTER TABLE public.campaigns ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Update campaign limit trigger to only count non-archived campaigns
CREATE OR REPLACE FUNCTION public.enforce_campaign_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT count(*) FROM public.campaigns WHERE user_id = NEW.user_id AND archived = false) >= 10 THEN
    RAISE EXCEPTION 'You have 10 active campaigns. PrepLane is built for focus — complete or archive one before adding a new one.';
  END IF;
  RETURN NEW;
END;
$function$;