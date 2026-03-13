-- Add account lockout protection table
CREATE TABLE public.account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS on lockouts table
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can check lockout status (for admin purposes)
CREATE POLICY "Admin only: view account lockouts" ON public.account_lockouts
FOR SELECT USING (is_admin_user());

CREATE POLICY "System can manage lockouts" ON public.account_lockouts
FOR ALL USING (true) WITH CHECK (true);

-- Function to check and update lockout status
CREATE OR REPLACE FUNCTION public.check_account_lockout(email_input TEXT)
RETURNS TABLE(is_locked BOOLEAN, attempts INTEGER, locked_until TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  lockout_record RECORD;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '15 minutes';
BEGIN
  -- Get current lockout record
  SELECT * INTO lockout_record
  FROM public.account_lockouts
  WHERE email = LOWER(TRIM(email_input));
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.account_lockouts (email, failed_attempts)
    VALUES (LOWER(TRIM(email_input)), 0);
    
    RETURN QUERY SELECT FALSE, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check if lockout has expired
  IF lockout_record.locked_until IS NOT NULL AND lockout_record.locked_until <= now() THEN
    -- Reset the lockout
    UPDATE public.account_lockouts
    SET failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE email = LOWER(TRIM(email_input));
    
    RETURN QUERY SELECT FALSE, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Return current status
  RETURN QUERY SELECT 
    (lockout_record.locked_until IS NOT NULL AND lockout_record.locked_until > now()),
    lockout_record.failed_attempts,
    lockout_record.locked_until;
END;
$$;

-- Function to record failed login attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_attempts INTEGER;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '15 minutes';
BEGIN
  -- Update or insert failed attempt
  INSERT INTO public.account_lockouts (email, failed_attempts, updated_at)
  VALUES (LOWER(TRIM(email_input)), 1, now())
  ON CONFLICT (email)
  DO UPDATE SET 
    failed_attempts = account_lockouts.failed_attempts + 1,
    updated_at = now();
  
  -- Get current attempts
  SELECT failed_attempts INTO current_attempts
  FROM public.account_lockouts
  WHERE email = LOWER(TRIM(email_input));
  
  -- Lock account if max attempts reached
  IF current_attempts >= max_attempts THEN
    UPDATE public.account_lockouts
    SET locked_until = now() + lockout_duration
    WHERE email = LOWER(TRIM(email_input));
    
    RETURN TRUE; -- Account is now locked
  END IF;
  
  RETURN FALSE; -- Account not locked yet
END;
$$;

-- Function to clear lockout on successful login
CREATE OR REPLACE FUNCTION public.clear_failed_attempts(email_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.account_lockouts
  SET failed_attempts = 0, locked_until = NULL, updated_at = now()
  WHERE email = LOWER(TRIM(email_input));
END;
$$;