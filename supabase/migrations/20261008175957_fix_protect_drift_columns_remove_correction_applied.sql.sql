CREATE OR REPLACE FUNCTION public.protect_drift_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only block when auth.uid() is set (i.e. a real user, not service role)
  IF auth.uid() IS NOT NULL THEN
    -- If any drift column is being changed, block it
    IF NEW.drift_vfs IS DISTINCT FROM OLD.drift_vfs THEN
      RAISE EXCEPTION 'drift_vfs is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.drift_checked_at IS DISTINCT FROM OLD.drift_checked_at THEN
      RAISE EXCEPTION 'drift_checked_at is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.drift_needs_correction IS DISTINCT FROM OLD.drift_needs_correction THEN
      RAISE EXCEPTION 'drift_needs_correction is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.voice_baseline IS DISTINCT FROM OLD.voice_baseline THEN
      RAISE EXCEPTION 'voice_baseline is server-managed; use refresh_voice_baseline() instead';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;