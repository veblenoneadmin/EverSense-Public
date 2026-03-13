-- Fix critical security vulnerabilities in RLS policies

-- 1. Create security definer function to check if user can access client requests
CREATE OR REPLACE FUNCTION public.can_access_client_request(request_user_id uuid, request_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

-- 2. Create security definer function to check if user can view other user presence
CREATE OR REPLACE FUNCTION public.can_view_user_presence(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER  
SET search_path TO 'public'
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

-- 3. Drop and recreate the problematic client_requests RLS policy
DROP POLICY IF EXISTS "Users can view client requests" ON public.client_requests;

CREATE POLICY "Users can view accessible client requests" 
ON public.client_requests 
FOR SELECT 
USING (public.can_access_client_request(user_id, client_id));

-- 4. Drop and recreate the problematic user_presence RLS policy  
DROP POLICY IF EXISTS "Users can view all user presence" ON public.user_presence;

CREATE POLICY "Users can view authorized user presence" 
ON public.user_presence 
FOR SELECT 
USING (public.can_view_user_presence(user_id));

-- 5. Add missing DELETE policies for security
CREATE POLICY "Users can delete their own client requests" 
ON public.client_requests 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any client requests" 
ON public.client_requests 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
));

-- 6. Ensure user_presence has proper update policy
DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;

CREATE POLICY "Users can manage their own presence" 
ON public.user_presence 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);