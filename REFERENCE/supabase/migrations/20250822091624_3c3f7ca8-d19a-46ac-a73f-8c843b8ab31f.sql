-- Enable stronger password security and protection
-- This addresses the leaked password protection warning

-- 1. Enable leaked password protection and stronger requirements
-- Note: This requires enabling it in Supabase Dashboard under Authentication > Settings
-- But we can implement additional validation triggers

-- 2. Create a function to validate password strength
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check minimum length (12 characters)
  IF length(password) < 12 THEN
    RETURN false;
  END IF;
  
  -- Check for uppercase letter
  IF password !~ '[A-Z]' THEN
    RETURN false;
  END IF;
  
  -- Check for lowercase letter  
  IF password !~ '[a-z]' THEN
    RETURN false;
  END IF;
  
  -- Check for number
  IF password !~ '[0-9]' THEN
    RETURN false;
  END IF;
  
  -- Check for special character
  IF password !~ '[^A-Za-z0-9]' THEN
    RETURN false;
  END IF;
  
  -- Check against common weak passwords
  IF lower(password) IN (
    'password123!', 'password123', 'admin123456',
    'welcome123!', 'qwerty123456', '123456789012'
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;

-- 3. Add comprehensive input sanitization function
CREATE OR REPLACE FUNCTION public.sanitize_user_input(input_text text, max_length integer DEFAULT 1000)
RETURNS text
LANGUAGE sql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        SUBSTRING(input_text, 1, max_length),
        '[<>]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$function$;

-- 4. Create audit log table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.security_audit_log
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
));

-- 5. Add validation triggers for sensitive tables
CREATE OR REPLACE FUNCTION public.validate_brain_dump_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sanitize raw content
  NEW.raw_content = public.sanitize_user_input(NEW.raw_content, 50000);
  
  -- Ensure user_id matches authenticated user
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user_id mismatch';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply trigger to brain_dumps table
DROP TRIGGER IF EXISTS validate_brain_dump_trigger ON public.brain_dumps;
CREATE TRIGGER validate_brain_dump_trigger
  BEFORE INSERT OR UPDATE ON public.brain_dumps
  FOR EACH ROW EXECUTE FUNCTION public.validate_brain_dump_input();

-- 6. Add validation for client_requests
CREATE OR REPLACE FUNCTION public.validate_client_request_input()
RETURNS trigger  
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sanitize text fields
  NEW.title = public.sanitize_user_input(NEW.title, 200);
  NEW.description = public.sanitize_user_input(NEW.description, 5000);
  
  -- Ensure user_id matches authenticated user
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user_id mismatch';
  END IF;
  
  -- Validate priority values
  IF NEW.priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    NEW.priority = 'normal';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply trigger to client_requests table
DROP TRIGGER IF EXISTS validate_client_request_trigger ON public.client_requests;
CREATE TRIGGER validate_client_request_trigger
  BEFORE INSERT OR UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_request_input();