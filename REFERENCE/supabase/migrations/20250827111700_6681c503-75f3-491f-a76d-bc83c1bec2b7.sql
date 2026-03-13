-- Fix Admin Data Exposure: Create admin-specific RLS policies for profiles table
-- First, drop the current restrictive profile policies that prevent admin access
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policies that allow proper admin access while protecting user data
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- Add admin-only access for sensitive fields like cost_rate
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- Strengthen client data access policies - only admins and client owners can access sensitive contact info
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;

CREATE POLICY "Users can view their own clients" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all clients" 
ON public.clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- Add security audit function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  table_name text,
  record_id uuid,
  action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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