-- Fix remaining function search path security issues
-- Update existing security definer functions to include proper search path

-- Fix can_access_client_request function
CREATE OR REPLACE FUNCTION public.can_access_client_request(request_user_id uuid, request_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- User can access their own requests
  SELECT auth.uid() = request_user_id
  -- OR user is admin (if profiles table has role column)
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  -- OR user is project team member for projects with this client
  OR EXISTS (
    SELECT 1 
    FROM projects p
    JOIN project_team_members ptm ON p.id = ptm.project_id
    WHERE p.client_id = request_client_id 
    AND ptm.user_id = auth.uid()
  )
  -- OR user owns the client
  OR EXISTS (
    SELECT 1 
    FROM clients c
    WHERE c.id = request_client_id 
    AND c.created_by = auth.uid()
  );
$function$;

-- Fix can_view_user_presence function
CREATE OR REPLACE FUNCTION public.can_view_user_presence(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- User can always view their own presence
  SELECT auth.uid() = target_user_id
  -- OR user is admin
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  -- OR users are team members on same projects
  OR EXISTS (
    SELECT 1 
    FROM project_team_members ptm1
    JOIN project_team_members ptm2 ON ptm1.project_id = ptm2.project_id
    WHERE ptm1.user_id = auth.uid() 
    AND ptm2.user_id = target_user_id
  );
$function$;