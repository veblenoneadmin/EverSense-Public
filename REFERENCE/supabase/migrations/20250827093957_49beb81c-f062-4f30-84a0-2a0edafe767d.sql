-- Fix security audit log access control
-- Create security definer function to check admin role (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = 'public';

-- Drop existing policy and create comprehensive restrictive policies
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.security_audit_log;

-- Only admins can view audit logs
CREATE POLICY "Admin only: view audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (public.is_admin_user());

-- Only admins can insert audit logs (system-generated entries)
CREATE POLICY "Admin only: insert audit logs"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user());

-- Prevent updates to audit logs (audit integrity)
CREATE POLICY "No updates allowed on audit logs"
ON public.security_audit_log
FOR UPDATE
TO authenticated
USING (false);

-- Only admins can delete audit logs (for cleanup/retention)
CREATE POLICY "Admin only: delete audit logs"
ON public.security_audit_log
FOR DELETE
TO authenticated
USING (public.is_admin_user());