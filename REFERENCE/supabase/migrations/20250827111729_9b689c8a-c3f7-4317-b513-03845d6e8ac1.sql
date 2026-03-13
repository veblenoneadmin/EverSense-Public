-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  table_name text,
  record_id uuid,
  action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Log the access attempt
  INSERT INTO public.security_audit_log (
    event_type,
    user_id,
    details
  ) VALUES (
    'sensitive_data_access',
    auth.uid(),
    jsonb_build_object(
      'table', table_name,
      'record_id', record_id,
      'action', action,
      'timestamp', now()
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Silently fail to avoid blocking legitimate operations
    NULL;
END;
$$;